"""GET /pets на сид-данных из макета (сегодня = 2026-10-04)."""

from typing import Any

import pytest
from httpx import AsyncClient

PETS = "/api/v1/pets"
PAVLODAR_CATALOG = [
    "Мурка", "Айна", "Граф", "Тыква", "Майя", "Персик",
    "Снежок", "Барсик", "Лорд", "Ветер", "Малыш",
]  # fmt: skip

pytestmark = pytest.mark.usefixtures("seeded")


async def _names(client: AsyncClient, **params: Any) -> list[str]:
    r = await client.get(PETS, params={"limit": 100, **params})
    assert r.status_code == 200, r.text
    return [p["name"] for p in r.json()["items"]]


async def test_pavlodar_catalog_matches_mockup(client: AsyncClient) -> None:
    r = await client.get(PETS, params={"city": "pavlodar", "limit": 100})
    body = r.json()
    # «Найдено: 11 питомцев · Павлодар», порядок «Сначала новые»
    assert body["total"] == 11
    assert [p["name"] for p in body["items"]] == PAVLODAR_CATALOG
    assert body["next_cursor"] is None


async def test_card_shape(client: AsyncClient) -> None:
    r = await client.get(PETS, params={"q": "Мурка"})
    murka = r.json()["items"][0]
    assert murka["status"] == "seeking"
    assert murka["sterilized"] is True
    assert murka["vaccinated"] is True
    assert murka["curator"] == {
        "type": "shelter",
        "id": murka["curator"]["id"],
        "name": "Тёплый угол",
        "verified": True,
    }


async def test_volunteer_curator(client: AsyncClient) -> None:
    r = await client.get(PETS, params={"q": "Персик"})
    assert r.json()["items"][0]["curator"]["type"] == "volunteer"
    assert r.json()["items"][0]["curator"]["name"] == "Дана"


async def test_adopted_and_draft_are_hidden(client: AsyncClient) -> None:
    names = await _names(client)
    assert {"Тоша", "Бусинка", "Жулдыз"}.isdisjoint(names)


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"kind": "dog", "city": "pavlodar"}, {"Лорд", "Ветер", "Малыш"}),
        ({"city": "astana"}, {"Сабыр"}),
        ({"needs_foster": "true"}, {"Ветер", "Снежок"}),
        ({"sterilized": "true"}, {"Мурка", "Снежок"}),
        ({"good_with_kids": "true"}, {"Мурка", "Айна"}),
        ({"age": "lt1"}, {"Малыш"}),
        ({"age": "gt5"}, {"Лорд"}),
        ({"kind": "cat", "age": "1to5", "city": "almaty"}, {"Кнопка"}),
    ],
)
async def test_filters(client: AsyncClient, params: dict[str, str], expected: set[str]) -> None:
    assert set(await _names(client, **params)) == expected


async def test_false_flag_does_not_filter(client: AsyncClient) -> None:
    assert len(await _names(client, city="pavlodar", sterilized="false")) == 11


async def test_age_buckets_cover_catalog_without_overlap(client: AsyncClient) -> None:
    buckets = [set(await _names(client, age=a)) for a in ("lt1", "1to5", "gt5")]
    assert sum(len(b) for b in buckets) == len(set().union(*buckets))
    assert set().union(*buckets) == set(await _names(client))


@pytest.mark.parametrize(
    ("q", "expected"),
    [
        ("Мур", {"Мурка"}),  # префикс имени
        ("подъезды", {"Мурка"}),  # морфология по истории
        ("100%_", set()),  # спецсимволы LIKE экранированы
    ],
)
async def test_search(client: AsyncClient, q: str, expected: set[str]) -> None:
    assert set(await _names(client, q=q)) == expected


async def test_sort_old_reverses_order(client: AsyncClient) -> None:
    names = await _names(client, city="pavlodar", sort="old")
    assert names == list(reversed(PAVLODAR_CATALOG))


async def test_cursor_walks_whole_catalog(client: AsyncClient) -> None:
    seen: list[str] = []
    cursor: str | None = None
    while True:
        params = {"city": "pavlodar", "limit": 4} | ({"cursor": cursor} if cursor else {})
        body = (await client.get(PETS, params=params)).json()
        assert body["total"] == 11
        seen += [p["name"] for p in body["items"]]
        cursor = body["next_cursor"]
        if cursor is None:
            break
    assert seen == PAVLODAR_CATALOG


@pytest.mark.parametrize(
    ("params", "field", "code"),
    [
        ({"kind": "bird"}, "kind", "enum"),
        ({"age": "old"}, "age", "enum"),
        ({"limit": 0}, "limit", "greater_than_equal"),
        ({"limit": 101}, "limit", "less_than_equal"),
    ],
)
async def test_invalid_filters(
    client: AsyncClient, params: dict[str, Any], field: str, code: str
) -> None:
    r = await client.get(PETS, params=params)
    assert r.status_code == 422
    assert r.json()["error"]["fields"] == {field: code}


async def test_invalid_cursor(client: AsyncClient) -> None:
    r = await client.get(PETS, params={"cursor": "garbage"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "invalid_cursor"
