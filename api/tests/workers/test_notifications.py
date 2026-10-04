import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import httpx
import pytest
from arq import Retry
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import AuthIdentity, AuthProvider
from app.seed import STAFF
from app.workers.notifications import (
    notify_application_status,
    notify_new_application,
    send_telegram_message,
)
from helpers import MemoryPubSub, login

pytestmark = pytest.mark.usefixtures("seeded")


class FakeBot:
    def __init__(self, failing: frozenset[str] = frozenset()) -> None:
        self.sent: list[tuple[str, str]] = []
        self.failing = failing

    async def send_message(self, chat_id: str, text: str) -> None:
        if chat_id in self.failing:
            raise httpx.ConnectError("telegram is down")
        self.sent.append((chat_id, text))


class FakeRedis:
    """Как ArqRedis: задача с тем же _job_id второй раз не ставится."""

    def __init__(self) -> None:
        self.jobs: dict[str, tuple[str, tuple[Any, ...]]] = {}

    async def enqueue_job(self, function: str, *args: Any, _job_id: str | None = None) -> Any:
        key = _job_id or uuid.uuid4().hex
        if key in self.jobs:
            return None
        self.jobs[key] = (function, args)
        return key


def _ctx(db_session: AsyncSession, bot: FakeBot | None) -> dict[str, Any]:
    @asynccontextmanager
    async def factory() -> AsyncIterator[AsyncSession]:
        yield db_session  # тестовую сессию не закрываем — её откатит фикстура

    return {
        "session_factory": factory,
        "telegram": bot,
        "redis": FakeRedis(),
        "pubsub": MemoryPubSub(),
        "job_try": 1,
    }


async def _drain(ctx: dict[str, Any]) -> list[str]:
    """Выполняет поставленные send_telegram_message; возвращает chat_id тех, что упали."""
    failed = []
    for function, args in ctx["redis"].jobs.values():
        assert function == "send_telegram_message"
        try:
            await send_telegram_message(ctx, *args)
        except Retry:
            failed.append(args[0])
    return failed


async def _application(client: httpx.AsyncClient) -> str:
    await login(client, "Асель")
    pet = (await client.get("/api/v1/pets", params={"q": "Мурка"})).json()["items"][0]["id"]
    form = {
        "name": "Асель",
        "phone": "+77012345678",
        "city": "pavlodar",
        "housing": "flat",
        "consent": True,
    }
    r = await client.post(f"/api/v1/pets/{pet}/applications", json=form)
    return str(r.json()["id"])


async def _link_telegram(db: AsyncSession, user_id: Any, chat_id: str) -> None:
    db.add(AuthIdentity(user_id=user_id, provider=AuthProvider.TELEGRAM, provider_user_id=chat_id))
    await db.flush()


async def _second_staff(db: AsyncSession) -> uuid.UUID:
    from app.modules.shelters.models import ShelterMember, ShelterRole
    from app.modules.users.models import User
    from app.seed import TEPLY

    user = User(name="Ерке")
    db.add(user)
    await db.flush()
    db.add(ShelterMember(shelter_id=TEPLY, user_id=user.id, role=ShelterRole.STAFF))
    await db.flush()
    return user.id


async def test_new_application_goes_to_shelter_staff(
    client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    app_id = await _application(client)
    await _link_telegram(db_session, STAFF[0]["id"], "5001")
    bot = FakeBot()
    ctx = _ctx(db_session, bot)
    await notify_new_application(ctx, app_id)
    assert await _drain(ctx) == []
    assert bot.sent == [("5001", "Новая заявка на Мурка от Асель. Откройте Paw Rescue Hub.")]


async def test_status_change_goes_to_applicant(
    client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    app_id = await _application(client)
    me = (await client.get("/api/v1/auth/me")).json()
    await _link_telegram(db_session, uuid.UUID(me["id"]), "6001")

    staff = client  # переиспользуем клиент: входим как сотрудник
    await login(staff, "Гульнара")
    await staff.patch(f"/api/v1/applications/{app_id}", json={"status": "approved"})

    bot = FakeBot()
    ctx = _ctx(db_session, bot)
    await notify_application_status(ctx, app_id)
    await _drain(ctx)
    assert bot.sent == [("6001", "Заявку на Мурка одобрили! Куратор свяжется с вами.")]


async def test_failure_retries_only_the_failed_recipient(
    client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    app_id = await _application(client)
    await _link_telegram(db_session, STAFF[0]["id"], "5001")
    await _link_telegram(db_session, await _second_staff(db_session), "5002")
    bot = FakeBot(failing=frozenset({"5002"}))
    ctx = _ctx(db_session, bot)
    await notify_new_application(ctx, app_id)
    assert len(ctx["redis"].jobs) == 2  # своя задача на каждого получателя
    assert await _drain(ctx) == ["5002"]  # повторится только упавшая отправка
    assert [chat for chat, _ in bot.sent] == ["5001"]


async def test_same_event_is_not_enqueued_twice(
    client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    app_id = await _application(client)
    await _link_telegram(db_session, STAFF[0]["id"], "5001")
    ctx = _ctx(db_session, FakeBot())
    await notify_new_application(ctx, app_id)
    await notify_new_application(ctx, app_id)  # задача уведомления перезапустилась
    assert len(ctx["redis"].jobs) == 1


async def test_without_bot_nothing_is_enqueued(
    client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    app_id = await _application(client)
    ctx = _ctx(db_session, None)
    await notify_new_application(ctx, app_id)
    assert ctx["redis"].jobs == {}
