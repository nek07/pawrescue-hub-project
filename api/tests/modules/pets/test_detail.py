import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.pets.models import Pet, PetPhoto, PetStatus
from app.seed import sid

pytestmark = pytest.mark.usefixtures("seeded")


async def _id(client: AsyncClient, name: str, **params: str) -> str:
    r = await client.get("/api/v1/pets", params={"q": name, **params})
    return str(r.json()["items"][0]["id"])


async def test_murka_page_matches_mockup(client: AsyncClient) -> None:
    r = await client.get(f"/api/v1/pets/{await _id(client, 'Мурка')}")
    assert r.status_code == 200
    murka = r.json()
    assert murka["sex"] == "female"
    assert murka["weight_kg"] == 3.8
    assert murka["vaccinated_at"] == "2026-08-14"
    assert murka["chip"] == "planned"
    assert murka["litter_trained"] is True
    assert murka["story_title"] == "Её нашли у подъезда в феврале"
    assert murka["traits"] == ["affectionate", "good_with_kids", "calm", "no_dogs", "apartment_ok"]
    assert murka["curator"]["name"] == "Тёплый угол"
    # «Тоже ищут дом»: кошки из Павлодара, без самой Мурки
    similar = [p["name"] for p in murka["similar"]]
    assert len(similar) == 4
    assert "Мурка" not in similar
    assert all(p["kind"] == "cat" and p["city"] == "pavlodar" for p in murka["similar"])


async def test_photos_are_ordered_and_first_is_cover(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    pet_id = uuid.UUID(await _id(client, "Мурка"))
    db_session.add_all(
        [
            PetPhoto(pet_id=pet_id, url="https://cdn.test/2.webp", position=2),
            PetPhoto(pet_id=pet_id, url="https://cdn.test/1.webp", position=1),
        ]
    )
    await db_session.flush()
    murka = (await client.get(f"/api/v1/pets/{pet_id}")).json()
    assert [p["url"] for p in murka["photos"]] == [
        "https://cdn.test/1.webp",
        "https://cdn.test/2.webp",
    ]
    assert murka["cover_url"] == "https://cdn.test/1.webp"
    card = (await client.get("/api/v1/pets", params={"q": "Мурка"})).json()["items"][0]
    assert card["cover_url"] == "https://cdn.test/1.webp"


async def test_adopted_pet_page_is_still_available(client: AsyncClient) -> None:
    # Тоша уже дома: в каталоге его нет, но ссылка из ленты должна открываться
    assert (await client.get("/api/v1/pets", params={"q": "Тоша"})).json()["total"] == 0
    r = await client.get(f"/api/v1/pets/{sid('pet:Тоша')}")
    assert r.status_code == 200
    assert r.json()["status"] == "adopted"


async def test_draft_and_unknown_are_404(client: AsyncClient, db_session: AsyncSession) -> None:
    pet_id = await _id(client, "Айна")
    await db_session.execute(update(Pet).where(Pet.name == "Айна").values(status=PetStatus.DRAFT))
    for target in (pet_id, str(uuid.uuid4())):
        r = await client.get(f"/api/v1/pets/{target}")
        assert r.status_code == 404
        assert r.json()["error"]["code"] == "pet_not_found"


async def test_catalog_by_curator(client: AsyncClient) -> None:
    volunteer_id = (await client.get("/api/v1/pets", params={"q": "Персик"})).json()["items"][0][
        "curator"
    ]["id"]
    r = await client.get("/api/v1/pets", params={"volunteer_id": volunteer_id})
    assert {p["name"] for p in r.json()["items"]} == {"Персик"}
