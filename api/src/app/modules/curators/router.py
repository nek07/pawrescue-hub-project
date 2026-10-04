from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.db import DbSession
from app.core.pagination import Page
from app.modules.curators.schemas import CuratorCardOut, CuratorFilters, ShelterProfileOut
from app.modules.curators.service import CuratorService
from app.modules.pets.dependencies import get_pet_service
from app.modules.shelters.repository import ShelterRepository
from app.modules.shelters.service import ShelterService
from app.modules.users.repository import UserRepository
from app.modules.users.service import UserService

router = APIRouter(prefix="/curators", tags=["curators"])
# Профиль приюта собирается здесь же: ему нужны и приют, и счётчики питомцев.
shelters_router = APIRouter(prefix="/shelters", tags=["shelters"])


def get_curator_service(session: DbSession) -> CuratorService:
    return CuratorService(
        ShelterService(ShelterRepository(session)),
        UserService(UserRepository(session)),
        get_pet_service(session),
    )


@router.get("")
async def list_curators(
    filters: Annotated[CuratorFilters, Query()],
    service: Annotated[CuratorService, Depends(get_curator_service)],
) -> Page[CuratorCardOut]:
    return await service.list_curators(filters)


@shelters_router.get("/{shelter_id}")
async def get_shelter(
    shelter_id: UUID, service: Annotated[CuratorService, Depends(get_curator_service)]
) -> ShelterProfileOut:
    return await service.shelter_profile(shelter_id)
