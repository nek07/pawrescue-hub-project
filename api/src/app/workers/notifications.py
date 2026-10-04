"""Уведомления о заявках. Запускаются воркером arq, а не в HTTP-запросе.

Шлём в Telegram тем, кто вошёл через Telegram. Почта — когда подключим провайдера.
"""

import logging
from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from typing import Any, Protocol
from uuid import UUID

import httpx
from arq import Retry
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pubsub import PubSub
from app.core.queue import Queue
from app.modules.applications.models import ApplicationStatus
from app.modules.applications.repository import ApplicationRepository
from app.modules.applications.service import ApplicationService
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import AuthService
from app.modules.chat.repository import ChatRepository
from app.modules.chat.service import ChatService
from app.modules.pets.dependencies import get_pet_service
from app.modules.users.repository import UserRepository
from app.modules.users.service import UserService

logger = logging.getLogger(__name__)

STATUS_TEXT = {
    ApplicationStatus.MEETING: "Куратор предлагает познакомиться с {pet}. Ответьте в сообщениях.",
    ApplicationStatus.APPROVED: "Заявку на {pet} одобрили! Куратор свяжется с вами.",
    ApplicationStatus.COMPLETED: "{pet} теперь дома. Спасибо, что выбрали Paw Rescue Hub!",
    ApplicationStatus.REJECTED: "К сожалению, заявку на {pet} отклонили.",
}


# Системные сообщения в диалоге — ключи перевода (chat.system.* на фронте),
# а не готовый текст: интерфейс на русском и казахском.
SYSTEM_KEYS = {status: f"application.{status}" for status in ApplicationStatus}
SYSTEM_KEYS[ApplicationStatus.SENT] = "application.sent"


class Bot(Protocol):
    async def send_message(self, chat_id: str, text: str) -> None: ...


SessionFactory = Callable[[], AbstractAsyncContextManager[AsyncSession]]


class _NoQueue:
    async def enqueue(self, job: str, *args: str) -> None:  # воркер сам ничего не ставит
        return None


def _services(
    session: AsyncSession, pubsub: PubSub
) -> tuple[ApplicationService, AuthService, ChatService]:
    pets = get_pet_service(session)
    queue: Queue = _NoQueue()
    users = UserService(UserRepository(session))
    applications = ApplicationService(session, ApplicationRepository(session), pets, queue)
    auth = AuthService(session, AuthRepository(session), users)
    chat = ChatService(
        session, ChatRepository(session), pets, pets.shelters, users, applications, pubsub
    )
    return applications, auth, chat


class JobQueue(Protocol):
    """ArqRedis из ctx["redis"]: воркер ставит задачи сам себе."""

    async def enqueue_job(self, function: str, *args: Any, _job_id: str | None = None) -> Any: ...


async def _send(ctx: dict[str, Any], event: str, chat_ids: list[str], text: str) -> None:
    """Каждому получателю — своя задача: при сбое повторяется только его сообщение,
    а не вся рассылка. _job_id не даёт поставить одно и то же сообщение дважды."""
    if ctx.get("telegram") is None:
        logger.info("Telegram bot is not configured, skip: %s", text)
        return
    redis: JobQueue = ctx["redis"]
    for chat_id in chat_ids:
        await redis.enqueue_job(
            "send_telegram_message", chat_id, text, _job_id=f"tg:{event}:{chat_id}"
        )


async def send_telegram_message(ctx: dict[str, Any], chat_id: str, text: str) -> None:
    bot: Bot | None = ctx.get("telegram")
    if bot is None:
        return
    try:
        await bot.send_message(chat_id, text)
    except httpx.HTTPError as exc:
        # arq повторит только это сообщение; задержка растёт с каждой попыткой.
        raise Retry(defer=ctx.get("job_try", 1) * 30) from exc


async def notify_new_application(ctx: dict[str, Any], application_id: str) -> None:
    factory: SessionFactory = ctx["session_factory"]
    async with factory() as session:
        applications, auth, chat = _services(session, ctx["pubsub"])
        application = await applications.get_raw(UUID(application_id))
        if application is None:
            return
        pet = await applications.pets.get_pet(application.pet_id)
        # Заявка открывает диалог с куратором — дальше всё общение там.
        conversation = await chat.ensure_for_pet(application.user_id, pet)
        await chat.post_system(conversation, SYSTEM_KEYS[ApplicationStatus.SENT])
        if pet.volunteer_id is not None:
            curators = [pet.volunteer_id]
        else:
            assert pet.shelter_id is not None
            curators = await applications.pets.shelters.member_user_ids(pet.shelter_id)
        chat_ids = await auth.telegram_chat_ids(curators)
    text = f"Новая заявка на {pet.name} от {application.name}. Откройте Paw Rescue Hub."
    await _send(ctx, f"new:{application.id}", chat_ids, text)


async def notify_application_status(ctx: dict[str, Any], application_id: str) -> None:
    factory: SessionFactory = ctx["session_factory"]
    async with factory() as session:
        applications, auth, chat = _services(session, ctx["pubsub"])
        application = await applications.get_raw(UUID(application_id))
        if application is None:
            return
        pet = await applications.pets.get_pet(application.pet_id)
        conversation = await chat.ensure_for_pet(application.user_id, pet)
        await chat.post_system(conversation, SYSTEM_KEYS[application.status])
        if application.status not in STATUS_TEXT:  # отзыв сам человек уже знает
            return
        chat_ids = await auth.telegram_chat_ids([application.user_id])
    text = STATUS_TEXT[application.status].format(pet=pet.name)
    await _send(ctx, f"status:{application.id}:{application.status}", chat_ids, text)
