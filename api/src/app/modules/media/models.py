from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, pg_enum
from app.modules.feed.models import PhotoLabel


class UploadPurpose(StrEnum):
    PET_PHOTO = "pet_photo"
    POST_PHOTO = "post_photo"


class UploadStatus(StrEnum):
    PENDING = "pending"  # выдан presigned URL, ждём файл
    PROCESSING = "processing"  # файл подтверждён, воркер делает WebP
    DONE = "done"
    FAILED = "failed"


class MediaUpload(Base):
    """Загрузка из браузера прямо в хранилище: байты не идут через API."""

    __tablename__ = "media_uploads"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[UploadPurpose] = mapped_column(pg_enum(UploadPurpose, "upload_purpose"))
    pet_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("pets.id", ondelete="CASCADE"), index=True
    )
    post_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), index=True
    )
    # Для фото поста: «до/после» и подпись под фото.
    label: Mapped[PhotoLabel | None] = mapped_column(pg_enum(PhotoLabel, "photo_label"))
    caption: Mapped[str | None] = mapped_column(String(80))
    key: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(64))
    status: Mapped[UploadStatus] = mapped_column(
        pg_enum(UploadStatus, "upload_status"),
        default=UploadStatus.PENDING,
        server_default=UploadStatus.PENDING,
    )
    error: Mapped[str | None] = mapped_column(String(64))
    result_id: Mapped[UUID | None]  # id PetPhoto после обработки
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
