"""События реального времени через Redis pub/sub, канал user:{id}.

Источник правды — PostgreSQL: событие лишь подсказывает клиенту, что пора
показать новое. Потерялось событие — клиент догрузит пропущенное по REST.
"""

import json
import logging
from collections.abc import AsyncIterator, Iterable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from functools import lru_cache
from typing import Annotated, Any, Protocol
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import Depends
from redis.exceptions import RedisError

from app.core.config import get_settings

logger = logging.getLogger(__name__)

Event = dict[str, Any]
EventStream = AbstractAsyncContextManager[AsyncIterator[Event]]


def channel(user_id: UUID) -> str:
    return f"user:{user_id}"


class PubSub(Protocol):
    async def publish(self, user_ids: Iterable[UUID], event: Event) -> None: ...

    def subscribe(self, user_id: UUID) -> EventStream: ...


class RedisPubSub:
    def __init__(self, redis_url: str) -> None:
        self._redis = aioredis.from_url(redis_url)  # type: ignore[no-untyped-call]

    async def publish(self, user_ids: Iterable[UUID], event: Event) -> None:
        data = json.dumps(event, ensure_ascii=False, default=str)
        try:
            async with self._redis.pipeline(transaction=False) as pipe:
                for user_id in set(user_ids):
                    pipe.publish(channel(user_id), data)
                await pipe.execute()
        except (OSError, RedisError):
            # Сообщение уже в БД; клиент увидит его при следующей загрузке.
            logger.exception("Failed to publish %s", event.get("type"))

    def subscribe(self, user_id: UUID) -> EventStream:
        return _subscription(self._redis, user_id)

    async def close(self) -> None:
        await self._redis.aclose()


@asynccontextmanager
async def _subscription(
    client: aioredis.Redis, user_id: UUID
) -> AsyncIterator[AsyncIterator[Event]]:
    pubsub = client.pubsub()
    await pubsub.subscribe(channel(user_id))

    async def events() -> AsyncIterator[Event]:
        async for message in pubsub.listen():
            if message.get("type") == "message":
                yield json.loads(message["data"])

    try:
        yield events()
    finally:
        await pubsub.unsubscribe()
        await pubsub.aclose()  # type: ignore[no-untyped-call]


@lru_cache
def get_pubsub() -> RedisPubSub:
    return RedisPubSub(str(get_settings().redis_url))


PubSubDep = Annotated[PubSub, Depends(get_pubsub)]
