from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from app.core.clock import Today
from app.core.pagination import Page, PageQuery
from app.modules.auth.dependencies import CurrentUser, OptionalUser
from app.modules.pets.dependencies import PetServiceDep
from app.modules.pets.schemas import FavoriteOut, PetCardOut, PetDetailOut, PetFilters

router = APIRouter(prefix="/pets", tags=["pets"])
me_router = APIRouter(prefix="/me", tags=["me"])


@router.get("")
async def list_pets(
    filters: Annotated[PetFilters, Query()],
    service: PetServiceDep,
    today: Today,
    viewer: OptionalUser,
) -> Page[PetCardOut]:
    return await service.list_catalog(
        filters, filters.page(), today=today, viewer_id=viewer.id if viewer else None
    )


@router.get("/{pet_id}")
async def get_pet(pet_id: UUID, service: PetServiceDep, viewer: OptionalUser) -> PetDetailOut:
    return await service.get_detail(pet_id, viewer.id if viewer else None)


@router.put("/{pet_id}/favorite")
async def add_favorite(pet_id: UUID, user: CurrentUser, service: PetServiceDep) -> FavoriteOut:
    return await service.set_favorite(pet_id, user.id, favorite=True)


@router.delete("/{pet_id}/favorite")
async def remove_favorite(pet_id: UUID, user: CurrentUser, service: PetServiceDep) -> FavoriteOut:
    return await service.set_favorite(pet_id, user.id, favorite=False)


@me_router.get("/favorites")
async def list_favorites(
    q: Annotated[PageQuery, Query()], user: CurrentUser, service: PetServiceDep
) -> Page[PetCardOut]:
    return await service.list_favorites(user.id, q.page())
