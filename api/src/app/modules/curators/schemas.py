from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.cities import City


class CuratorType(StrEnum):
    SHELTER = "shelter"
    VOLUNTEER = "volunteer"


class CuratorFilters(BaseModel):
    q: str | None = Field(default=None, max_length=100)
    city: City | None = None
    type: CuratorType | None = None  # пусто — «Приюты и волонтёры»


class CuratorCardOut(BaseModel):
    """Карточка участника: «Тёплый угол · 23 ищут дом · 41 пристроено»."""

    type: Literal["shelter", "volunteer"]
    id: UUID
    name: str
    city: City | None
    avatar_url: str | None
    verified: bool
    seeking_count: int
    adopted_count: int
    on_platform_since: int  # «на платформе с 2025» — вместо «0 пристроено» у новичков
    preview_covers: list[str] = []  # до 3 обложек питомцев, которые ищут дом
    subscribed: bool = False  # только для приютов и вошедших


class ShelterProfileOut(BaseModel):
    """Профиль приюта: шапка, статистика и блок «О приюте»."""

    id: UUID
    name: str
    city: City
    address: str | None
    about: str | None
    visit_hours: str | None
    avatar_url: str | None
    cover_url: str | None
    verified: bool
    on_platform_since: int  # «на платформе с 2026»
    seeking_count: int
    adopted_count: int
    subscribers_count: int
    subscribed: bool


class SubscriptionOut(BaseModel):
    subscribed: bool
    subscribers_count: int
