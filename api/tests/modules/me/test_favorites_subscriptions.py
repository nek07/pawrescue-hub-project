"""♡ «В избранное» и «Подписаться» на приют."""

import pytest
from httpx import AsyncClient

from app.seed import sid
from helpers import login

pytestmark = pytest.mark.usefixtures("seeded")
MURKA = str(sid("pet:Мурка"))
TEPLY = str(sid("shelter:teply-ugol"))


async def test_favorites_flow(client: AsyncClient) -> None:
    assert (await client.put(f"/api/v1/pets/{MURKA}/favorite")).status_code == 401  # гость
    await login(client, "Асель")
    assert (await client.put(f"/api/v1/pets/{MURKA}/favorite")).json() == {"favorite": True}
    assert (await client.put(f"/api/v1/pets/{MURKA}/favorite")).json() == {"favorite": True}

    card = (await client.get("/api/v1/pets", params={"q": "Мурка"})).json()["items"][0]
    assert card["is_favorite"] is True
    assert (await client.get(f"/api/v1/pets/{MURKA}")).json()["is_favorite"] is True
    other = (await client.get("/api/v1/pets", params={"q": "Айна"})).json()["items"][0]
    assert other["is_favorite"] is False

    mine = (await client.get("/api/v1/me/favorites")).json()
    assert [p["name"] for p in mine["items"]] == ["Мурка"]
    assert mine["total"] == 1

    await client.delete(f"/api/v1/pets/{MURKA}/favorite")
    assert (await client.get("/api/v1/me/favorites")).json()["total"] == 0


async def test_guest_sees_no_favorite_flags(client: AsyncClient) -> None:
    card = (await client.get("/api/v1/pets", params={"q": "Мурка"})).json()["items"][0]
    assert card["is_favorite"] is False


async def test_cannot_favorite_draft_or_unknown(client: AsyncClient) -> None:
    await login(client, "Асель")
    r = await client.put("/api/v1/pets/00000000-0000-0000-0000-000000000000/favorite")
    assert r.json()["error"]["code"] == "pet_not_found"


async def test_subscription_flow(client: AsyncClient) -> None:
    assert (await client.put(f"/api/v1/shelters/{TEPLY}/subscription")).status_code == 401
    await login(client, "Асель")
    r = await client.put(f"/api/v1/shelters/{TEPLY}/subscription")
    assert r.json() == {"subscribed": True, "subscribers_count": 1}

    profile = (await client.get(f"/api/v1/shelters/{TEPLY}")).json()
    assert (profile["subscribed"], profile["subscribers_count"]) == (True, 1)
    cards = (await client.get("/api/v1/curators", params={"type": "shelter"})).json()["items"]
    assert {c["name"]: c["subscribed"] for c in cards} == {
        "Тёплый угол": True,
        "Лапа помощи": False,
        "Дом для хвостиков": False,
    }
    mine = (await client.get("/api/v1/me/subscriptions")).json()
    assert [c["name"] for c in mine["items"]] == ["Тёплый угол"]

    r = await client.delete(f"/api/v1/shelters/{TEPLY}/subscription")
    assert r.json() == {"subscribed": False, "subscribers_count": 0}
