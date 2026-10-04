from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.db import DbSession
from app.core.pagination import Page
from app.core.queue import QueueDep
from app.modules.applications.repository import ApplicationRepository
from app.modules.applications.schemas import (
    ApplicationCreate,
    ApplicationFilters,
    ApplicationOut,
    ApplicationStatusIn,
)
from app.modules.applications.service import ApplicationService
from app.modules.auth.dependencies import CurrentUser
from app.modules.pets.dependencies import get_pet_service

router = APIRouter(tags=["applications"])


def get_application_service(session: DbSession, queue: QueueDep) -> ApplicationService:
    return ApplicationService(
        session, ApplicationRepository(session), get_pet_service(session), queue
    )


ServiceDep = Annotated[ApplicationService, Depends(get_application_service)]


@router.post("/pets/{pet_id}/applications", status_code=201)
async def apply(
    pet_id: UUID, body: ApplicationCreate, user: CurrentUser, service: ServiceDep
) -> ApplicationOut:
    return await service.apply(pet_id, user, body)


@router.get("/applications/me")
async def list_my_applications(
    filters: Annotated[ApplicationFilters, Query()], user: CurrentUser, service: ServiceDep
) -> Page[ApplicationOut]:
    return await service.list_mine(user, filters)


@router.get("/applications/incoming")
async def list_incoming_applications(
    filters: Annotated[ApplicationFilters, Query()], user: CurrentUser, service: ServiceDep
) -> Page[ApplicationOut]:
    return await service.list_incoming(user, filters)


@router.get("/applications/{application_id}")
async def get_application(
    application_id: UUID, user: CurrentUser, service: ServiceDep
) -> ApplicationOut:
    return await service.get(application_id, user)


@router.patch("/applications/{application_id}")
async def change_application_status(
    application_id: UUID, body: ApplicationStatusIn, user: CurrentUser, service: ServiceDep
) -> ApplicationOut:
    return await service.change_status(application_id, user, body.status)
