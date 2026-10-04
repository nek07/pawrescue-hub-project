"""Структурные JSON-логи с request_id и Sentry — с первого деплоя."""

import json
import logging
import re
import sys
import time
import uuid
from collections.abc import Awaitable, Callable
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

import sentry_sdk
from fastapi import FastAPI, Request, Response

from app.core.config import Settings

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
logger = logging.getLogger("app.request")

# Чужой X-Request-ID принимаем, только если он похож на идентификатор (защита логов).
_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_STD_ATTRS = set(logging.LogRecord("", 0, "", 0, "", None, None).__dict__) | {
    "message",
    "asctime",
    "color_message",  # служебное поле uvicorn
}
# У этих библиотек свои обработчики — переводим их на общий JSON, иначе строки дублируются.
_LIBRARY_LOGGERS = ("uvicorn", "uvicorn.error", "uvicorn.access", "arq")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": request_id_var.get(),
        }
        # Всё, что передали через extra={...}, тоже попадает в JSON.
        entry |= {k: v for k, v in record.__dict__.items() if k not in _STD_ATTRS}
        if record.exc_info:
            entry["exc"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False, default=str)


def configure_logging(settings: Settings) -> None:
    handler = logging.StreamHandler(sys.stdout)
    if settings.log_json:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(settings.log_level)
    for name in _LIBRARY_LOGGERS:
        library = logging.getLogger(name)
        library.handlers.clear()
        library.propagate = True
    # Строку на запрос пишет add_request_context (с request_id и длительностью).
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def init_sentry(settings: Settings) -> None:
    if settings.sentry_dsn is None:
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn.get_secret_value(),
        environment=settings.env,
        traces_sample_rate=0.1,
        send_default_pii=False,  # телефоны и имена из заявок в Sentry не отправляем
    )


def add_request_context(app: FastAPI) -> None:
    @app.middleware("http")
    async def request_context(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        incoming = request.headers.get("x-request-id", "")
        request_id = incoming if _REQUEST_ID_RE.match(incoming) else uuid.uuid4().hex
        token = request_id_var.set(request_id)
        sentry_sdk.set_tag("request_id", request_id)
        started = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            logger.info(
                "%s %s %s",
                request.method,
                request.url.path,
                status,
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status": status,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                },
            )
            request_id_var.reset(token)
