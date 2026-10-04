from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.security import SESSION_COOKIE, safe_next_path
from app.main import create_app


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("/ru/pets/123/apply", "/ru/pets/123/apply"),
        ("/kk/pets?kind=cat", "/kk/pets?kind=cat"),
        (None, "/"),
        ("", "/"),
        ("https://evil.example", "/"),
        ("//evil.example", "/"),
        ("/\\evil.example", "/"),
        ("pets", "/"),
        ("/ok\r\nSet-Cookie: x=1", "/"),
    ],
)
def test_safe_next_path(value: str | None, expected: str) -> None:
    assert safe_next_path(value) == expected


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    # Проверка Origin срабатывает до роутов — база не нужна.
    transport = ASGITransport(app=create_app())
    async with AsyncClient(
        transport=transport, base_url="http://test", cookies={SESSION_COOKIE: "token"}
    ) as client:
        yield client


async def test_foreign_origin_with_session_cookie_is_rejected(client: AsyncClient) -> None:
    r = await client.post(
        "/api/v1/auth/logout",
        headers={"Origin": "https://evil.example"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "origin_forbidden"


async def test_foreign_origin_on_safe_method_passes_check(client: AsyncClient) -> None:
    r = await client.get(
        "/api/v1/nope",
        headers={"Origin": "https://evil.example"},
    )
    assert r.status_code == 404
