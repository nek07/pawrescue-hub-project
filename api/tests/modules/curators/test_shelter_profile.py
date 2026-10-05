import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cities import City
from app.modules.shelters.models import Shelter

pytestmark = pytest.mark.usefixtures("seeded")


async def test_teply_ugol_profile(client: AsyncClient) -> None:
    curators = (await client.get("/api/v1/curators", params={"q": "Тёплый"})).json()
    shelter_id = curators["items"][0]["id"]
    r = await client.get(f"/api/v1/shelters/{shelter_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["address"] == "ул. Луговая, 16"
    assert body["visit_hours"] == "Сб–Вс, 11:00–16:00, по записи"
    assert (body["seeking_count"], body["adopted_count"]) == (8, 1)
    assert body["verified"] is True

    pets = (await client.get("/api/v1/pets", params={"shelter_id": shelter_id, "limit": 50})).json()
    assert pets["total"] == 8


async def test_unverified_or_unknown_shelter_is_404(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    hidden = Shelter(name="Непроверенный", city=City.ALMATY)
    db_session.add(hidden)
    await db_session.flush()
    for target in (hidden.id, uuid.uuid4()):
        r = await client.get(f"/api/v1/shelters/{target}")
        assert r.status_code == 404
        assert r.json()["error"]["code"] == "shelter_not_found"
