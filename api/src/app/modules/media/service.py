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
from app.modules.feed.schemas import PostPhotoOut
from app.modules.feed.service import FeedService
from app.modules.media.images import InvalidImageError, render_variants
from app.modules.media.models import MediaUpload, UploadPurpose, UploadStatus
from app.modules.media.repository import MediaRepository
from app.modules.media.schemas import (
    MAX_UPLOAD_BYTES,
    UPLOAD_URL_TTL,
    UploadCreate,
    UploadOut,
    UploadTicketOut,
)
from app.modules.pets.schemas import PetPhotoOut
from app.modules.pets.service import PetService
from app.modules.users.models import User


def _staged_key(upload: MediaUpload) -> str:
    """Проверенная копия файла: presigned URL на этот ключ никто не получал."""
    return f"confirmed/{upload.id}"


class MediaService:
    def __init__(
        self,
        session: AsyncSession,
        repo: MediaRepository,
        pets: PetService,
        feed: FeedService,
        storage: Storage,
        queue: Queue,
        settings: Settings,
    ) -> None:
        self.session, self.repo, self.pets, self.feed = session, repo, pets, feed
        self.storage, self.queue = storage, queue
        self.uploads_bucket = settings.s3_uploads_bucket
        self.photos_bucket = settings.s3_photos_bucket

    async def create_upload(self, user: User, data: UploadCreate) -> UploadTicketOut:
        upload_id = uuid4()
        if data.purpose == UploadPurpose.PET_PHOTO:
            assert data.pet_id is not None  # проверено схемой
            pet = await self.pets.get_managed_pet(data.pet_id, user.id)
            target: dict[str, object] = {"pet_id": pet.id}
            key = f"pets/{pet.id}/{upload_id}"
        else:
            assert data.post_id is not None
            post = await self.feed.get_editable_post(data.post_id, user.id)
            target = {"post_id": post.id, "label": data.label, "caption": data.caption}
            key = f"posts/{post.id}/{upload_id}"
        upload = await self.repo.create(
            id=upload_id,
            owner_id=user.id,
            purpose=data.purpose,
            key=key,
            content_type=data.content_type,
            **target,
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
        # Блокировка строки: повторный confirm ждёт первый и видит, что он уже прошёл.
        upload = await self._own(upload_id, user, for_update=True)
        if upload.status != UploadStatus.PENDING:
            raise DomainError("upload_not_pending", status=409, message="Upload already confirmed")
        if await self.storage.head(self.uploads_bucket, upload.key) is None:
            raise DomainError("upload_missing", status=409, message="File was not uploaded")
        # Presigned URL живёт ещё 15 минут — по нему можно перезалить файл после проверки.
        # Поэтому сначала копируем под ключ, на который ссылок не выдавали, и проверяем копию.
        staged = _staged_key(upload)
        await self.storage.copy(self.uploads_bucket, upload.key, staged)
        await self.storage.delete(self.uploads_bucket, upload.key)
        info = await self.storage.head(self.uploads_bucket, staged)
        if info is None or info.size > MAX_UPLOAD_BYTES:
            await self.storage.delete(self.uploads_bucket, staged)
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
        """Для воркера. Ошибки хранилища пробрасываются — воркер повторит задачу.

        Строка заблокирована до коммита: дубль задачи дождётся и увидит статус DONE.
        """
        upload = await self.repo.get(upload_id, for_update=True)
        if upload is None or upload.status != UploadStatus.PROCESSING:
            return
        staged = _staged_key(upload)
        info = await self.storage.head(self.uploads_bucket, staged)
        if info is None or info.size > MAX_UPLOAD_BYTES:  # не читаем в память что попало
            await self._fail(upload, staged, "file_too_large")
            return
        data = await self.storage.get(self.uploads_bucket, staged)
        try:
            variants = await asyncio.to_thread(render_variants, data)  # CPU — не в event loop
        except InvalidImageError:
            await self._fail(upload, staged, "image_invalid")
            return

        urls: dict[str, str] = {}
        for name, blob in variants.items():
            key = f"{upload.key}/{name}.webp"
            await self.storage.put(self.photos_bucket, key, blob, content_type="image/webp")
            urls[name] = self.storage.public_url(self.photos_bucket, key)
        if upload.purpose == UploadPurpose.PET_PHOTO:
            assert upload.pet_id is not None
            photo: PetPhotoOut | PostPhotoOut = await self.pets.add_photo(
                upload.pet_id,
                url=urls["page"],
                card_url=urls["card"],
                original_url=urls["original"],
            )
        else:
            assert upload.post_id is not None
            photo = await self.feed.add_photo(
                upload.post_id,
                url=urls["page"],
                card_url=urls["card"],
                original_url=urls["original"],
                label=upload.label,
                caption=upload.caption,
            )
        upload.status, upload.result_id = UploadStatus.DONE, photo.id
        await self.session.commit()
        await self.storage.delete(self.uploads_bucket, staged)

    async def _fail(self, upload: MediaUpload, staged: str, error: str) -> None:
        upload.status, upload.error = UploadStatus.FAILED, error
        await self.session.commit()
        await self.storage.delete(self.uploads_bucket, staged)

    async def _own(self, upload_id: UUID, user: User, *, for_update: bool = False) -> MediaUpload:
        upload = await self.repo.get(upload_id, for_update=for_update)
        if upload is None or upload.owner_id != user.id:
            raise DomainError("upload_not_found", status=404, message="Upload not found")
        return upload

    async def _out(self, upload: MediaUpload) -> UploadOut:
        photo: PetPhotoOut | PostPhotoOut | None = None
        if upload.result_id and upload.purpose == UploadPurpose.PET_PHOTO:
            photo = await self.pets.get_photo(upload.result_id)
        elif upload.result_id:
            photo = await self.feed.get_photo(upload.result_id)
        return UploadOut(id=upload.id, status=upload.status, error=upload.error, photo=photo)
