from datetime import date

import pytest

from app.core.clock import years_ago


@pytest.mark.parametrize(
    ("today", "years", "expected"),
    [
        (date(2026, 10, 4), 1, date(2025, 10, 4)),
        (date(2028, 2, 29), 1, date(2027, 2, 28)),
        (date(2028, 2, 29), 4, date(2024, 2, 29)),
    ],
)
def test_years_ago(today: date, years: int, expected: date) -> None:
    assert years_ago(today, years) == expected
