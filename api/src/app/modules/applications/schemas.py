import re
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, BaseModel, Field
from pydantic_core import PydanticCustomError

from app.core.cities import City
from app.core.pagination import PageQuery
from app.modules.applications.models import ApplicationStatus, Household, Housing
from app.modules.pets.schemas import PetCardOut

# Коды ошибок совпадают с ключами zod-схемы на фронте (applyForPet.errors.*).


def _name(value: str) -> str:
    value = value.strip()
    if len(value) < 2:
        raise PydanticCustomError("name_short", "Name is too short")
    return value


def _phone(value: str) -> str:
    phone = re.sub(r"[\s\-()]", "", value)
    if re.fullmatch(r"8\d{10}", phone):  # 8 701 … → +7 701 …
        phone = "+7" + phone[1:]
    if not re.fullmatch(r"\+7\d{10}", phone):
        raise PydanticCustomError("phone_incomplete", "Phone must have 11 digits")
    return phone


def _consent(value: bool) -> bool:
    if value is not True:
        raise PydanticCustomError("consent_required", "Consent is required")
    return value


def _unique(values: list[Household]) -> list[Household]:
    return list(dict.fromkeys(values))


class ApplicationCreate(BaseModel):
    name: Annotated[str, Field(max_length=100), AfterValidator(_name)]
    phone: Annotated[str, Field(max_length=32), AfterValidator(_phone)]
    city: City
    housing: Housing
    household: Annotated[list[Household], AfterValidator(_unique)] = []
    about: str | None = Field(default=None, max_length=1000)
    consent: Annotated[bool, AfterValidator(_consent)]


class ApplicationStatusIn(BaseModel):
    status: ApplicationStatus


class ApplicationFilters(PageQuery):
    status: ApplicationStatus | None = None
    pet_id: UUID | None = None  # только для входящих: заявки на одного питомца


class ApplicationOut(BaseModel):
    id: UUID
    status: ApplicationStatus
    pet: PetCardOut
    name: str
    # null для куратора, пока заявка не одобрена
    phone: str | None
    city: City
    housing: Housing
    household: list[Household]
    about: str | None
    created_at: datetime
    updated_at: datetime
    viewer_role: Literal["applicant", "curator"]
    # Какие статусы этот человек может поставить сейчас — фронт рисует по ним кнопки.
    allowed_transitions: list[ApplicationStatus]
