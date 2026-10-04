"""Защита от CSRF для cookie-сессий.

SameSite=Lax уже не отправляет cookie с чужих сайтов на POST, но поддомены одного
сайта считаются «своими». Поэтому изменяющие запросы с cookie дополнительно
проверяем по Origin: он должен быть из списка CORS.
"""

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response

from app.core.errors import error_response
from app.core.security import SESSION_COOKIE

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def add_origin_check(app: FastAPI, allowed_origins: list[str]) -> None:
    allowed = frozenset(allowed_origins)

    @app.middleware("http")
    async def check_origin(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        origin = request.headers.get("origin")
        if (
            request.method not in SAFE_METHODS
            and SESSION_COOKIE in request.cookies
            and origin is not None
            and origin not in allowed
        ):
            return error_response(403, "origin_forbidden", "Cross-origin request rejected")
        return await call_next(request)
