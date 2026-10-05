"""Сообщения: «Спросить куратора», переписка Асели с «Тёплым углом», непрочитанные."""

import uuid
from collections.abc import Awaitable, Callable
from typing import Any

import pytest
from httpx import AsyncClient

from app.seed import STAFF
from helpers import MemoryPubSub, login

pytestmark = pytest.mark.usefixtures("seeded")
MakeClient = Callable[[], Awaitable[AsyncClient]]
CONV = "/api/v1/conversations"


async def _pet(client: AsyncClient, name: str = "Мурка") -> str:
    return str((await client.get("/api/v1/pets", params={"q": name})).json()["items"][0]["id"])


@pytest.fixture
async def pair(make_client: MakeClient) -> tuple[AsyncClient, AsyncClient, dict[str, Any]]:
    """Асель начинает диалог о Мурке; Гульнара — сотрудник «Тёплого угла»."""
    asel, staff = await make_client(), await make_client()
    await login(asel, "Асель")
    await login(staff, "Гульнара")
    r = await asel.post(CONV, json={"pet_id": await _pet(asel)})
    assert r.status_code == 200, r.text
    return asel, staff, r.json()


async def test_guest_must_login(client: AsyncClient) -> None:
    assert (await client.post(CONV, json={"pet_id": await _pet(client)})).status_code == 401


async def test_start_is_idempotent(pair: tuple[AsyncClient, AsyncClient, dict[str, Any]]) -> None:
    asel, _, conv = pair
    again = (await asel.post(CONV, json={"pet_id": conv["pet"]["id"]})).json()
    assert again["id"] == conv["id"]
    assert conv["my_side"] == "user"
    assert conv["counterpart"] == {
        "type": "shelter",
        "id": conv["counterpart"]["id"],
        "name": "Тёплый угол",
        "avatar_url": None,
        "verified": True,
    }
    assert conv["last_message"] is None
    assert conv["application"] is None


async def test_one_target_required(client: AsyncClient) -> None:
    await login(client, "Асель")
    r = await client.post(CONV, json={})
    assert r.status_code == 422
    assert r.json()["error"]["fields"] == {"body": "one_target"}


async def test_cannot_message_own_pet_or_unverified_volunteer(client: AsyncClient) -> None:
    await login(client, "Дана", "volunteer")
    r = await client.post(CONV, json={"pet_id": await _pet(client, "Персик")})
    assert r.json()["error"]["code"] == "own_pet"
    asel = (await client.post("/api/v1/auth/dev-login", json={"name": "Асель"})).json()
    r = await client.post(CONV, json={"volunteer_id": asel["id"]})  # не волонтёр
    assert r.json()["error"]["code"] == "curator_not_found"


async def test_message_reaches_shelter_with_event_and_unread(
    pair: tuple[AsyncClient, AsyncClient, dict[str, Any]], pubsub: MemoryPubSub
) -> None:
    asel, staff, conv = pair
    r = await asel.post(f"{CONV}/{conv['id']}/messages", json={"text": "  Мурка ещё ищет дом?  "})
    assert r.status_code == 201
    message = r.json()
    assert (message["text"], message["side"], message["kind"]) == (
        "Мурка ещё ищет дом?",
        "user",
        "text",
    )

    # Событие ушло обеим сторонам (у Асели — для других вкладок)
    staff_id = STAFF[0]["id"]
    new = pubsub.events_for(staff_id, "message.new")
    assert new[-1]["message"]["id"] == message["id"]
    assert new[-1]["conversation_id"] == conv["id"]

    inbox = (await staff.get(CONV)).json()
    item = inbox["items"][0]
    assert item["my_side"] == "curator"
    assert item["counterpart"]["type"] == "user"
    assert item["counterpart"]["name"] == "Асель"
    assert item["unread_count"] == 1
    assert item["last_message"]["text"] == "Мурка ещё ищет дом?"
    assert (await staff.get(f"{CONV}/unread")).json() == {"count": 1}
    assert (await asel.get(f"{CONV}/unread")).json() == {"count": 0}  # своё не считается

    assert (await staff.post(f"{CONV}/{conv['id']}/read")).status_code == 204
    assert (await staff.get(f"{CONV}/unread")).json() == {"count": 0}
    read = pubsub.events_for(uuid.UUID(await _me(asel)), "message.read")
    assert read[-1]["side"] == "curator"  # Асель видит, что приют прочитал


async def _me(client: AsyncClient) -> str:
    return str((await client.get("/api/v1/auth/me")).json()["id"])


async def test_history_and_reconnect_catch_up(
    pair: tuple[AsyncClient, AsyncClient, dict[str, Any]],
) -> None:
    asel, staff, conv = pair
    url = f"{CONV}/{conv['id']}/messages"
    texts = ["Здравствуйте!", "Мурка ещё ищет дом?", "Можно в субботу?"]
    ids = [(await asel.post(url, json={"text": t})).json()["id"] for t in texts]
    reply = (await staff.post(url, json={"text": "Да, приходите в 12:00"})).json()

    page = (await asel.get(url, params={"limit": 2})).json()
    assert [m["text"] for m in page["items"]] == ["Да, приходите в 12:00", "Можно в субботу?"]
    assert page["total"] == 4
    assert page["next_cursor"]

    # Разорвалось соединение после первого сообщения — догружаем пропущенное
    after = (await asel.get(url, params={"after": ids[0]})).json()
    assert [m["id"] for m in after["items"]] == [ids[1], ids[2], reply["id"]]


async def test_stranger_sees_nothing(
    pair: tuple[AsyncClient, AsyncClient, dict[str, Any]], make_client: MakeClient
) -> None:
    _, _, conv = pair
    stranger = await make_client()
    await login(stranger, "Ерлан", "volunteer")
    for r in (
        await stranger.get(f"{CONV}/{conv['id']}"),
        await stranger.get(f"{CONV}/{conv['id']}/messages"),
        await stranger.post(f"{CONV}/{conv['id']}/messages", json={"text": "Привет"}),
    ):
        assert r.status_code == 404
        assert r.json()["error"]["code"] == "conversation_not_found"
    assert (await stranger.get(CONV)).json()["total"] == 0


async def test_empty_message_is_rejected(
    pair: tuple[AsyncClient, AsyncClient, dict[str, Any]],
) -> None:
    asel, _, conv = pair
    r = await asel.post(f"{CONV}/{conv['id']}/messages", json={"text": "   "})
    assert r.json()["error"]["fields"] == {"text": "message_empty"}


async def test_shelter_conversation_without_pet(make_client: MakeClient) -> None:
    asel = await make_client()
    await login(asel, "Асель")
    shelters = (
        await asel.get("/api/v1/curators", params={"type": "shelter", "q": "Тёплый"})
    ).json()
    shelter_id = shelters["items"][0]["id"]
    first = (await asel.post(CONV, json={"shelter_id": shelter_id})).json()
    second = (await asel.post(CONV, json={"shelter_id": shelter_id})).json()
    assert first["id"] == second["id"]
    assert first["pet"] is None
