"""Кабинет куратора: черновик → фото → публикация → ручные статусы."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any
from urllib.parse import urlparse

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.seed import sid
from app.workers.media import process_pet_photo
from helpers import MemoryStorage, jpeg, login

pytestmark = pytest.mark.usefixtures("seeded")
TEPLY = str(sid("shelter:teply-ugol"))
NEW_PET = {
    "name": "Лиса",
    "kind": "cat",
    "sex": "female",
    "birth_date": "2024-04-01",
    "weight_kg": 3.25,
    "traits": ["calm", "calm", "apartment_ok"],
}


async def _add_photo(
    client: AsyncClient, db: AsyncSession, storage: MemoryStorage, settings: Settings, pet: str
) -> str:
    ticket = (
        await client.post(
            "/api/v1/media/uploads",
            json={
                "purpose": "pet_photo",
                "pet_id": pet,
                "content_type": "image/jpeg",
                "size": 1000,
            },
        )
    ).json()
    bucket, key = urlparse(ticket["upload_url"]).path.lstrip("/").split("/", 1)
    storage.objects[(bucket, key)] = (jpeg(), "image/jpeg")
    await client.post(f"/api/v1/media/uploads/{ticket['id']}/confirm")

    @asynccontextmanager
    async def factory() -> AsyncIterator[AsyncSession]:
        yield db

    await process_pet_photo(
        {"session_factory": factory, "storage": storage, "settings": settings}, ticket["id"]
    )
    done = (await client.get(f"/api/v1/media/uploads/{ticket['id']}")).json()
    return str(done["photo"]["id"])


async def test_draft_to_catalog(
    client: AsyncClient, db_session: AsyncSession, storage: MemoryStorage, settings: Settings
) -> None:
    await login(client, "Гульнара")
    r = await client.post("/api/v1/pets", json={**NEW_PET, "shelter_id": TEPLY})
    assert r.status_code == 201, r.text
    pet = r.json()
    assert (pet["status"], pet["city"], pet["weight_kg"]) == ("draft", "pavlodar", 3.2)
    assert pet["traits"] == ["calm", "apartment_ok"]
    assert pet["curator"]["name"] == "Тёплый угол"

    # Черновик не виден ни в каталоге, ни по прямой ссылке — только в кабинете
    assert (await client.get(f"/api/v1/pets/{pet['id']}")).status_code == 404
    mine = (await client.get("/api/v1/me/pets", params={"status": "draft"})).json()
    assert [p["name"] for p in mine["items"]] == ["Лиса"]

    r = await client.post(f"/api/v1/pets/{pet['id']}/publish")
    assert r.status_code == 422
    assert r.json()["error"] == {
        "code": "publish_incomplete",
        "message": "publish_incomplete",
        "fields": {"story": "required", "photos": "required"},
    }

    await client.patch(f"/api/v1/pets/{pet['id']}", json={"story": "Нашли в подъезде."})
    await _add_photo(client, db_session, storage, settings, pet["id"])
    published = (await client.post(f"/api/v1/pets/{pet['id']}/publish")).json()
    assert published["status"] == "seeking"
    assert published["cover_url"]
    names = [
        p["name"] for p in (await client.get("/api/v1/pets", params={"q": "Лиса"})).json()["items"]
    ]
    assert names == ["Лиса"]


async def test_verified_volunteer_creates_own_pet(client: AsyncClient) -> None:
    await login(client, "Дана", "volunteer")
    pet = (await client.post("/api/v1/pets", json=NEW_PET)).json()
    assert pet["curator"]["type"] == "volunteer"
    assert pet["city"] == "pavlodar"  # город волонтёра


@pytest.mark.parametrize(
    ("who", "role", "extra"),
    [
        ("Асель", "user", {}),  # обычный пользователь
        ("Дана", "volunteer", {"shelter_id": TEPLY}),  # не сотрудник приюта
    ],
)
async def test_only_curators_create_pets(
    client: AsyncClient, who: str, role: str, extra: dict[str, Any]
) -> None:
    await login(client, who, role)
    r = await client.post("/api/v1/pets", json={**NEW_PET, **extra})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "not_curator"


async def test_stranger_cannot_edit(client: AsyncClient) -> None:
    await login(client, "Дана", "volunteer")
    r = await client.patch(f"/api/v1/pets/{sid('pet:Мурка')}", json={"name": "Не Мурка"})
    assert r.json()["error"]["code"] == "not_curator"


async def test_required_fields_cannot_be_cleared(client: AsyncClient) -> None:
    await login(client, "Гульнара")
    r = await client.patch(f"/api/v1/pets/{sid('pet:Мурка')}", json={"name": None, "breed": None})
    assert r.status_code == 422
    assert r.json()["error"]["fields"] == {"name": "null_not_allowed"}


@pytest.mark.parametrize(
    ("pet", "status", "ok"),
    [
        ("pet:Мурка", "needs_foster", True),
        ("pet:Мурка", "treatment", True),
        ("pet:Мурка", "adopted", False),  # только через заявку
        ("pet:Мурка", "draft", False),
        ("pet:Тоша", "seeking", False),  # уже дома
    ],
)
async def test_manual_status_changes(client: AsyncClient, pet: str, status: str, ok: bool) -> None:
    await login(client, "Гульнара")
    r = await client.patch(f"/api/v1/pets/{sid(pet)}/status", json={"status": status})
    if ok:
        assert r.json()["status"] == status
    else:
        assert r.json()["error"]["code"] == "status_not_allowed"


async def test_photo_order_and_delete(
    client: AsyncClient, db_session: AsyncSession, storage: MemoryStorage, settings: Settings
) -> None:
    await login(client, "Гульнара")
    pet = str(sid("pet:Мурка"))
    first = await _add_photo(client, db_session, storage, settings, pet)
    second = await _add_photo(client, db_session, storage, settings, pet)

    r = await client.put(f"/api/v1/pets/{pet}/photos/order", json={"photo_ids": [second, first]})
    assert [p["id"] for p in r.json()] == [second, first]
    detail = (await client.get(f"/api/v1/pets/{pet}")).json()
    assert detail["cover_url"] == detail["photos"][0]["card_url"]
    assert detail["photos"][0]["id"] == second

    bad = await client.put(f"/api/v1/pets/{pet}/photos/order", json={"photo_ids": [second]})
    assert bad.json()["error"]["code"] == "photo_order_mismatch"

    assert (await client.delete(f"/api/v1/pets/{pet}/photos/{second}")).status_code == 204
    assert [p["id"] for p in (await client.get(f"/api/v1/pets/{pet}")).json()["photos"]] == [first]


async def test_only_drafts_are_deleted(client: AsyncClient) -> None:
    await login(client, "Гульнара")
    r = await client.delete(f"/api/v1/pets/{sid('pet:Мурка')}")
    assert r.json()["error"]["code"] == "pet_published"
    draft = (await client.post("/api/v1/pets", json={**NEW_PET, "shelter_id": TEPLY})).json()
    assert (await client.delete(f"/api/v1/pets/{draft['id']}")).status_code == 204
