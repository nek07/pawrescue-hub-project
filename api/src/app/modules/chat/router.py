from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.db import DbSession
from app.core.pagination import Page
from app.core.pubsub import PubSubDep
from app.core.queue import QueueDep
from app.modules.applications.router import get_application_service
from app.modules.auth.dependencies import CurrentUser
from app.modules.chat.repository import ChatRepository
from app.modules.chat.schemas import (
    ConversationOut,
    MessageIn,
    MessageOut,
    MessagesQuery,
    StartConversationIn,
    UnreadOut,
)
from app.modules.chat.service import ChatService
from app.modules.pets.dependencies import get_pet_service
from app.modules.shelters.repository import ShelterRepository
from app.modules.shelters.service import ShelterService
from app.modules.users.repository import UserRepository
from app.modules.users.service import UserService

router = APIRouter(prefix="/conversations", tags=["chat"])


def get_chat_service(session: DbSession, queue: QueueDep, pubsub: PubSubDep) -> ChatService:
    return ChatService(
        session,
        ChatRepository(session),
        get_pet_service(session),
        ShelterService(ShelterRepository(session)),
        UserService(UserRepository(session)),
        get_application_service(session, queue),
        pubsub,
    )


ServiceDep = Annotated[ChatService, Depends(get_chat_service)]


@router.get("")
async def list_conversations(
    q: Annotated[MessagesQuery, Query()], user: CurrentUser, service: ServiceDep
) -> Page[ConversationOut]:
    return await service.list_conversations(user, q)


@router.post("")
async def start_conversation(
    body: StartConversationIn, user: CurrentUser, service: ServiceDep
) -> ConversationOut:
    """Идемпотентно: повторный вызов возвращает уже существующий диалог."""
    return await service.start(user, body)


@router.get("/unread")
async def unread_count(user: CurrentUser, service: ServiceDep) -> UnreadOut:
    """Бейдж «Сообщения 2» в шапке."""
    return UnreadOut(count=await service.unread_count(user))


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: UUID, user: CurrentUser, service: ServiceDep
) -> ConversationOut:
    return await service.get(conversation_id, user)


@router.get("/{conversation_id}/messages")
async def list_messages(
    conversation_id: UUID,
    q: Annotated[MessagesQuery, Query()],
    user: CurrentUser,
    service: ServiceDep,
) -> Page[MessageOut]:
    return await service.messages(conversation_id, user, q)


@router.post("/{conversation_id}/messages", status_code=201)
async def send_message(
    conversation_id: UUID, body: MessageIn, user: CurrentUser, service: ServiceDep
) -> MessageOut:
    return await service.send(conversation_id, user, body.text)


@router.post("/{conversation_id}/read", status_code=204)
async def mark_read(conversation_id: UUID, user: CurrentUser, service: ServiceDep) -> None:
    await service.mark_read(conversation_id, user)
