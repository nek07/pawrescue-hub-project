from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security import SESSION_COOKIE, hash_token
from app.main import create_app
from app.modules.auth.models import AuthSession
from app.modules.users.models import User

ME = "/api/v1/auth/me"
DEV_LOGIN = "/api/v1/auth/dev-login"
LOGOUT = "/api/v1/auth/logout"


async def test_guest_gets_401(client: AsyncClient) -> None:
    r = await client.get(ME)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


async def test_dev_login_sets_httponly_cookie_and_me_returns_user(client: AsyncClient) -> None:
    r = await client.post(DEV_LOGIN, json={"name": "Асель"})
    assert r.status_code == 200
    set_cookie = r.headers["set-cookie"].lower()
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie

    me = await client.get(ME)
    assert me.status_code == 200
    assert me.json()["name"] == "Асель"
    assert me.json()["role"] == "user"
    assert me.json()["verified"] is False


async def test_token_is_stored_hashed(client: AsyncClient, db_session: AsyncSession) -> None:
    await client.post(DEV_LOGIN, json={"name": "Асель"})
    token = client.cookies[SESSION_COOKIE]
    stored = (await db_session.scalars(select(AuthSession.token_hash))).all()
    assert token not in stored
    assert hash_token(token) in stored


async def test_same_identity_reuses_user(client: AsyncClient, db_session: AsyncSession) -> None:
    first = await client.post(DEV_LOGIN, json={"name": "Асель"})
    second = await client.post(DEV_LOGIN, json={"name": "Асель"})
    assert first.json()["id"] == second.json()["id"]
    assert len((await db_session.scalars(select(User))).all()) == 1


async def test_logout_revokes_session(client: AsyncClient) -> None:
    await client.post(DEV_LOGIN, json={"name": "Асель"})
    token = client.cookies[SESSION_COOKIE]

    r = await client.post(LOGOUT)
    assert r.status_code == 204
    assert SESSION_COOKIE not in client.cookies

    # Старая cookie, сохранённая злоумышленником, больше не работает
    r = await client.get(ME, cookies={SESSION_COOKIE: token})
    assert r.status_code == 401


async def test_logout_without_session_is_noop(client: AsyncClient) -> None:
    assert (await client.post(LOGOUT)).status_code == 204


async def test_expired_session_is_rejected(client: AsyncClient, db_session: AsyncSession) -> None:
    await client.post(DEV_LOGIN, json={"name": "Асель"})
    await db_session.execute(
        update(AuthSession).values(expires_at=datetime(2020, 1, 1, tzinfo=UTC))
    )
    assert (await client.get(ME)).status_code == 401


async def test_blocked_user_loses_access(client: AsyncClient, db_session: AsyncSession) -> None:
    await client.post(DEV_LOGIN, json={"name": "Асель"})
    await db_session.execute(update(User).values(blocked_at=datetime.now(UTC)))
    assert (await client.get(ME)).status_code == 401
    r = await client.post(DEV_LOGIN, json={"name": "Асель"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "user_blocked"


async def test_forged_token_is_rejected(client: AsyncClient) -> None:
    r = await client.get(ME, cookies={SESSION_COOKIE: "forged"})
    assert r.status_code == 401


async def test_dev_login_validates_body(client: AsyncClient) -> None:
    r = await client.post(DEV_LOGIN, json={"name": "А", "role": "admin"})
    assert r.status_code == 422
    assert r.json()["error"]["fields"] == {"name": "string_too_short", "role": "enum"}


async def test_dev_login_is_absent_in_prod() -> None:
    app = create_app(Settings(env="prod", session_secret=SecretStr("x" * 32)))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(DEV_LOGIN, json={"name": "Асель"})
    assert r.status_code == 404


async def test_concurrent_first_login_reuses_account(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.modules.auth.repository import AuthRepository

    await client.post(DEV_LOGIN, json={"name": "Асель"})  # «параллельный» запрос успел первым
    original = AuthRepository.find_identity
    calls = {"n": 0}

    async def stale_first_lookup(self: AuthRepository, *args: Any) -> Any:
        calls["n"] += 1
        return None if calls["n"] == 1 else await original(self, *args)

    monkeypatch.setattr(AuthRepository, "find_identity", stale_first_lookup)
    r = await client.post(DEV_LOGIN, json={"name": "Асель"})
    assert r.status_code == 200, r.text
    assert len((await db_session.scalars(select(User))).all()) == 1  # лишнего пользователя нет
