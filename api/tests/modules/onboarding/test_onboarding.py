"""Подключение приюта/волонтёра и решения модератора."""

from collections.abc import Awaitable, Callable
from typing import Any
from urllib.parse import urlparse

import pytest
from httpx import AsyncClient

from app.seed import sid
from helpers import MemoryStorage, login

pytestmark = pytest.mark.usefixtures("seeded")
MakeClient = Callable[[], Awaitable[AsyncClient]]
ON = "/api/v1/onboarding"
PROFILE = {
    "city": "pavlodar",
    "contact_phone": "8 701 234 56 78",
    "about": "Небольшой приют на окраине.",
    "address": "ул. Садовая, 3",
    "visit_hours": "Сб, 12:00–15:00",
    "recommender": "Тёплый угол",
}


async def _doc(
    client: AsyncClient,
    storage: MemoryStorage,
    kind: str,
    *,
    data: bytes = b"%PDF-1.7",
    declared: int | None = None,
) -> dict[str, Any]:
    content_type = "application/pdf" if kind == "registration" else "image/jpeg"
    ticket = (
        await client.post(
            f"{ON}/me/documents",
            json={
                "kind": kind,
                "filename": "file",
                "content_type": content_type,
                "size": declared or len(data),
            },
        )
    ).json()
    bucket, key = urlparse(ticket["upload_url"]).path.lstrip("/").split("/", 1)
    assert bucket == "shelter-docs"  # приватный бакет, не pet-photos
    storage.objects[(bucket, key)] = (data, content_type)
    r = await client.post(f"{ON}/me/documents/{ticket['id']}/confirm")
    return dict(r.json())


async def _ready_shelter(client: AsyncClient, storage: MemoryStorage) -> None:
    await client.post(ON, json={"type": "shelter", "name": "Добрые лапы"})
    await client.patch(f"{ON}/me", json=PROFILE)
    await _doc(client, storage, "registration")
    for _ in range(3):
        await _doc(client, storage, "territory_photo", data=b"jpeg")


async def test_shelter_onboarding_to_verified_shelter(
    make_client: MakeClient, storage: MemoryStorage
) -> None:
    owner, mod = await make_client(), await make_client()
    await login(owner, "Ерке")
    await login(mod, "Модератор", "moderator")

    r = await owner.post(ON, json={"type": "shelter", "name": "Добрые лапы"})
    assert r.status_code == 201
    assert set(r.json()["missing"]) == {
        "city", "contact_phone", "about", "address", "registration", "territory_photos",
    }  # fmt: skip
    assert (await owner.post(f"{ON}/me/submit")).json()["error"]["code"] == "onboarding_incomplete"
    assert (await owner.post(ON, json={"type": "shelter", "name": "Ещё"})).status_code == 409

    await owner.patch(f"{ON}/me", json=PROFILE)
    await _doc(owner, storage, "registration")
    for _ in range(3):
        await _doc(owner, storage, "territory_photo", data=b"jpeg")
    me = (await owner.get(f"{ON}/me")).json()
    assert me["missing"] == []
    assert me["contact_phone"] == "+77012345678"
    assert all(d["view_url"] is None for d in me["documents"])  # заявителю ссылки не нужны

    submitted = (await owner.post(f"{ON}/me/submit")).json()
    assert submitted["status"] == "submitted"
    assert (await owner.patch(f"{ON}/me", json={"about": "x"})).json()["error"][
        "code"
    ] == "onboarding_locked"

    queue = (await mod.get("/api/v1/moderation/onboarding")).json()
    assert [r["name"] for r in queue["items"]] == ["Добрые лапы"]
    review = (await mod.get(f"/api/v1/moderation/onboarding/{submitted['id']}")).json()
    assert review["applicant"]["name"] == "Ерке"
    assert all("X-Amz-Expires=300" in d["view_url"] for d in review["documents"])

    approved = (await mod.post(f"/api/v1/moderation/onboarding/{submitted['id']}/approve")).json()
    assert approved["status"] == "approved"
    shelter_id = approved["shelter_id"]

    profile = (await owner.get(f"/api/v1/shelters/{shelter_id}")).json()
    assert (profile["name"], profile["verified"], profile["address"]) == (
        "Добрые лапы", True, "ул. Садовая, 3",
    )  # fmt: skip
    # Автор заявки — администратор приюта: может завести анкету
    pet = {
        "name": "Шарик",
        "kind": "dog",
        "sex": "male",
        "birth_date": "2023-01-01",
        "shelter_id": shelter_id,
    }
    assert (await owner.post("/api/v1/pets", json=pet)).status_code == 201
    again = await mod.post(f"/api/v1/moderation/onboarding/{submitted['id']}/approve")
    assert again.json()["error"]["code"] == "onboarding_not_submitted"


