from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cities import City
from app.modules.shelters.models import Shelter
from app.modules.users.models import User, UserRole

CURATORS = "/api/v1/curators"

pytestmark = pytest.mark.usefixtures("seeded")


async def test_lists_shelters_and_volunteers_with_counts(client: AsyncClient) -> None:
    body = (await client.get(CURATORS)).json()
    by_name = {c["name"]: c for c in body["items"]}
    assert body["total"] == 6  # «Найдено: 6 участников»
    teply = by_name["Тёплый угол"]
    assert (teply["type"], teply["city"]) == ("shelter", "pavlodar")
    # 8 в каталоге (Мурка … Малыш) и Тоша дома
    assert (teply["seeking_count"], teply["adopted_count"]) == (8, 1)
    assert (by_name["Дана"]["seeking_count"], by_name["Дана"]["adopted_count"]) == (1, 1)
    # сортировка: у кого больше питомцев ищут дом — выше
    assert body["items"][0]["name"] == "Тёплый угол"


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"type": "shelter"}, {"Тёплый угол", "Лапа помощи", "Дом для хвостиков"}),
        ({"type": "volunteer", "city": "pavlodar"}, {"Дана", "Асем"}),
        ({"q": "лапа"}, {"Лапа помощи"}),
    ],
)
async def test_filters(client: AsyncClient, params: dict[str, str], expected: set[str]) -> None:
    body = (await client.get(CURATORS, params=params)).json()
    assert {c["name"] for c in body["items"]} == expected


async def test_unverified_are_hidden(client: AsyncClient, db_session: AsyncSession) -> None:
    db_session.add_all(
        [
            Shelter(name="Новый приют", city=City.PAVLODAR),
            User(name="Новичок", role=UserRole.VOLUNTEER, city=City.PAVLODAR),
            User(
                name="Заблокированный",
                role=UserRole.VOLUNTEER,
                verified_at=datetime.now(UTC),
                blocked_at=datetime.now(UTC),
            ),
        ]
    )
    await db_session.flush()
    names = {c["name"] for c in (await client.get(CURATORS)).json()["items"]}
    assert {"Новый приют", "Новичок", "Заблокированный"}.isdisjoint(names)
