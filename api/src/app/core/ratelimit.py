"""Ограничение частоты: фиксированное окно в Redis.

Ключ — сессия (хэш cookie) или IP для гостей. core не знает про пользователей,
поэтому лимит считается на сессию: этого хватает против спама из одной вкладки.
Redis недоступен — пропускаем запрос: счётчик не должен ломать платформу.
"""

import logging
from collections.abc import Awaitable, Callable
from functools import lru_cache
from typing import Annotated, Literal, Protocol

import redis.asyncio as aioredis
from fastapi import Depends, Request
from redis.exceptions import RedisError

from app.core.config import get_settings
from app.core.errors import DomainError
from app.core.security import SESSION_COOKIE, hash_token

logger = logging.getLogger(__name__)


class RateLimiter(Protocol):
    async def hit(self, key: str, *, limit: int, window: int) -> int | None:
        """Засчитывает запрос; при превышении возвращает, через сколько секунд можно снова."""
        ...


class RedisRateLimiter:
    def __init__(self, redis_url: str) -> None:
        self._redis = aioredis.from_url(redis_url)  # type: ignore[no-untyped-call]

    async def hit(self, key: str, *, limit: int, window: int) -> int | None:
        try:
            async with self._redis.pipeline(transaction=True) as pipe:
                pipe.incr(key)
                pipe.expire(key, window, nx=True)  # окно стартует с первого запроса
                pipe.ttl(key)
                count, _, ttl = await pipe.execute()
        except (OSError, RedisError):
            logger.exception("Rate limiter unavailable, allowing %s", key)
            return None
        return max(int(ttl), 1) if int(count) > limit else None

    async def close(self) -> None:
        await self._redis.aclose()


@lru_cache
def get_rate_limiter() -> RedisRateLimiter:
    return RedisRateLimiter(str(get_settings().redis_url))


LimiterDep = Annotated[RateLimiter, Depends(get_rate_limiter)]


def rate_limit(
    scope: str, *, limit: int, window: int, by: Literal["session", "ip"] = "session"
) -> Callable[..., Awaitable[None]]:
    """Depends(rate_limit("messages", limit=30, window=60)) на эндпоинте."""

    async def dependency(request: Request, limiter: LimiterDep) -> None:
        token = request.cookies.get(SESSION_COOKIE)
        if by == "session" and token:
            who = f"s:{hash_token(token)[:32]}"
        else:
            who = f"ip:{request.client.host if request.client else 'unknown'}"
        retry_after = await limiter.hit(f"rl:{scope}:{who}", limit=limit, window=window)
        if retry_after is not None:
            raise DomainError(
                "too_many_requests",
                status=429,
                message="Too many requests, try again later",
                headers={"Retry-After": str(retry_after)},
            )

    return dependency
