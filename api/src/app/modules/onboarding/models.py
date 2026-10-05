from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.cities import City
from app.core.db import Base, pg_enum


class OnboardingType(StrEnum):
    SHELTER = "shelter"
    VOLUNTEER = "volunteer"


class OnboardingStatus(StrEnum):
    DRAFT = "draft"  # человек заполняет шаги
    SUBMITTED = "submitted"  # «Проверка»: ждёт модератора
    APPROVED = "approved"
    REJECTED = "rejected"


class DocumentKind(StrEnum):
    REGISTRATION = "registration"  # «Свидетельство о регистрации»
    TERRITORY_PHOTO = "territory_photo"  # «Фото территории или вольеров», 3–10 штук


class OnboardingRequest(Base):
    """Заявка на подключение приюта или волонтёра (4 шага из макета)."""

    __tablename__ = "onboarding_requests"
    __table_args__ = (
        # Одна незавершённая заявка на человека.
        Index(
            "uq_onboarding_requests_active_user",
            "user_id",
            unique=True,
            postgresql_where=text("status IN ('draft', 'submitted')"),
        ),
        Index("ix_onboarding_requests_created_at_id", "created_at", "id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[OnboardingType] = mapped_column(pg_enum(OnboardingType, "onboarding_type"))
    status: Mapped[OnboardingStatus] = mapped_column(
        pg_enum(OnboardingStatus, "onboarding_status"),
        default=OnboardingStatus.DRAFT,
        server_default=OnboardingStatus.DRAFT,
    )
    # Шаг «Кто вы»
    name: Mapped[str] = mapped_column(String(120))
    city: Mapped[City | None] = mapped_column(pg_enum(City, "city"))
    contact_phone: Mapped[str | None] = mapped_column(String(16))
    # Шаг «Документы»
    recommender: Mapped[str | None] = mapped_column(String(200))
    # Шаг «Профиль»
    about: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(String(255))
    visit_hours: Mapped[str | None] = mapped_column(String(120))
    # Решение модератора
    reject_reason: Mapped[str | None] = mapped_column(Text)
    shelter_id: Mapped[UUID | None] = mapped_column(ForeignKey("shelters.id", ondelete="SET NULL"))
    decided_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    submitted_at: Mapped[datetime | None]
    decided_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.clock_timestamp())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class OnboardingDocument(Base):
    """Файл в приватном бакете: видит только команда проверки."""

    __tablename__ = "onboarding_documents"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    request_id: Mapped[UUID] = mapped_column(
        ForeignKey("onboarding_requests.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[DocumentKind] = mapped_column(pg_enum(DocumentKind, "document_kind"))
    filename: Mapped[str] = mapped_column(String(200))
    content_type: Mapped[str] = mapped_column(String(64))
    size: Mapped[int | None] = mapped_column(Integer)  # известен после подтверждения
    confirmed: Mapped[bool] = mapped_column(default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(server_default=func.clock_timestamp())
