from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from app.core.clock import Today
from app.core.pagination import Page
from app.modules.pets.dependencies import PetServiceDep
from app.modules.pets.schemas import PetCardOut, PetDetailOut, PetFilters

router = APIRouter(prefix="/pets", tags=["pets"])


@router.get("")
async def list_pets(
    filters: Annotated[PetFilters, Query()], service: PetServiceDep, today: Today
) -> Page[PetCardOut]:
    return await service.list_catalog(filters, filters.page(), today=today)


@router.get("/{pet_id}")
async def get_pet(pet_id: UUID, service: PetServiceDep) -> PetDetailOut:
    return await service.get_detail(pet_id)
