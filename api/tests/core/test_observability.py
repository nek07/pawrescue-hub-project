import json
import logging

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.observability import JsonFormatter, request_id_var
from app.main import create_app


@pytest.fixture
async def client() -> AsyncClient:
    transport = ASGITransport(app=create_app())
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def test_request_id_is_generated(client: AsyncClient) -> None:
    r = await client.get("/api/v1/nope")
    assert len(r.headers["x-request-id"]) == 32


async def test_request_id_from_proxy_is_kept(client: AsyncClient) -> None:
    r = await client.get("/api/v1/nope", headers={"X-Request-ID": "caddy-abc.123"})
    assert r.headers["x-request-id"] == "caddy-abc.123"


async def test_malformed_request_id_is_replaced(client: AsyncClient) -> None:
    r = await client.get("/api/v1/nope", headers={"X-Request-ID": "bad id\nwith newline"})
    assert r.headers["x-request-id"] != "bad id\nwith newline"


def test_json_log_line_carries_request_id_and_extra() -> None:
    token = request_id_var.set("req-1")
    try:
        record = logging.LogRecord("app", logging.INFO, "", 0, "GET %s", ("/pets",), None)
        record.status = 200
        line = json.loads(JsonFormatter().format(record))
    finally:
        request_id_var.reset(token)
    assert line["msg"] == "GET /pets"
    assert line["request_id"] == "req-1"
    assert line["status"] == 200
