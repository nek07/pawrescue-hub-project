"""Лимиты частоты: 429 с Retry-After, счётчик у каждой сессии свой."""

from collections.abc import Awaitable, Callable

import pytest
from httpx import AsyncClient

from app.seed import sid
from helpers import login

pytestmark = pytest.mark.usefixtures("seeded")
MakeClient = Callable[[], Awaitable[AsyncClient]]


async def test_message_flood_is_limited_per_session(make_client: MakeClient) -> None:
    asel, aigerim = await make_client(), await make_client()
    await login(asel, "Асель")
    await login(aigerim, "Айгерим")
    conv = (await asel.post("/api/v1/conversations", json={"pet_id": str(sid("pet:Мурка"))})).json()
    url = f"/api/v1/conversations/{conv['id']}/messages"
    for i in range(30):
        assert (await asel.post(url, json={"text": f"#{i}"})).status_code == 201
    r = await asel.post(url, json={"text": "ещё одно"})
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "too_many_requests"
    assert r.headers["retry-after"] == "60"

    other = (
        await aigerim.post("/api/v1/conversations", json={"pet_id": str(sid("pet:Мурка"))})
    ).json()
    r = await aigerim.post(f"/api/v1/conversations/{other['id']}/messages", json={"text": "Привет"})
    assert r.status_code == 201  # у другого человека свой счётчик


async def test_login_is_limited_per_ip(client: AsyncClient) -> None:
    for _ in range(20):
        assert (
            await client.post("/api/v1/auth/dev-login", json={"name": "Асель"})
        ).status_code == 200
    r = await client.post("/api/v1/auth/dev-login", json={"name": "Асель"})
    assert r.status_code == 429
