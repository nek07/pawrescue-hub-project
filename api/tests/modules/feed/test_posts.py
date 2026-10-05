"""Лента из макета: категории, права на публикацию, комментарии и лайки."""

from collections.abc import Awaitable, Callable
from typing import Any

import pytest
from httpx import AsyncClient

from app.seed import sid
from helpers import login

pytestmark = pytest.mark.usefixtures("seeded")
MakeClient = Callable[[], Awaitable[AsyncClient]]
POSTS = "/api/v1/posts"


async def _titles(client: AsyncClient, **params: Any) -> list[str]:
    body = (await client.get(POSTS, params=params)).json()
    return [p["title"] for p in body["items"]]


async def test_guest_reads_feed(client: AsyncClient) -> None:
    body = (await client.get(POSTS)).json()
    assert body["total"] == 5
    tosha = body["items"][0]
    assert tosha["title"] == "Тоша уехал домой"
    assert tosha["author"]["type"] == "shelter"
    assert tosha["pet"]["status"] == "adopted"  # бейдж «Нашёл дом» рисует фронт
    assert tosha["comments_count"] == 3
    preview = tosha["comments_preview"]
    assert [c["author"]["name"] for c in preview] == ["Асель К.", "Тёплый угол", "Айгерим"]
    assert preview[1]["parent_id"] == preview[0]["id"]  # ответ приюта
    assert tosha["liked_by_me"] is False


@pytest.mark.parametrize(
    ("category", "expected"),
    [
        ("help", {"Ветру нужна передержка", "Ищу передержку для двух щенков"}),
        ("owners", {"Месяц дома: Бусинка"}),
        (
            "curators",
            {"Тоша уехал домой", "Ветру нужна передержка", "Ищу передержку для двух щенков",
             "Первая зима Жулдыз"},
        ),
    ],
)  # fmt: skip
async def test_categories(client: AsyncClient, category: str, expected: set[str]) -> None:
    assert set(await _titles(client, category=category)) == expected


async def test_shelter_and_pet_feeds(client: AsyncClient) -> None:
    teply = str(sid("shelter:teply-ugol"))
    assert set(await _titles(client, shelter_id=teply)) == {
        "Тоша уехал домой",
        "Ветру нужна передержка",
    }
    assert await _titles(client, pet_id=str(sid("pet:Ветер"))) == ["Ветру нужна передержка"]


async def test_curator_posts_update_about_own_pet(client: AsyncClient) -> None:
    await login(client, "Гульнара")
    r = await client.post(
        POSTS,
        json={"kind": "update", "pet_id": str(sid("pet:Мурка")), "body": "Мурку стерилизовали."},
    )
    assert r.status_code == 201, r.text
    post = r.json()
    # Сотрудник пишет о питомце приюта — пост автоматически от имени приюта
    assert post["author"] == {
        "type": "shelter",
        "id": str(sid("shelter:teply-ugol")),
        "name": "Тёплый угол",
        "avatar_url": None,
        "verified": True,
        "city": "pavlodar",
    }
    pet_updates = await _titles(client, pet_id=str(sid("pet:Мурка")), kind="update")
    assert len(pet_updates) == 1


@pytest.mark.parametrize(
    ("who", "role", "payload"),
    [
        ("Асель", "user", {"kind": "update", "pet_id": "pet:Мурка"}),  # не куратор
        ("Асель", "user", {"kind": "help"}),  # просить помощь — только кураторы
        ("Асель", "user", {"kind": "story", "pet_id": "pet:Мурка"}),  # не забирала Мурку
        ("Асель", "user", {"kind": "story"}),  # история хозяина — о своём питомце
        ("Дана", "volunteer", {"kind": "update", "pet_id": "pet:Мурка"}),  # чужой питомец
        ("Дана", "volunteer", {"kind": "help", "shelter_id": "shelter:teply-ugol"}),
    ],
)
async def test_publishing_rules(
    client: AsyncClient, who: str, role: str, payload: dict[str, str]
) -> None:
    await login(client, who, role)
    body = {k: str(sid(v)) if k.endswith("_id") else v for k, v in payload.items()}
    r = await client.post(POSTS, json={**body, "body": "Текст"})
    assert r.status_code == 403, r.text
    assert r.json()["error"]["code"] == "post_forbidden"


