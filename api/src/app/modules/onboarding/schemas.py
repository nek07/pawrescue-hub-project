import re
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, BaseModel, Field
from pydantic_core import PydanticCustomError

from app.core.cities import City
from app.core.pagination import PageQuery
from app.modules.onboarding.models import DocumentKind, OnboardingStatus, OnboardingType

MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
MIN_TERRITORY_PHOTOS = 3
MAX_TERRITORY_PHOTOS = 10
DOCUMENT_URL_TTL = 15 * 60
VIEW_URL_TTL = 5 * 60  # модератору — короткие ссылки


def _phone(value: str | None) -> str | None:
    if value is None:
        return None
    phone = re.sub(r"[\s\-()]", "", value)
    if re.fullmatch(r"8\d{10}", phone):
        phone = "+7" + phone[1:]
    if not re.fullmatch(r"\+7\d{10}", phone):
        raise PydanticCustomError("phone_incomplete", "Phone must have 11 digits")
    return phone


def _size(value: int) -> int:
    if value <= 0:
        raise PydanticCustomError("file_empty", "File is empty")
    if value > MAX_DOCUMENT_BYTES:
        raise PydanticCustomError("file_too_large", "File is larger than 20 MB")
    return value


class OnboardingStart(BaseModel):
    """Шаг 1 «Кто вы»."""

    type: OnboardingType
    name: str = Field(min_length=2, max_length=120)
    city: City | None = None


class OnboardingUpdate(BaseModel):
    """Шаги 1–3, частично (PATCH)."""

    name: str | None = Field(default=None, min_length=2, max_length=120)
    city: City | None = None
    contact_phone: Annotated[str | None, AfterValidator(_phone)] = None
    recommender: str | None = Field(default=None, max_length=200)
    about: str | None = Field(default=None, max_length=3000)
    address: str | None = Field(default=None, max_length=255)
    visit_hours: str | None = Field(default=None, max_length=120)


class DocumentCreate(BaseModel):
    kind: DocumentKind
    filename: str = Field(min_length=1, max_length=200)
    content_type: Literal["application/pdf", "image/jpeg", "image/png"]
    size: Annotated[int, AfterValidator(_size)]


class DocumentOut(BaseModel):
    id: UUID
    kind: DocumentKind
    filename: str
    content_type: str
    size: int | None
    confirmed: bool
    # Только в ответе модератору: короткая ссылка на просмотр.
    view_url: str | None = None


class DocumentTicketOut(DocumentOut):
    upload_url: str
    method: Literal["PUT"] = "PUT"
    headers: dict[str, str]
    expires_at: datetime


class ApplicantOut(BaseModel):
    id: UUID
    name: str
    avatar_url: str | None


class OnboardingOut(BaseModel):
    id: UUID
    type: OnboardingType
    status: OnboardingStatus
    name: str
    city: City | None
    contact_phone: str | None
    recommender: str | None
    about: str | None
    address: str | None
    visit_hours: str | None
    documents: list[DocumentOut]
    # Чего не хватает для «Отправить на проверку» — фронт подсвечивает шаги.
    missing: list[str]
    reject_reason: str | None
    shelter_id: UUID | None
    submitted_at: datetime | None
    decided_at: datetime | None
    created_at: datetime
    applicant: ApplicantOut | None = None  # для модератора


class RejectIn(BaseModel):
    reason: str = Field(min_length=3, max_length=2000)


class ModerationFilters(PageQuery):
    status: OnboardingStatus = OnboardingStatus.SUBMITTED
