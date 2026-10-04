"""Фото питомцев: presigned URL → браузер грузит сам → подтверждение → воркер.

1. POST /media/uploads — проверяем права, выдаём presigned PUT на 15 минут.
2. Браузер кладёт файл в приватный бакет uploads, минуя API.
3. POST /media/uploads/{id}/confirm — проверяем, что файл на месте и не больше лимита,
   ставим задачу воркеру.
4. Воркер делает три WebP без EXIF в публичный бакет и добавляет фото питомцу.
"""

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import DomainError
from app.core.queue import Queue
from app.core.storage import Storage
from app.modules.media.images import InvalidImageError, render_variants
from app.modules.media.models import MediaUpload, UploadStatus
from app.modules.media.repository import MediaRepository
from app.modules.media.schemas import (
    MAX_UPLOAD_BYTES,
    UPLOAD_URL_TTL,
    UploadCreate,
    UploadOut,
    UploadTicketOut,
)
from app.modules.pets.service import PetService
from app.modules.users.models import User


class MediaService:
    def __init__(
        self,
        session: AsyncSession,
        repo: MediaRepository,
        pets: PetService,
        storage: Storage,
        queue: Queue,
        settings: Settings,
    ) -> None:
        self.session, self.repo, self.pets = session, repo, pets
        self.storage, self.queue = storage, queue
        self.uploads_bucket = settings.s3_uploads_bucket
        self.photos_bucket = settings.s3_photos_bucket

    async def create_upload(self, user: User, data: UploadCreate) -> UploadTicketOut:
        pet = await self.pets.get_managed_pet(data.pet_id, user.id)
        upload_id = uuid4()
        key = f"pets/{pet.id}/{upload_id}"
        upload = await self.repo.create(
            id=upload_id,
            owner_id=user.id,
            purpose=data.purpose,
            pet_id=pet.id,
            key=key,
            content_type=data.content_type,
        )
        url = self.storage.presign_put(
            self.uploads_bucket, key, content_type=data.content_type, expires=UPLOAD_URL_TTL
        )
        await self.session.commit()
        return UploadTicketOut(
            id=upload.id,
            status=upload.status,
            error=None,
            upload_url=url,
            headers={"Content-Type": data.content_type},
            expires_at=datetime.now(UTC) + timedelta(seconds=UPLOAD_URL_TTL),
        )

    async def confirm(self, upload_id: UUID, user: User) -> UploadOut:
        upload = await self._own(upload_id, user)
        if upload.status != UploadStatus.PENDING:
            raise DomainError("upload_not_pending", status=409, message="Upload already confirmed")
        info = await self.storage.head(self.uploads_bucket, upload.key)
        if info is None:
            raise DomainError("upload_missing", status=409, message="File was not uploaded")
        if info.size > MAX_UPLOAD_BYTES:
            # Presigned PUT не ограничивает размер — проверяем по факту.
            await self.storage.delete(self.uploads_bucket, upload.key)
            upload.status, upload.error = UploadStatus.FAILED, "file_too_large"
        else:
            upload.status = UploadStatus.PROCESSING
        await self.session.commit()
        if upload.status == UploadStatus.PROCESSING:
            await self.queue.enqueue("process_pet_photo", str(upload.id))
        return await self._out(upload)

    async def get(self, upload_id: UUID, user: User) -> UploadOut:
        return await self._out(await self._own(upload_id, user))

    async def process(self, upload_id: UUID) -> None:
        """Для воркера. Ошибки хранилища пробрасываются — воркер повторит задачу."""
        upload = await self.repo.get(upload_id)
        if upload is None or upload.status != UploadStatus.PROCESSING or upload.pet_id is None:
            return
        data = await self.storage.get(self.uploads_bucket, upload.key)
        try:
            variants = await asyncio.to_thread(render_variants, data)  # CPU — не в event loop
        except InvalidImageError:
            upload.status, upload.error = UploadStatus.FAILED, "image_invalid"
            await self.session.commit()
            await self.storage.delete(self.uploads_bucket, upload.key)
            return

        urls: dict[str, str] = {}
        for name, blob in variants.items():
            key = f"{upload.key}/{name}.webp"
            await self.storage.put(self.photos_bucket, key, blob, content_type="image/webp")
            urls[name] = self.storage.public_url(self.photos_bucket, key)
        photo = await self.pets.add_photo(
            upload.pet_id, url=urls["page"], card_url=urls["card"], original_url=urls["original"]
        )
        upload.status, upload.result_id = UploadStatus.DONE, photo.id
        await self.session.commit()
        await self.storage.delete(self.uploads_bucket, upload.key)

    async def _own(self, upload_id: UUID, user: User) -> MediaUpload:
        upload = await self.repo.get(upload_id)
        if upload is None or upload.owner_id != user.id:
            raise DomainError("upload_not_found", status=404, message="Upload not found")
        return upload

    async def _out(self, upload: MediaUpload) -> UploadOut:
        photo = await self.pets.get_photo(upload.result_id) if upload.result_id else None
        return UploadOut(id=upload.id, status=upload.status, error=upload.error, photo=photo)
