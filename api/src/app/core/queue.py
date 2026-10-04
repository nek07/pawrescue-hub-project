"""Фоновые задачи через arq: уведомления и всё, что медленнее 200 мс."""

import logging
from functools import lru_cache
from typing import Annotated, Protocol

from arq import ArqRedis, create_pool
from arq.connections import RedisSettings
from fastapi import Depends
from redis.exceptions import RedisError

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class Queue(Protocol):
    async def enqueue(self, job: str, *args: str) -> None: ...


class ArqQueue:
    def __init__(self, redis_url: str) -> None:
        self._settings = RedisSettings.from_dsn(redis_url)
        self._pool: ArqRedis | None = None

    async def enqueue(self, job: str, *args: str) -> None:
        try:
            if self._pool is None:
                self._pool = await create_pool(self._settings)
            await self._pool.enqueue_job(job, *args)
        except (OSError, RedisError):
            # Данные уже закоммичены: потерять уведомление лучше, чем ответить 500.
            logger.exception("Failed to enqueue %s%s", job, args)

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.aclose()


@lru_cache
def get_queue() -> ArqQueue:
    return ArqQueue(str(get_settings().redis_url))


QueueDep = Annotated[Queue, Depends(get_queue)]