async def test_volunteer_onboarding_and_rejection(
    make_client: MakeClient, storage: MemoryStorage
) -> None:
    person, mod = await make_client(), await make_client()
    me = await login(person, "Алия")
    await login(mod, "Модератор", "moderator")
    await person.post(ON, json={"type": "volunteer", "name": "Алия", "city": "astana"})
    await person.patch(
        f"{ON}/me", json={"contact_phone": "+77011112233", "about": "Беру на передержку"}
    )
    request = (await person.post(f"{ON}/me/submit")).json()  # волонтёру документы не обязательны

    rejected = await mod.post(
        f"/api/v1/moderation/onboarding/{request['id']}/reject",
        json={"reason": "Нужен видеозвонок"},
    )
    assert rejected.json()["reject_reason"] == "Нужен видеозвонок"
    assert (await person.get("/api/v1/auth/me")).json()["verified"] is False

    # После отказа можно подать заново и пройти
    await person.post(ON, json={"type": "volunteer", "name": "Алия", "city": "astana"})
    await person.patch(f"{ON}/me", json={"contact_phone": "+77011112233", "about": "Созвонились"})
    request = (await person.post(f"{ON}/me/submit")).json()
    await mod.post(f"/api/v1/moderation/onboarding/{request['id']}/approve")
    after = (await person.get("/api/v1/auth/me")).json()
    assert (after["id"], after["role"], after["verified"]) == (me["id"], "volunteer", True)


async def test_documents_rules(client: AsyncClient, storage: MemoryStorage) -> None:
    await login(client, "Ерке")
    await client.post(ON, json={"type": "shelter", "name": "Добрые лапы"})
    pdf_photo = await client.post(
        f"{ON}/me/documents",
        json={
            "kind": "territory_photo",
            "filename": "a.pdf",
            "content_type": "application/pdf",
            "size": 10,
        },
    )
    assert pdf_photo.json()["error"]["fields"] == {"content_type": "image_required"}
    # Заявили маленький файл, а по ссылке залили больше лимита
    big = await _doc(
        client, storage, "registration", data=b"x" * (20 * 1024 * 1024 + 1), declared=10
    )
    assert big["error"]["code"] == "file_too_large"
    doc = await _doc(client, storage, "registration")
    assert (await client.delete(f"{ON}/me/documents/{doc['id']}")).status_code == 204
    assert storage.objects == {}


async def test_only_moderators_moderate(client: AsyncClient) -> None:
    await login(client, "Асель")
    for r in (
        await client.get("/api/v1/moderation/onboarding"),
        await client.put(f"/api/v1/moderation/posts/{sid('post:tosha')}/hidden"),
        await client.put(f"/api/v1/moderation/users/{sid('user:dana')}/blocked"),
    ):
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "forbidden"


async def test_hide_content_block_user_unpublish_pet(make_client: MakeClient) -> None:
    mod, dana = await make_client(), await make_client()
    await login(mod, "Модератор", "moderator")
    await login(dana, "Дана", "volunteer")

    tosha = str(sid("post:tosha"))
    await mod.put(f"/api/v1/moderation/posts/{tosha}/hidden")
    assert (await mod.get(f"/api/v1/posts/{tosha}")).status_code == 404
    await mod.delete(f"/api/v1/moderation/posts/{tosha}/hidden")
    comment = str(sid("comment:tosha-3"))
    await mod.put(f"/api/v1/moderation/comments/{comment}/hidden")
    assert (await mod.get(f"/api/v1/posts/{tosha}")).json()["comments_count"] == 2

    murka = str(sid("pet:Мурка"))
    assert (await mod.post(f"/api/v1/moderation/pets/{murka}/unpublish")).json()[
        "status"
    ] == "draft"
    assert (await mod.get(f"/api/v1/pets/{murka}")).status_code == 404

    await mod.put(f"/api/v1/moderation/users/{sid('user:dana')}/blocked")
    assert (await dana.get("/api/v1/auth/me")).status_code == 401  # сессии больше не работают
