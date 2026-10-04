from datetime import UTC, date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends

# С 2024 года во всём Казахстане UTC+5 — tzdata не нужна.
KZ_TZ = timezone(timedelta(hours=5))


def get_today() -> date:
    """«Сегодня» для возрастов питомцев. В тестах подменяется через dependency_overrides."""
    return datetime.now(UTC).astimezone(KZ_TZ).date()


Today = Annotated[date, Depends(get_today)]


def years_ago(today: date, years: int) -> date:
    try:
        return today.replace(year=today.year - years)
    except ValueError:  # 29 февраля → 28 февраля
        return today.replace(year=today.year - years, day=28)