async def test_new_owner_can_tell_story_after_adoption(make_client: MakeClient) -> None:
    asel, staff = await make_client(), await make_client()
    await login(asel, "Асель")
    await login(staff, "Гульнара")
    pet = str(sid("pet:Айна"))
    form = {
        "name": "Асель",
        "phone": "+77012345678",
        "city": "pavlodar",
        "housing": "flat",
        "consent": True,
    }
    app_id = (await asel.post(f"/api/v1/pets/{pet}/applications", json=form)).json()["id"]
    story = {"kind": "story", "pet_id": pet, "title": "Неделя дома", "body": "Айна освоилась!"}
    assert (await asel.post(POSTS, json=story)).status_code == 403  # ещё не забрала

    for status in ("approved", "completed"):
        await staff.patch(f"/api/v1/applications/{app_id}", json={"status": status})
    r = await asel.post(POSTS, json=story)
    assert r.status_code == 201
    assert r.json()["author"]["type"] == "owner"
    assert "Неделя дома" in await _titles(asel, category="owners")


async def test_comments_one_level_and_shelter_reply(make_client: MakeClient) -> None:
    asel, staff = await make_client(), await make_client()
    await login(asel, "Асель")
    await login(staff, "Гульнара")
    post = str(sid("post:tosha"))
    url = f"{POSTS}/{post}/comments"

    first = (await asel.post(url, json={"body": "Как он сейчас?"})).json()
    reply = await staff.post(
        url, json={"body": "Отлично!", "parent_id": first["id"], "as_shelter": True}
    )
    assert reply.status_code == 201
    assert reply.json()["author"]["name"] == "Тёплый угол"

    deeper = await asel.post(url, json={"body": "Ура", "parent_id": reply.json()["id"]})
    assert deeper.json()["error"]["code"] == "reply_depth"
    as_shelter = await asel.post(url, json={"body": "Я приют", "as_shelter": True})
    assert as_shelter.json()["error"]["code"] == "post_forbidden"

    page = (await asel.get(url)).json()
    # Верхний уровень по порядку, ответы вложены
    assert [c["body"] for c in page["items"]][-1] == "Как он сейчас?"
    assert [r["body"] for r in page["items"][-1]["replies"]] == ["Отлично!"]
    assert page["total"] == 3  # 2 из сида + новый (ответы не считаются)


async def test_likes_are_idempotent(client: AsyncClient) -> None:
    await login(client, "Асель")
    url = f"{POSTS}/{sid('post:tosha')}/like"
    assert (await client.put(url)).json() == {"liked": True, "likes_count": 1}
    assert (await client.put(url)).json() == {"liked": True, "likes_count": 1}
    post = (await client.get(f"{POSTS}/{sid('post:tosha')}")).json()
    assert post["liked_by_me"] is True
    assert post["likes_count"] == 1
    assert (await client.delete(url)).json() == {"liked": False, "likes_count": 0}

    comment = f"/api/v1/comments/{sid('comment:tosha-3')}/like"
    assert (await client.put(comment)).json()["likes_count"] == 1


async def test_guest_cannot_like_or_comment(client: AsyncClient) -> None:
    assert (await client.put(f"{POSTS}/{sid('post:tosha')}/like")).status_code == 401
    r = await client.post(f"{POSTS}/{sid('post:tosha')}/comments", json={"body": "Привет"})
    assert r.status_code == 401


async def test_author_deletes_own_comment_only(make_client: MakeClient) -> None:
    asel, other = await make_client(), await make_client()
    await login(asel, "Асель")
    await login(other, "Айгерим")
    comment = (
        await asel.post(f"{POSTS}/{sid('post:tosha')}/comments", json={"body": "Опечатка"})
    ).json()
    assert (await other.delete(f"/api/v1/comments/{comment['id']}")).status_code == 403
    assert (await asel.delete(f"/api/v1/comments/{comment['id']}")).status_code == 204


async def test_validation_codes(client: AsyncClient) -> None:
    await login(client, "Гульнара")
    r = await client.post(POSTS, json={"kind": "help", "body": "   "})
    assert r.json()["error"]["fields"] == {"body": "post_empty"}
