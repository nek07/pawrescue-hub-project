from datetime import datetime
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import AfterValidator, BaseModel, Field, model_validator
from pydantic_core import PydanticCustomError

from app.modules.feed.models import PhotoLabel
from app.modules.feed.schemas import PostPhotoOut
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
    pet_id: UUID | None = None  # для pet_photo
    post_id: UUID | None = None  # для post_photo
    label: PhotoLabel | None = None
    caption: str | None = Field(default=None, max_length=80)
    content_type: Literal["image/jpeg", "image/png", "image/webp"]
    size: Annotated[int, AfterValidator(_size)]

    @model_validator(mode="after")
    def _target_matches_purpose(self) -> Self:
        target = self.pet_id if self.purpose == UploadPurpose.PET_PHOTO else self.post_id
        other = self.post_id if self.purpose == UploadPurpose.PET_PHOTO else self.pet_id
        if target is None or other is not None:
            raise PydanticCustomError("upload_target", "pet_id or post_id must match purpose")
        return self


class UploadOut(BaseModel):
    id: UUID
    status: UploadStatus
    error: str | None
    photo: PetPhotoOut | PostPhotoOut | None = None


class UploadTicketOut(UploadOut):
    """Ответ на создание: куда и с какими заголовками браузеру делать PUT."""

    upload_url: str
    method: Literal["PUT"] = "PUT"
    headers: dict[str, str]
    expires_at: datetime
