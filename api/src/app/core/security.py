"""Токены сессий и cookie. Сами сессии и пользователь — в modules/auth."""

import hashlib
import secrets
from datetime import timedelta

from fastapi import Response

from app.core.config import Settings

SESSION_COOKIE = "prh_session"
SESSION_TTL = timedelta(days=30)


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    # В БД лежит только хэш: утечка таблицы не даёт войти под чужой сессией.
    return hashlib.sha256(token.encode()).hexdigest()


def set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_TTL.total_seconds()),
        httponly=True,
        secure=settings.env == "prod",
        samesite="lax",
        domain=settings.session_cookie_domain,
        path="/",
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        SESSION_COOKIE,
        httponly=True,
        secure=settings.env == "prod",
        samesite="lax",
        domain=settings.session_cookie_domain,
        path="/",
    )


def safe_next_path(value: str | None) -> str:
    """Куда вернуть человека после входа. Только относительный путь на нашем сайте,
    иначе ?next=https://evil.example превращает вход в открытый редирект."""
    if (
        not value
        or not value.startswith("/")
        or value.startswith(("//", "/\\"))
        or any(ch in value for ch in "\r\n\t")
    ):
        return "/"
    return value
