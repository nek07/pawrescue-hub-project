from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.media.models import MediaUpload


class MediaRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, upload_id: UUID, *, for_update: bool = False) -> MediaUpload | None:
        return await self.session.get(
            MediaUpload, upload_id, with_for_update=for_update, populate_existing=for_update
        )

    async def create(self, **fields: Any) -> MediaUpload:
        upload = MediaUpload(**fields)
        self.session.add(upload)
        await self.session.flush()
        return upload
