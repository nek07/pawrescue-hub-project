"""Воркер фоновых задач: arq app.workers.main.WorkerSettings"""

from typing import Any, ClassVar

import httpx
from arq.connections import RedisSettings

from app.core.config import get_settings
from app.core.db import SessionFactory, engine
from app.core.observability import configure_logging, init_sentry
from app.core.telegram_bot import TelegramBot
from app.workers.notifications import notify_application_status, notify_new_application

settings = get_settings()


async def startup(ctx: dict[str, Any]) -> None:
    configure_logging(settings)
    init_sentry(settings)
    ctx["session_factory"] = SessionFactory
    ctx["http"] = httpx.AsyncClient(timeout=10)
    token = settings.telegram_bot_token
    ctx["telegram"] = TelegramBot(token.get_secret_value(), ctx["http"]) if token else None


async def shutdown(ctx: dict[str, Any]) -> None:
    await ctx["http"].aclose()
    await engine.dispose()


class WorkerSettings:
    functions: ClassVar[list[Any]] = [
        notify_new_application,
        notify_application_status,
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(str(settings.redis_url))
    max_tries = 5
