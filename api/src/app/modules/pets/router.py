from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from app.core.clock import Today
from app.core.pagination import Page, PageQuery
from app.modules.auth.dependencies import CurrentUser, OptionalUser
from app.modules.pets.dependencies import PetServiceDep
from app.modules.pets.schemas import (
    FavoriteOut,
    ManagedPetFilters,
    PetCardOut,
    PetCreate,
    PetDetailOut,
    PetFilters,
    PetPhotoOut,
    PetStatusIn,
    PetUpdate,
    PhotoOrderIn,
)

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


# --- кабинет куратора


@router.post("", status_code=201)
async def create_pet(body: PetCreate, user: CurrentUser, service: PetServiceDep) -> PetDetailOut:
    return await service.create_pet(user, body)


@router.patch("/{pet_id}")
async def update_pet(
    pet_id: UUID, body: PetUpdate, user: CurrentUser, service: PetServiceDep
) -> PetDetailOut:
    return await service.update_pet(pet_id, user, body)


@router.post("/{pet_id}/publish")
async def publish_pet(pet_id: UUID, user: CurrentUser, service: PetServiceDep) -> PetDetailOut:
    return await service.publish(pet_id, user)


@router.patch("/{pet_id}/status")
async def change_pet_status(
    pet_id: UUID, body: PetStatusIn, user: CurrentUser, service: PetServiceDep
) -> PetDetailOut:
    return await service.change_status(pet_id, user, body.status)


@router.delete("/{pet_id}", status_code=204)
async def delete_pet(pet_id: UUID, user: CurrentUser, service: PetServiceDep) -> None:
    await service.delete_pet(pet_id, user)


@router.delete("/{pet_id}/photos/{photo_id}", status_code=204)
async def delete_pet_photo(
    pet_id: UUID, photo_id: UUID, user: CurrentUser, service: PetServiceDep
) -> None:
    await service.delete_photo(pet_id, photo_id, user)


@router.put("/{pet_id}/photos/order")
async def reorder_pet_photos(
    pet_id: UUID, body: PhotoOrderIn, user: CurrentUser, service: PetServiceDep
) -> list[PetPhotoOut]:
    return await service.reorder_photos(pet_id, user, body.photo_ids)


@me_router.get("/pets")
async def list_my_pets(
    filters: Annotated[ManagedPetFilters, Query()], user: CurrentUser, service: PetServiceDep
) -> Page[PetCardOut]:
    """Анкеты, которые ведёт человек: свои и его приютов, включая черновики."""
    return await service.list_managed(user, filters)


@me_router.get("/pets/{pet_id}")
async def get_my_pet(pet_id: UUID, user: CurrentUser, service: PetServiceDep) -> PetDetailOut:
    return await service.managed_detail(pet_id, user)
