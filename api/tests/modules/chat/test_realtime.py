"""WebSocket /ws: события доходят до открытых вкладок обеих сторон."""

import asyncio
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from httpx_ws import AsyncWebSocketSession, WebSocketDisconnect, aconnect_ws
from httpx_ws.transport import ASGIWebSocketTransport

from helpers import login

pytestmark = pytest.mark.usefixtures("seeded")
ORIGIN = {"Origin": "http://localhost:3000"}
CONV = "/api/v1/conversations"

Connect = Callable[..., AbstractAsyncContextManager[tuple[AsyncClient, AsyncWebSocketSession]]]


@pytest.fixture
def connect(app: FastAPI) -> Connect:
    """Вошедший клиент + открытый сокет (или ошибка рукопожатия)."""

    @asynccontextmanager
    async def _connect(
        name: str | None, role: str = "user", headers: dict[str, str] | None = None
    ) -> AsyncIterator[tuple[AsyncClient, AsyncWebSocketSession]]:
        async with AsyncClient(transport=ASGIWebSocketTransport(app), base_url="http://test") as c:
            if name:
                await login(c, name, role)
            async with aconnect_ws(
                "/api/v1/ws", c, headers=ORIGIN if headers is None else headers
            ) as ws:
                yield c, ws

    return _connect


async def _next(ws: AsyncWebSocketSession, kind: str) -> dict[str, Any]:
    async def wait() -> dict[str, Any]:
        while True:
            event: dict[str, Any] = await ws.receive_json()
            if event["type"] == kind:
                return event

    return await asyncio.wait_for(wait(), timeout=3)


async def test_message_is_delivered_in_real_time(connect: Connect) -> None:
    async with connect("Асель") as (asel, asel_ws), connect("Гульнара") as (staff, staff_ws):
        pet = (await asel.get("/api/v1/pets", params={"q": "Мурка"})).json()["items"][0]["id"]
        conv = (await asel.post(CONV, json={"pet_id": pet})).json()

        await staff.post(f"{CONV}/{conv['id']}/messages", json={"text": "Здравствуйте, Асель!"})
        event = await _next(asel_ws, "message.new")
        assert event["message"]["text"] == "Здравствуйте, Асель!"
        assert event["conversation_id"] == conv["id"]

        # «Печатает…» видит только другая сторона
        await asel_ws.send_json({"type": "typing", "conversation_id": conv["id"]})
        typing = await _next(staff_ws, "typing")
        assert typing == {"type": "typing", "conversation_id": conv["id"], "side": "user"}


async def test_ping_and_bad_input(connect: Connect) -> None:
    async with connect("Асель") as (_, ws):
        await ws.send_json({"type": "ping"})
        assert await _next(ws, "pong") == {"type": "pong"}
        await ws.send_text("not json")
        assert (await _next(ws, "error"))["code"] == "bad_json"
        await ws.send_json(
            {"type": "typing", "conversation_id": "00000000-0000-0000-0000-000000000000"}
        )
        assert (await _next(ws, "error"))["code"] == "conversation_not_found"


def _close_code(exc: BaseException) -> int | None:
    """httpx-ws заворачивает отказ рукопожатия в ExceptionGroup — достаём код закрытия."""
    if isinstance(exc, WebSocketDisconnect):
        return int(exc.code)
    if isinstance(exc, BaseExceptionGroup):
        for inner in exc.exceptions:
            if (code := _close_code(inner)) is not None:
                return code
    return None


@pytest.mark.parametrize(
    ("name", "headers", "code"),
    [
        (None, ORIGIN, 4401),  # гость
        ("Асель", {"Origin": "https://evil.example"}, 4403),  # чужой сайт с cookie пользователя
        ("Асель", {}, 4403),  # без Origin
    ],
)
async def test_handshake_is_rejected(
    connect: Connect, name: str | None, headers: dict[str, str], code: int
) -> None:
    with pytest.raises(BaseException) as exc:  # noqa: PT011 — разбираем код ниже
        async with connect(name, headers=headers) as (_, ws):
            await ws.receive_json()
    assert _close_code(exc.value) == code
