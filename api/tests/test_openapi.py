"""Контракт для фронта: читаемые operationId, один тип ошибки."""

from typing import Any

import pytest

from app.main import create_app


@pytest.fixture(scope="module")
def schema() -> dict[str, Any]:
    return create_app().openapi()


def _operations(schema: dict[str, Any]) -> list[dict[str, Any]]:
    return [op for path in schema["paths"].values() for op in path.values()]


def test_operation_ids_are_tag_prefixed(schema: dict[str, Any]) -> None:
    assert schema["paths"]["/api/v1/health"]["get"]["operationId"] == "system-health"


def test_errors_use_common_schema(schema: dict[str, Any]) -> None:
    assert "HTTPValidationError" not in schema["components"]["schemas"]
    for op in _operations(schema):
        ref = op["responses"]["4XX"]["content"]["application/json"]["schema"]["$ref"]
        assert ref == "#/components/schemas/ErrorResponse"
