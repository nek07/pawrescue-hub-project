"""Вход через Telegram и Google на уровне HTTP (провайдеры подменены)."""

from urllib.parse import parse_qs, urlparse

from authlib.integrations.starlette_client import OAuthError
from httpx import AsyncClient

from app.core.security import SESSION_COOKIE
from helpers import FakeGoogle, telegram_payload

TELEGRAM = "/api/v1/auth/telegram"
GOOGLE_LOGIN = "/api/v1/auth/google/login"
GOOGLE_CALLBACK = "/api/v1/auth/google/callback"
VERIFIED = {"sub": "google-sub-1", "email": "asel@example.kz", "email_verified": True}


async def test_telegram_login_creates_session(client: AsyncClient) -> None:
    r = await client.post(TELEGRAM, json=telegram_payload(photo_url="https://t.me/a.jpg"))
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Асель К."
    assert r.json()["avatar_url"] == "https://t.me/a.jpg"
    assert (await client.get("/api/v1/auth/me")).status_code == 200


async def test_telegram_same_id_is_same_user(client: AsyncClient) -> None:
    first = await client.post(TELEGRAM, json=telegram_payload())
    second = await client.post(TELEGRAM, json=telegram_payload(first_name="Другое имя"))
    assert first.json()["id"] == second.json()["id"]


async def test_telegram_forged_data_is_rejected(client: AsyncClient) -> None:
    data = telegram_payload()
    data["id"] = 1
    r = await client.post(TELEGRAM, json=data)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "telegram_auth_invalid"
    assert SESSION_COOKIE not in client.cookies


async def test_telegram_unknown_fields_are_part_of_signature(client: AsyncClient) -> None:
    signed = telegram_payload(allows_write_to_pm="true")
    assert (await client.post(TELEGRAM, json=signed)).status_code == 200
    signed["allows_write_to_pm"] = "false"
    assert (await client.post(TELEGRAM, json=signed)).status_code == 401


async def _google_round_trip(client: AsyncClient, next_path: str) -> str:
    r = await client.get(GOOGLE_LOGIN, params={"next": next_path})
    assert r.status_code in (302, 307)
    assert "redirect_uri=http://api.test/api/v1/auth/google/callback" in r.headers["location"]
    r = await client.get(GOOGLE_CALLBACK, params={"code": "x", "state": "y"})
    assert r.status_code == 302
    return r.headers["location"]


async def test_google_login_returns_to_next(client: AsyncClient, google: FakeGoogle) -> None:
    google.userinfo = {**VERIFIED, "name": "Асель К.", "picture": "https://g.test/a.jpg"}
    location = await _google_round_trip(client, "/ru/pets/123/apply")
    assert location == "http://web.test/ru/pets/123/apply"
    me = (await client.get("/api/v1/auth/me")).json()
    assert me["name"] == "Асель К."


async def test_google_open_redirect_is_blocked(client: AsyncClient, google: FakeGoogle) -> None:
    google.userinfo = VERIFIED
    assert await _google_round_trip(client, "//evil.example") == "http://web.test/"


async def test_google_unverified_email(client: AsyncClient, google: FakeGoogle) -> None:
    google.userinfo = {**VERIFIED, "email_verified": False}
    location = await _google_round_trip(client, "/ru")
    assert urlparse(location).path == "/login"
    assert parse_qs(urlparse(location).query) == {"error": ["google_email_unverified"]}
    assert SESSION_COOKIE not in client.cookies


async def test_google_state_mismatch(client: AsyncClient, google: FakeGoogle) -> None:
    google.error = OAuthError(error="mismatching_state")
    location = await _google_round_trip(client, "/ru")
    assert parse_qs(urlparse(location).query) == {"error": ["google_failed"]}
