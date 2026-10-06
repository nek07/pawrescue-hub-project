"""Панель модератора: весь контент со скрытым, удаление, лайки, пользователи."""

from collections.abc import Awaitable, Callable
from typing import Any

import pytest
from httpx import AsyncClient

from helpers import login

pytestmark = pytest.mark.usefixtures("seeded")
MakeClient = Callable[[], Awaitable[AsyncClient]]
MOD = "/api/v1/moderation"


async def _moderator(make_client: MakeClient) -> AsyncClient:
    mod = await make_client()
    await login(mod, "Модератор", "moderator")
    return mod


async def _tosha(client: AsyncClient) -> dict[str, Any]:
    posts = (await client.get("/api/v1/posts")).json()["items"]
    return next(p for p in posts if p["title"] == "Тоша уехал домой")


async def test_only_moderators(client: AsyncClient) -> None:
    for path in ("/stats", "/posts", "/comments", "/users"):
        assert (await client.get(MOD + path)).status_code == 401
    await login(client, "Айгерим")
    for path in ("/stats", "/posts", "/comments", "/users"):
        assert (await client.get(MOD + path)).status_code == 403


async def test_hidden_post_stays_in_panel(client: AsyncClient, make_client: MakeClient) -> None:
    mod = await _moderator(make_client)
    tosha = await _tosha(client)
    assert (await mod.put(f"{MOD}/posts/{tosha['id']}/hidden")).status_code == 204

    assert (await client.get(f"/api/v1/posts/{tosha['id']}")).status_code == 404
    hidden = (await mod.get(f"{MOD}/posts", params={"visibility": "hidden"})).json()
    assert [p["id"] for p in hidden["items"]] == [tosha["id"]]
    post = hidden["items"][0]
    assert post["hidden_at"] is not None
    assert post["author"]["type"] == "shelter"
    assert post["account"]["role"] in {"user", "volunteer"}  # живой человек за приютом
    assert post["comments_count"] == 3

    everything = (await mod.get(f"{MOD}/posts")).json()
    assert everything["total"] == 5
    visible = (await mod.get(f"{MOD}/posts", params={"visibility": "visible"})).json()
    assert visible["total"] == 4


async def test_search_and_comments(client: AsyncClient, make_client: MakeClient) -> None:
    mod = await _moderator(make_client)
    found = (await mod.get(f"{MOD}/posts", params={"q": "тоша уехал"})).json()
    assert [p["title"] for p in found["items"]] == ["Тоша уехал домой"]
    assert (await mod.get(f"{MOD}/posts", params={"q": "100%_"})).json()["total"] == 0

    tosha = await _tosha(client)
    comments = (await mod.get(f"{MOD}/comments", params={"post_id": tosha["id"]})).json()
    assert comments["total"] == 3  # ответы тоже, плоским списком
    assert {c["post_title"] for c in comments["items"]} == {"Тоша уехал домой"}
    assert any(c["parent_id"] for c in comments["items"])


async def test_delete_comment_and_post(client: AsyncClient, make_client: MakeClient) -> None:
    mod = await _moderator(make_client)
    tosha = await _tosha(client)
    first = tosha["comments_preview"][0]  # у него есть ответ приюта

    assert (await mod.delete(f"{MOD}/comments/{first['id']}")).status_code == 204
    after = await _tosha(client)
    assert after["comments_count"] == 1  # ушёл вместе с ответом
    assert (await mod.delete(f"{MOD}/comments/{first['id']}")).status_code == 404

    assert (await mod.delete(f"{MOD}/posts/{tosha['id']}")).status_code == 204
    assert (await client.get(f"/api/v1/posts/{tosha['id']}")).status_code == 404
    left = (await mod.get(f"{MOD}/comments", params={"post_id": tosha["id"]})).json()
    assert left["total"] == 0


async def test_likers_and_remove_like(client: AsyncClient, make_client: MakeClient) -> None:
    mod = await _moderator(make_client)
    tosha = await _tosha(client)
    me = await login(client, "Накрутчик")
    await client.put(f"/api/v1/posts/{tosha['id']}/like")
    comment = tosha["comments_preview"][0]
    await client.put(f"/api/v1/comments/{comment['id']}/like")

    likers = (await mod.get(f"{MOD}/posts/{tosha['id']}/likes")).json()
    assert likers["items"][0]["account"]["name"] == "Накрутчик"
    path = f"{MOD}/posts/{tosha['id']}/likes/{me['id']}"
    assert (await mod.delete(path)).status_code == 204
    assert (await mod.delete(path)).status_code == 204  # идемпотентно
    assert (await _tosha(client))["liked_by_me"] is False

    c_path = f"{MOD}/comments/{comment['id']}/likes"
    assert (await mod.get(c_path)).json()["total"] == 1
    assert (await mod.delete(f"{c_path}/{me['id']}")).status_code == 204
    assert (await mod.get(c_path)).json()["total"] == 0


async def test_users_and_stats(client: AsyncClient, make_client: MakeClient) -> None:
    mod = await _moderator(make_client)
    me = await login(client, "Спамер Иван")
    stats = (await mod.get(f"{MOD}/stats")).json()
    assert (stats["posts"], stats["posts_hidden"]) == (5, 0)
    assert stats["users_blocked"] == 0

    found = (await mod.get(f"{MOD}/users", params={"q": "спамер"})).json()
    assert [u["id"] for u in found["items"]] == [me["id"]]
    assert found["items"][0]["posts_count"] == 0

    assert (await mod.put(f"{MOD}/users/{me['id']}/blocked")).status_code == 204
    blocked = (await mod.get(f"{MOD}/users", params={"blocked": True})).json()
    assert [u["name"] for u in blocked["items"]] == ["Спамер Иван"]
    assert (await mod.get(f"{MOD}/stats")).json()["users_blocked"] == 1
