"""Общие помощники тестов (подключены через pythonpath в pyproject)."""

from typing import Any

from fastapi import Request, Response
from fastapi.responses import RedirectResponse
from httpx import AsyncClient

BOT_TOKEN = "123456:test-bot-token"


class RecordingQueue:
    """Вместо Redis: запоминает поставленные задачи."""

    def __init__(self) -> None:
        self.jobs: list[tuple[str, tuple[str, ...]]] = []

    async def enqueue(self, job: str, *args: str) -> None:
        self.jobs.append((job, args))


class FakeGoogle:
    """Подменяет Authlib: ответ Google задаётся в тесте через .userinfo / .error."""

    def __init__(self) -> None:
        self.userinfo: dict[str, Any] = {}
        self.error: Exception | None = None

    async def authorize_redirect(self, request: Request, redirect_uri: str) -> Response:
        return RedirectResponse(f"https://accounts.google.test/auth?redirect_uri={redirect_uri}")

    async def authorize_access_token(self, request: Request) -> dict[str, Any]:
        if self.error:
            raise self.error
        return {"userinfo": self.userinfo}


async def login(client: AsyncClient, name: str, role: str = "user") -> dict[str, Any]:
    r = await client.post("/api/v1/auth/dev-login", json={"name": name, "role": role})
    assert r.status_code == 200, r.text
    me: dict[str, Any] = r.json()
    return me


def telegram_payload(token: str = BOT_TOKEN, **fields: Any) -> dict[str, Any]:
    """Данные виджета с правильной подписью — как их подписал бы Telegram."""
    import hashlib
    import hmac
    import time

    data: dict[str, Any] = {
        "id": 777,
        "first_name": "Асель",
        "last_name": "К.",
        "auth_date": int(time.time()),
        **fields,
    }
    check = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
    secret = hashlib.sha256(token.encode()).digest()
    data["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return data


class MemoryStorage:
    """S3 в памяти: presigned URL условный, объекты кладёт сам тест."""

    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], tuple[bytes, str]] = {}

    def presign_put(self, bucket: str, key: str, *, content_type: str, expires: int) -> str:
        return f"http://s3.test/{bucket}/{key}?X-Amz-Expires={expires}"

    async def head(self, bucket: str, key: str) -> Any:
        from app.core.storage import ObjectInfo

        obj = self.objects.get((bucket, key))
        return ObjectInfo(size=len(obj[0]), content_type=obj[1]) if obj else None

    async def get(self, bucket: str, key: str) -> bytes:
        return self.objects[(bucket, key)][0]

    async def put(self, bucket: str, key: str, data: bytes, *, content_type: str) -> None:
        self.objects[(bucket, key)] = (data, content_type)

    async def copy(self, bucket: str, source_key: str, target_key: str) -> None:
        self.objects[(bucket, target_key)] = self.objects[(bucket, source_key)]

    async def delete(self, bucket: str, key: str) -> None:
        self.objects.pop((bucket, key), None)

    def public_url(self, bucket: str, key: str) -> str:
        return f"http://cdn.test/{bucket}/{key}"


def jpeg(
    width: int = 2400, height: int = 1800, *, gps: bool = False, rotated: bool = False
) -> bytes:
    """Настоящий JPEG; по желанию с GPS в EXIF и ориентацией «повёрнут на 90°»."""
    import io

    from PIL import Image

    image = Image.new("RGB", (width, height), (200, 120, 80))
    exif = Image.Exif()
    if gps:
        exif[0x8825] = {1: "N", 2: (52.0, 17.0, 0.0), 3: "E", 4: (76.0, 57.0, 0.0)}
    if rotated:
        exif[0x0112] = 6  # Orientation: Rotate 90 CW
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", exif=exif)
    return buffer.getvalue()


class MemoryPubSub:
    """Redis pub/sub в памяти: запоминает публикации и раздаёт их подписчикам."""

    def __init__(self) -> None:
        import asyncio
        from collections import defaultdict

        self.published: list[tuple[set[Any], dict[str, Any]]] = []
        self._queues: dict[Any, list[asyncio.Queue[dict[str, Any]]]] = defaultdict(list)

    async def publish(self, user_ids: Any, event: dict[str, Any]) -> None:
        ids = set(user_ids)
        self.published.append((ids, event))
        for user_id in ids:
            for queue in self._queues.get(user_id, []):
                queue.put_nowait(event)

    def subscribe(self, user_id: Any) -> Any:
        import asyncio
        from contextlib import asynccontextmanager

        @asynccontextmanager
        async def stream() -> Any:
            queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
            self._queues[user_id].append(queue)

            async def events() -> Any:
                while True:
                    yield await queue.get()

            try:
                yield events()
            finally:
                self._queues[user_id].remove(queue)

        return stream()

    def events_for(self, user_id: Any, kind: str | None = None) -> list[dict[str, Any]]:
        return [e for ids, e in self.published if user_id in ids and kind in (None, e["type"])]
