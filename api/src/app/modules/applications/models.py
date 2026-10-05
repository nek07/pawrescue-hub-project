from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.cities import City
from app.core.db import Base, pg_enum


class ApplicationStatus(StrEnum):
    SENT = "sent"  # «Отправлена»
    MEETING = "meeting"  # «Знакомство»
    APPROVED = "approved"  # «Одобрена» — питомец забронирован
    COMPLETED = "completed"  # «Завершена» — питомец дома
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"  # отозвана самим человеком


ACTIVE_STATUSES = frozenset(
    {ApplicationStatus.SENT, ApplicationStatus.MEETING, ApplicationStatus.APPROVED}
)


class Housing(StrEnum):
    FLAT = "flat"
    HOUSE = "house"
    RENT = "rent"


class Household(StrEnum):
    KIDS = "kids"
    CATS = "cats"
    DOGS = "dogs"


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        # Одна активная заявка на пару человек + питомец; после отказа можно подать снова.
        Index(
            "uq_applications_active_pet_user",
            "pet_id",
            "user_id",
            unique=True,
            postgresql_where=text("status IN ('sent', 'meeting', 'approved')"),
        ),
        Index("ix_applications_created_at_id", "created_at", "id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    pet_id: Mapped[UUID] = mapped_column(ForeignKey("pets.id", ondelete="RESTRICT"), index=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    # Куратор видит телефон только после одобрения заявки.
    phone: Mapped[str] = mapped_column(String(16))
    city: Mapped[City] = mapped_column(pg_enum(City, "city"))
    housing: Mapped[Housing] = mapped_column(pg_enum(Housing, "housing"))
    household: Mapped[list[str]] = mapped_column(
        ARRAY(String(16)), default=list, server_default="{}"
    )
    about: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ApplicationStatus] = mapped_column(
        pg_enum(ApplicationStatus, "application_status"),
        default=ApplicationStatus.SENT,
        server_default=ApplicationStatus.SENT,
    )
    consented_at: Mapped[datetime]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
