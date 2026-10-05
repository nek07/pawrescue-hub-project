"""Статусы заявки и питомца меняются вместе (схема из бэкенд-гайда)."""

from collections.abc import Awaitable, Callable
from typing import Any

import pytest
from httpx import AsyncClient

from helpers import RecordingQueue, login

pytestmark = pytest.mark.usefixtures("seeded")

MakeClient = Callable[[], Awaitable[AsyncClient]]
FORM: dict[str, Any] = {
    "name": "Имя",
    "phone": "+77012345678",
    "city": "pavlodar",
    "housing": "house",
    "consent": True,
}


async def _murka(client: AsyncClient) -> dict[str, Any]:
    r = await client.get("/api/v1/pets", params={"q": "Мурка"})
    if r.json()["items"]:
        return dict(r.json()["items"][0])
    return {}


async def _status(client: AsyncClient, pet_id: str) -> str:
    return str((await client.get(f"/api/v1/pets/{pet_id}")).json()["status"])


@pytest.fixture
async def setup(make_client: MakeClient) -> tuple[AsyncClient, AsyncClient, AsyncClient, str]:
    asel, aigerim, staff = await make_client(), await make_client(), await make_client()
    await login(asel, "Асель")
    await login(aigerim, "Айгерим")
    await login(staff, "Гульнара")
    pet_id = str((await _murka(asel))["id"])
    return asel, aigerim, staff, pet_id


async def _apply(client: AsyncClient, pet_id: str) -> str:
    r = await client.post(f"/api/v1/pets/{pet_id}/applications", json=FORM)
    assert r.status_code == 201, r.text
    return str(r.json()["id"])


async def _set(client: AsyncClient, app_id: str, status: str) -> Any:
    return await client.patch(f"/api/v1/applications/{app_id}", json={"status": status})


async def test_full_adoption_path(
    setup: tuple[AsyncClient, AsyncClient, AsyncClient, str], queue: RecordingQueue
) -> None:
    asel, aigerim, staff, pet_id = setup
    first = await _apply(asel, pet_id)
    second = await _apply(aigerim, pet_id)

    assert (await _set(staff, first, "meeting")).json()["status"] == "meeting"
    r = await _set(staff, first, "approved")
    assert r.json()["status"] == "approved"
    # Одобрили — питомец забронирован, вторая заявка закрыта, из каталога пропал
    assert await _status(asel, pet_id) == "reserved"
    assert (await aigerim.get(f"/api/v1/applications/{second}")).json()["status"] == "rejected"
    assert await _murka(asel) == {}

    assert (await _set(staff, first, "completed")).json()["status"] == "completed"
    assert await _status(asel, pet_id) == "adopted"

    status_jobs = [args[0] for job, args in queue.jobs if job == "notify_application_status"]
    assert status_jobs == [first, first, second, first]


async def test_withdrawing_approved_application_frees_pet(
    setup: tuple[AsyncClient, AsyncClient, AsyncClient, str],
) -> None:
    asel, _, staff, pet_id = setup
    app_id = await _apply(asel, pet_id)
    await _set(staff, app_id, "approved")
    r = await _set(asel, app_id, "withdrawn")
    assert r.json()["status"] == "withdrawn"
    assert await _status(asel, pet_id) == "seeking"
    # После отзыва можно подать новую заявку
    await _apply(asel, pet_id)


@pytest.mark.parametrize(
    ("actor", "status"),
    [
        ("applicant", "approved"),  # заявитель не одобряет сам себя
        ("curator", "withdrawn"),  # отозвать может только заявитель
        ("curator", "completed"),  # нельзя завершить без одобрения
    ],
)
async def test_forbidden_transitions(
    setup: tuple[AsyncClient, AsyncClient, AsyncClient, str], actor: str, status: str
) -> None:
    asel, _, staff, pet_id = setup
    app_id = await _apply(asel, pet_id)
    r = await _set(asel if actor == "applicant" else staff, app_id, status)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "transition_not_allowed"


async def test_rejected_application_is_final(
    setup: tuple[AsyncClient, AsyncClient, AsyncClient, str],
) -> None:
    asel, _, staff, pet_id = setup
    app_id = await _apply(asel, pet_id)
    await _set(staff, app_id, "rejected")
    detail = (await asel.get(f"/api/v1/applications/{app_id}")).json()
    assert detail["allowed_transitions"] == []
    assert (await _set(staff, app_id, "approved")).status_code == 409
