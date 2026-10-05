"""WebSocket /ws: только доставка событий, все данные — через REST.

Сервер → клиент: message.new, message.read, typing, pong, error.
Клиент → сервер: {"type": "typing", "conversation_id": "..."} и {"type": "ping"}.
"""

import asyncio
import contextlib
import json
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.core.config import Settings, get_settings
from app.core.db import DbSession
from app.core.errors import DomainError
from app.core.pubsub import PubSubDep
from app.core.queue import QueueDep
from app.core.security import SESSION_COOKIE
from app.modules.auth.dependencies import get_auth_service
from app.modules.chat.router import get_chat_service
from app.modules.chat.service import ChatService
from app.modules.users.models import User

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])

# Коды закрытия из диапазона приложений (4000–4999), фронт по ним решает, что делать.
CLOSE_UNAUTHORIZED = 4401  # нет сессии → на страницу входа
CLOSE_FORBIDDEN_ORIGIN = 4403


@router.websocket("/ws")
async def events(
    websocket: WebSocket,
    session: DbSession,
    pubsub: PubSubDep,
    queue: QueueDep,
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    # CORS на WebSocket не действует: без проверки Origin любой сайт открыл бы сокет
    # с cookie пользователя (cross-site WebSocket hijacking).
    if websocket.headers.get("origin") not in settings.cors_origins:
        await websocket.close(code=CLOSE_FORBIDDEN_ORIGIN)
        return
    token = websocket.cookies.get(SESSION_COOKIE)
    user = await get_auth_service(session).resolve(token) if token else None
    if user is not None:
        # Отсоединяем до rollback: иначе SQLAlchemy пометит объект устаревшим
        # и первое же user.id полезет в БД.
        session.expunge(user)
    await session.rollback()  # не держим соединение из пула всю жизнь сокета
    if user is None:
        await websocket.close(code=CLOSE_UNAUTHORIZED)
        return

    chat = get_chat_service(session, queue, pubsub)
    await websocket.accept()
    async with pubsub.subscribe(user.id) as stream:

        async def forward() -> None:
            async for event in stream:
                await websocket.send_json(event)

        forwarder = asyncio.create_task(forward())
        try:
            while True:
                await _handle(websocket, await websocket.receive_text(), chat, user)
                await session.rollback()
        except WebSocketDisconnect:
            pass
        finally:
            forwarder.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await forwarder


async def _handle(websocket: WebSocket, raw: str, chat: ChatService, user: User) -> None:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        await websocket.send_json({"type": "error", "code": "bad_json"})
        return
    match data:
        case {"type": "ping"}:
            await websocket.send_json({"type": "pong"})
        case {"type": "typing", "conversation_id": str(conversation_id)}:
            try:
                await chat.typing(UUID(conversation_id), user)
            except (DomainError, ValueError):
                await websocket.send_json({"type": "error", "code": "conversation_not_found"})
        case _:
            await websocket.send_json({"type": "error", "code": "unknown_event"})
