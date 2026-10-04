"""Фото поста с метками «до/после» — через тот же presigned-конвейер, что и у питомцев."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from urllib.parse import urlparse

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.seed import sid
from app.workers.media import process_pet_photo
from helpers import MemoryStorage, jpeg, login

pytestmark = pytest.mark.usefixtures("seeded")


async def _upload(
    client: AsyncClient,
    db: AsyncSession,
    storage: MemoryStorage,
    settings: Settings,
    post_id: str,
    label: str,
    caption: str,
) -> None:
    body = {
        "purpose": "post_photo",
        "post_id": post_id,
        "label": label,
        "caption": caption,
        "content_type": "image/jpeg",
        "size": 1000,
    }
    ticket = (await client.post("/api/v1/media/uploads", json=body)).json()
    bucket, key = urlparse(ticket["upload_url"]).path.lstrip("/").split("/", 1)
    storage.objects[(bucket, key)] = (jpeg(), "image/jpeg")
    await client.post(f"/api/v1/media/uploads/{ticket['id']}/confirm")

    @asynccontextmanager
    async def factory() -> AsyncIterator[AsyncSession]:
        yield db

    await process_pet_photo(
        {"session_factory": factory, "storage": storage, "settings": settings}, ticket["id"]
    )


async def test_before_after_story_appears_in_category(
    client: AsyncClient, db_session: AsyncSession, storage: MemoryStorage, settings: Settings
) -> None:
    await login(client, "Гульнара")
    post = str(sid("post:tosha"))
    assert not (await client.get("/api/v1/posts", params={"category": "before_after"})).json()[
        "items"
    ]

    await _upload(client, db_session, storage, settings, post, "before", "Февраль, в приюте")
    await _upload(client, db_session, storage, settings, post, "after", "Сегодня, дома")

    feed = (await client.get("/api/v1/posts", params={"category": "before_after"})).json()
    assert [p["title"] for p in feed["items"]] == ["Тоша уехал домой"]
    photos = feed["items"][0]["photos"]
    assert [(p["label"], p["caption"]) for p in photos] == [
        ("before", "Февраль, в приюте"),
        ("after", "Сегодня, дома"),
    ]


async def test_only_author_adds_photos(client: AsyncClient) -> None:
    await login(client, "Асель")
    body = {
        "purpose": "post_photo",
        "post_id": str(sid("post:tosha")),
        "content_type": "image/jpeg",
        "size": 1000,
    }
    r = await client.post("/api/v1/media/uploads", json=body)
    assert r.status_code == 403
    mismatch = await client.post("/api/v1/media/uploads", json={**body, "purpose": "pet_photo"})
    assert mismatch.json()["error"]["fields"] == {"body": "upload_target"}
