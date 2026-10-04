from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, BaseModel
from pydantic_core import PydanticCustomError

from app.modules.media.models import UploadPurpose, UploadStatus
from app.modules.pets.schemas import PetPhotoOut

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
UPLOAD_URL_TTL = 15 * 60  # presigned URL живёт 15 минут


def _size(value: int) -> int:
    if value <= 0:
        raise PydanticCustomError("file_empty", "File is empty")
    if value > MAX_UPLOAD_BYTES:
        raise PydanticCustomError("file_too_large", "File is larger than 10 MB")
    return value


class UploadCreate(BaseModel):
    purpose: UploadPurpose
    pet_id: UUID
    content_type: Literal["image/jpeg", "image/png", "image/webp"]
    size: Annotated[int, AfterValidator(_size)]


class UploadOut(BaseModel):
    id: UUID
    status: UploadStatus
    error: str | None
    photo: PetPhotoOut | None = None


class UploadTicketOut(UploadOut):
    """Ответ на создание: куда и с какими заголовками браузеру делать PUT."""

    upload_url: str
    method: Literal["PUT"] = "PUT"
    headers: dict[str, str]
    expires_at: datetime
