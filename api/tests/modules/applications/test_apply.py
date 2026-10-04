"""Сценарий из макета: Асель подаёт заявку на Мурку, «Тёплый угол» её ведёт."""

from collections.abc import Awaitable, Callable
from typing import Any

import pytest
from httpx import AsyncClient

from helpers import RecordingQueue, login

VALID: dict[str, Any] = {
    "name": "Асель",
    "phone": "+7 701 234 56 78",
    "city": "pavlodar",
    "housing": "flat",
    "household": ["kids"],
    "about": "Дочке восемь, она давно просит кошку.",
    "consent": True,
}

pytestmark = pytest.mark.usefixtures("seeded")

MakeClient = Callable[[], Awaitable[AsyncClient]]


async def _pet_id(client: AsyncClient, name: str) -> str:
    r = await client.get("/api/v1/pets", params={"q": name})
    return str(r.json()["items"][0]["id"])


async def _apply(client: AsyncClient, pet: str) -> Any:
    return await client.post(f"/api/v1/pets/{pet}/applications", json=VALID)


async def test_guest_must_login(client: AsyncClient) -> None:
    r = await _apply(client, await _pet_id(client, "Мурка"))
    assert r.status_code == 401


async def test_apply_creates_application_and_notifies(
    client: AsyncClient, queue: RecordingQueue
) -> None:
    await login(client, "Асель")
    r = await _apply(client, await _pet_id(client, "Мурка"))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "sent"
    assert body["phone"] == "+77012345678"  # нормализован, заявитель видит свой
    assert body["pet"]["name"] == "Мурка"
    assert body["viewer_role"] == "applicant"
    assert body["allowed_transitions"] == ["withdrawn"]
    assert queue.jobs == [("notify_new_application", (body["id"],))]


async def test_user_cannot_apply_twice(client: AsyncClient) -> None:
    await login(client, "Асель")
    pet = await _pet_id(client, "Мурка")
    await _apply(client, pet)
    r = await _apply(client, pet)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "application_exists"


async def test_pet_on_treatment_is_not_available(client: AsyncClient) -> None:
    await login(client, "Асель")
    r = await _apply(client, await _pet_id(client, "Граф"))
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "pet_not_available"


async def test_curator_cannot_apply_for_own_pet(client: AsyncClient) -> None:
    await login(client, "Дана", "volunteer")
    r = await _apply(client, await _pet_id(client, "Персик"))
    assert r.json()["error"]["code"] == "own_pet"


async def test_unknown_pet(client: AsyncClient) -> None:
    await login(client, "Асель")
    r = await _apply(client, "00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "pet_not_found"


async def test_invalid_form_uses_translation_keys(client: AsyncClient) -> None:
    await login(client, "Асель")
    pet = await _pet_id(client, "Мурка")
    r = await client.post(
        f"/api/v1/pets/{pet}/applications", json={**VALID, "phone": "+7 701 23", "consent": False}
    )
    assert r.status_code == 422
    assert r.json()["error"]["fields"] == {
        "phone": "phone_incomplete",
        "consent": "consent_required",
    }


async def test_curator_sees_phone_only_after_approval(make_client: MakeClient) -> None:
    asel, staff = await make_client(), await make_client()
    await login(asel, "Асель")
    await login(staff, "Гульнара")  # сотрудник «Тёплого угла» из сида
    app_id = (await _apply(asel, await _pet_id(asel, "Мурка"))).json()["id"]

    incoming = (await staff.get("/api/v1/applications/incoming")).json()
    assert incoming["total"] == 1
    item = incoming["items"][0]
    assert item["phone"] is None
    assert item["viewer_role"] == "curator"
    assert item["allowed_transitions"] == ["approved", "meeting", "rejected"]

    r = await staff.patch(f"/api/v1/applications/{app_id}", json={"status": "approved"})
    assert r.json()["phone"] == "+77012345678"


async def test_stranger_cannot_see_or_change_application(make_client: MakeClient) -> None:
    asel, stranger = await make_client(), await make_client()
    await login(asel, "Асель")
    await login(stranger, "Ерлан", "volunteer")  # куратор, но не этого питомца
    app_id = (await _apply(asel, await _pet_id(asel, "Мурка"))).json()["id"]

    assert (await stranger.get(f"/api/v1/applications/{app_id}")).status_code == 404
    r = await stranger.patch(f"/api/v1/applications/{app_id}", json={"status": "approved"})
    assert r.status_code == 404
    assert (await stranger.get("/api/v1/applications/incoming")).json()["total"] == 0


async def test_my_applications(client: AsyncClient) -> None:
    await login(client, "Асель")
    await _apply(client, await _pet_id(client, "Мурка"))
    await _apply(client, await _pet_id(client, "Айна"))
    body = (await client.get("/api/v1/applications/me")).json()
    assert body["total"] == 2
    assert {a["pet"]["name"] for a in body["items"]} == {"Айна", "Мурка"}


async def test_concurrent_double_submit_is_409_not_500(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Второй запрос проскочил проверку exists_active одновременно с первым —
    # дубль ловит только уникальный индекс в БД.
    from app.modules.applications.repository import ApplicationRepository

    async def never_exists(self: ApplicationRepository, **_: Any) -> bool:
        return False

    monkeypatch.setattr(ApplicationRepository, "exists_active", never_exists)
    await login(client, "Асель")
    pet = await _pet_id(client, "Мурка")
    assert (await _apply(client, pet)).status_code == 201
    r = await _apply(client, pet)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "application_exists"
    assert (await client.get("/api/v1/applications/me")).json()["total"] == 1
