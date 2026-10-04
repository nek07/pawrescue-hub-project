"""Фото питомца: presigned URL → файл в хранилище → подтверждение → воркер."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any
from urllib.parse import urlparse

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.workers.media import process_pet_photo
from helpers import MemoryStorage, RecordingQueue, jpeg, login

pytestmark = pytest.mark.usefixtures("seeded")
UPLOADS = "/api/v1/media/uploads"


async def _pet(client: AsyncClient, name: str = "Мурка") -> str:
    r = await client.get("/api/v1/pets", params={"q": name})
    return str(r.json()["items"][0]["id"])


async def _ticket(client: AsyncClient, pet_id: str, **override: Any) -> Any:
    body = {"purpose": "pet_photo", "pet_id": pet_id, "content_type": "image/jpeg", "size": 1000}
    return await client.post(UPLOADS, json=body | override)


def _put(storage: MemoryStorage, ticket: dict[str, Any], data: bytes) -> None:
    # то, что сделал бы браузер по presigned URL
    bucket, key = urlparse(ticket["upload_url"]).path.lstrip("/").split("/", 1)
    storage.objects[(bucket, key)] = (data, "image/jpeg")


async def _run_worker(
    db_session: AsyncSession, storage: MemoryStorage, settings: Settings, upload_id: str
) -> None:
    @asynccontextmanager
    async def factory() -> AsyncIterator[AsyncSession]:
        yield db_session

    ctx = {"session_factory": factory, "storage": storage, "settings": settings}
    await process_pet_photo(ctx, upload_id)


async def test_guest_and_stranger_cannot_upload(client: AsyncClient) -> None:
    pet = await _pet(client)
    assert (await _ticket(client, pet)).status_code == 401
    await login(client, "Асель")
    r = await _ticket(client, pet)
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "not_curator"


async def test_size_and_type_are_validated(client: AsyncClient) -> None:
    await login(client, "Гульнара")
    pet = await _pet(client)
    r = await _ticket(client, pet, size=11 * 1024 * 1024, content_type="image/gif")
    assert r.status_code == 422
    assert r.json()["error"]["fields"] == {
        "size": "file_too_large",
        "content_type": "literal_error",
    }


async def test_full_photo_flow(
    client: AsyncClient,
    db_session: AsyncSession,
    storage: MemoryStorage,
    queue: RecordingQueue,
    settings: Settings,
) -> None:
    await login(client, "Гульнара")
    pet = await _pet(client)

    ticket = (await _ticket(client, pet)).json()
    assert ticket["status"] == "pending"
    assert ticket["method"] == "PUT"
    assert ticket["headers"] == {"Content-Type": "image/jpeg"}
    assert "X-Amz-Expires=900" in ticket["upload_url"]

    # Подтвердить без файла нельзя
    confirm = f"{UPLOADS}/{ticket['id']}/confirm"
    assert (await client.post(confirm)).json()["error"]["code"] == "upload_missing"

    _put(storage, ticket, jpeg(gps=True))
    r = await client.post(confirm)
    assert r.status_code == 202
    assert r.json()["status"] == "processing"
    assert queue.jobs[-1] == ("process_pet_photo", (ticket["id"],))
    assert (await client.post(confirm)).json()["error"]["code"] == "upload_not_pending"

    await _run_worker(db_session, storage, settings, ticket["id"])

    done = (await client.get(f"{UPLOADS}/{ticket['id']}")).json()
    assert done["status"] == "done"
    assert done["photo"]["card_url"].endswith("/card.webp")
    # Сырой файл удалён, в публичном бакете три WebP
    buckets = sorted({b for b, _ in storage.objects})
    assert buckets == ["pet-photos"]
    assert len(storage.objects) == 3

    murka = (await client.get(f"/api/v1/pets/{pet}")).json()
    assert murka["cover_url"] == done["photo"]["card_url"]
    assert murka["photos"] == [done["photo"]]


async def test_broken_file_marks_upload_failed(
    client: AsyncClient, db_session: AsyncSession, storage: MemoryStorage, settings: Settings
) -> None:
    await login(client, "Гульнара")
    ticket = (await _ticket(client, await _pet(client))).json()
    _put(storage, ticket, b"definitely not a jpeg")
    await client.post(f"{UPLOADS}/{ticket['id']}/confirm")
    await _run_worker(db_session, storage, settings, ticket["id"])
    r = (await client.get(f"{UPLOADS}/{ticket['id']}")).json()
    assert (r["status"], r["error"]) == ("failed", "image_invalid")
    assert storage.objects == {}


async def test_oversized_file_fails_on_confirm(
    client: AsyncClient, storage: MemoryStorage, queue: RecordingQueue
) -> None:
    await login(client, "Гульнара")
    ticket = (await _ticket(client, await _pet(client))).json()
    _put(storage, ticket, b"x" * (10 * 1024 * 1024 + 1))  # заявили 1000 байт, залили больше
    r = (await client.post(f"{UPLOADS}/{ticket['id']}/confirm")).json()
    assert (r["status"], r["error"]) == ("failed", "file_too_large")
    assert storage.objects == {}
    assert not [job for job, _ in queue.jobs if job == "process_pet_photo"]


async def test_upload_of_other_user_is_hidden(client: AsyncClient, make_client: Any) -> None:
    await login(client, "Гульнара")
    ticket = (await _ticket(client, await _pet(client))).json()
    other = await make_client()
    await login(other, "Асель")
    assert (await other.get(f"{UPLOADS}/{ticket['id']}")).status_code == 404


async def test_reupload_after_confirm_is_ignored(
    client: AsyncClient, db_session: AsyncSession, storage: MemoryStorage, settings: Settings
) -> None:
    # Ссылка на загрузку живёт 15 минут: после confirm по ней можно залить другой файл.
    await login(client, "Гульнара")
    ticket = (await _ticket(client, await _pet(client))).json()
    _put(storage, ticket, jpeg(800, 600))
    await client.post(f"{UPLOADS}/{ticket['id']}/confirm")
    _put(storage, ticket, b"x" * (50 * 1024 * 1024))  # 50 МБ мусора поверх проверенного файла

    await _run_worker(db_session, storage, settings, ticket["id"])
    done = (await client.get(f"{UPLOADS}/{ticket['id']}")).json()
    assert done["status"] == "done"  # обработан проверенный файл, а не подменённый


async def test_photo_is_added_once_when_job_runs_twice(
    client: AsyncClient, db_session: AsyncSession, storage: MemoryStorage, settings: Settings
) -> None:
    await login(client, "Гульнара")
    pet = await _pet(client)
    ticket = (await _ticket(client, pet)).json()
    _put(storage, ticket, jpeg())
    await client.post(f"{UPLOADS}/{ticket['id']}/confirm")
    await _run_worker(db_session, storage, settings, ticket["id"])
    await _run_worker(db_session, storage, settings, ticket["id"])
    assert len((await client.get(f"/api/v1/pets/{pet}")).json()["photos"]) == 1


async def test_confirm_and_worker_lock_the_upload_row(
    client: AsyncClient, db_session: AsyncSession, storage: MemoryStorage, settings: Settings
) -> None:
    # Параллельные confirm / дубли задачи ждут друг друга на блокировке строки,
    # а не проходят проверку статуса одновременно.
    from sqlalchemy import event
    from sqlalchemy.engine import Engine

    statements: list[str] = []

    def capture(_c: Any, _cur: Any, statement: str, *_: Any) -> None:
        statements.append(statement)

    await login(client, "Гульнара")
    ticket = (await _ticket(client, await _pet(client))).json()
    _put(storage, ticket, jpeg())
    event.listen(Engine, "before_cursor_execute", capture)
    try:
        await client.post(f"{UPLOADS}/{ticket['id']}/confirm")
        await _run_worker(db_session, storage, settings, ticket["id"])
    finally:
        event.remove(Engine, "before_cursor_execute", capture)
    locks = [s for s in statements if "FROM media_uploads" in s and "FOR UPDATE" in s]
    assert len(locks) == 2  # confirm + process


async def test_worker_rechecks_size(
    client: AsyncClient, db_session: AsyncSession, storage: MemoryStorage, settings: Settings
) -> None:
    await login(client, "Гульнара")
    ticket = (await _ticket(client, await _pet(client))).json()
    _put(storage, ticket, jpeg())
    await client.post(f"{UPLOADS}/{ticket['id']}/confirm")
    # Проверенная копия всё же оказалась огромной — воркер не читает её в память.
    (key,) = [k for b, k in storage.objects if b == "uploads"]
    storage.objects[("uploads", key)] = (b"x" * (11 * 1024 * 1024), "image/jpeg")
    await _run_worker(db_session, storage, settings, ticket["id"])
    r = (await client.get(f"{UPLOADS}/{ticket['id']}")).json()
    assert (r["status"], r["error"]) == ("failed", "file_too_large")
    assert storage.objects == {}
