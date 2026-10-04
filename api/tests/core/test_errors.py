from collections.abc import AsyncIterator
from typing import Annotated

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import AfterValidator, BaseModel, Field
from pydantic_core import PydanticCustomError

from app.core.errors import DomainError, register_error_handlers


def _phone(value: str) -> str:
    if len(value) != 12:
        raise PydanticCustomError("phone_incomplete", "Phone must have 11 digits")
    return value


class Body(BaseModel):
    name: str = Field(min_length=2)
    phone: Annotated[str, AfterValidator(_phone)]


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/conflict")
    async def conflict() -> None:
        raise DomainError("application_exists", status=409, message="Already applied")

    @app.post("/form")
    async def form(body: Body) -> Body:
        return body

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("unexpected")

    # raise_app_exceptions=False — иначе httpx пробросит RuntimeError мимо обработчика
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_domain_error_uses_common_format(client: AsyncClient) -> None:
    r = await client.get("/conflict")
    assert r.status_code == 409
    assert r.json() == {"error": {"code": "application_exists", "message": "Already applied"}}


async def test_validation_error_maps_fields_to_codes(client: AsyncClient) -> None:
    r = await client.post("/form", json={"name": "А", "phone": "+7701"})
    assert r.status_code == 422
    error = r.json()["error"]
    assert error["code"] == "validation_error"
    assert error["fields"] == {"name": "string_too_short", "phone": "phone_incomplete"}


async def test_missing_field_is_reported(client: AsyncClient) -> None:
    r = await client.post("/form", json={"name": "Асель"})
    assert r.json()["error"]["fields"] == {"phone": "missing"}


async def test_unknown_route_is_not_found(client: AsyncClient) -> None:
    r = await client.get("/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


async def test_unhandled_exception_hides_details(client: AsyncClient) -> None:
    r = await client.get("/boom")
    assert r.status_code == 500
    assert r.json() == {"error": {"code": "internal_error", "message": "Internal server error"}}
