from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.core.db import DbSession
from app.core.queue import QueueDep
from app.core.ratelimit import rate_limit
from app.core.storage import StorageDep
from app.modules.auth.dependencies import CurrentUser
from app.modules.feed.router import get_feed_service
from app.modules.media.repository import MediaRepository
from app.modules.media.schemas import UploadCreate, UploadOut, UploadTicketOut
from app.modules.media.service import MediaService
from app.modules.pets.dependencies import get_pet_service

router = APIRouter(prefix="/media", tags=["media"])


def get_media_service(
    session: DbSession,
    storage: StorageDep,
    queue: QueueDep,
    settings: Annotated[Settings, Depends(get_settings)],
) -> MediaService:
    return MediaService(
        session,
        MediaRepository(session),
        get_pet_service(session),
        get_feed_service(session, queue),
        storage,
        queue,
        settings,
    )


ServiceDep = Annotated[MediaService, Depends(get_media_service)]


@router.post(
    "/uploads",
    status_code=201,
    dependencies=[Depends(rate_limit("uploads", limit=30, window=3600))],
)
async def create_upload(
    body: UploadCreate, user: CurrentUser, service: ServiceDep
) -> UploadTicketOut:
    return await service.create_upload(user, body)


@router.post("/uploads/{upload_id}/confirm", status_code=202)
async def confirm_upload(upload_id: UUID, user: CurrentUser, service: ServiceDep) -> UploadOut:
    return await service.confirm(upload_id, user)


@router.get("/uploads/{upload_id}")
async def get_upload(upload_id: UUID, user: CurrentUser, service: ServiceDep) -> UploadOut:
    return await service.get(upload_id, user)
