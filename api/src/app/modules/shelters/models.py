from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.cities import City
from app.core.db import Base, pg_enum


class Shelter(Base):
    __tablename__ = "shelters"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(120))
    city: Mapped[City] = mapped_column(pg_enum(City, "city"))
    address: Mapped[str | None] = mapped_column(String(255))
    about: Mapped[str | None] = mapped_column(Text)
    visit_hours: Mapped[str | None] = mapped_column(String(120))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    cover_url: Mapped[str | None] = mapped_column(String(500))
    # «Проверен платформой» — ставит модератор после проверки документов.
    verified_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class ShelterRole(StrEnum):
    ADMIN = "admin"  # добавляет сотрудников
    STAFF = "staff"


class ShelterMember(Base):
    __tablename__ = "shelter_members"

    shelter_id: Mapped[UUID] = mapped_column(
        ForeignKey("shelters.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    role: Mapped[ShelterRole] = mapped_column(pg_enum(ShelterRole, "shelter_role"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class ShelterSubscription(Base):
    """«Подписаться» на приют: его посты в ленте и счётчик «Подписчики»."""

    __tablename__ = "shelter_subscriptions"

    shelter_id: Mapped[UUID] = mapped_column(
        ForeignKey("shelters.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
