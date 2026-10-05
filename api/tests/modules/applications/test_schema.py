from typing import Any

import pytest
from pydantic import ValidationError

from app.modules.applications.schemas import ApplicationCreate

VALID: dict[str, Any] = {
    "name": "Асель",
    "phone": "+77012345678",
    "city": "pavlodar",
    "housing": "flat",
    "household": ["kids"],
    "about": "В детстве у нас был кот.",
    "consent": True,
}


def _codes(**override: Any) -> dict[str, str]:
    with pytest.raises(ValidationError) as exc:
        ApplicationCreate.model_validate({**VALID, **override})
    return {".".join(map(str, e["loc"])): e["type"] for e in exc.value.errors()}


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("+7 701 234 56 78", "+77012345678"),
        ("8 (701) 234-56-78", "+77012345678"),
    ],
)
def test_phone_is_normalized(raw: str, expected: str) -> None:
    assert ApplicationCreate.model_validate({**VALID, "phone": raw}).phone == expected


def test_error_codes_match_frontend_keys() -> None:
    assert _codes(phone="+7 701 23") == {"phone": "phone_incomplete"}
    assert _codes(name=" А ") == {"name": "name_short"}
    assert _codes(consent=False) == {"consent": "consent_required"}
    assert _codes(housing="tent") == {"housing": "enum"}


def test_household_is_deduplicated() -> None:
    data = ApplicationCreate.model_validate({**VALID, "household": ["kids", "cats", "kids"]})
    assert data.household == ["kids", "cats"]
