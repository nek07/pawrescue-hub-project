from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.db import DbSession
from app.core.pagination import Page
from app.modules.auth.dependencies import CurrentUser, OptionalUser
from app.modules.curators.schemas import (
    CuratingOut,
    CuratorCardOut,
    CuratorFilters,
    ShelterProfileOut,
    SubscriptionOut,
)
from app.modules.curators.service import CuratorService
from app.modules.pets.dependencies import get_pet_service
from app.modules.shelters.repository import ShelterRepository
from app.modules.shelters.service import ShelterService
from app.modules.users.repository import UserRepository
from app.modules.users.service import UserService

router = APIRouter(prefix="/curators", tags=["curators"])
# Профиль приюта собирается здесь же: ему нужны и приют, и счётчики питомцев.
shelters_router = APIRouter(prefix="/shelters", tags=["shelters"])
me_router = APIRouter(prefix="/me", tags=["me"])


def get_curator_service(session: DbSession) -> CuratorService:
    return CuratorService(
        ShelterService(ShelterRepository(session)),
        UserService(UserRepository(session)),
        get_pet_service(session),
    )


ServiceDep = Annotated[CuratorService, Depends(get_curator_service)]


@router.get("")
async def list_curators(
    filters: Annotated[CuratorFilters, Query()], service: ServiceDep, viewer: OptionalUser
) -> Page[CuratorCardOut]:
    return await service.list_curators(filters, viewer.id if viewer else None)


@shelters_router.get("/{shelter_id}")
async def get_shelter(
    shelter_id: UUID, service: ServiceDep, viewer: OptionalUser
) -> ShelterProfileOut:
    return await service.shelter_profile(shelter_id, viewer.id if viewer else None)


@shelters_router.put("/{shelter_id}/subscription")
async def subscribe(shelter_id: UUID, user: CurrentUser, service: ServiceDep) -> SubscriptionOut:
    count = await service.shelters.set_subscription(shelter_id, user.id, subscribed=True)
    return SubscriptionOut(subscribed=True, subscribers_count=count)


@shelters_router.delete("/{shelter_id}/subscription")
async def unsubscribe(shelter_id: UUID, user: CurrentUser, service: ServiceDep) -> SubscriptionOut:
    count = await service.shelters.set_subscription(shelter_id, user.id, subscribed=False)
    return SubscriptionOut(subscribed=False, subscribers_count=count)


@me_router.get("/subscriptions")
async def list_subscriptions(user: CurrentUser, service: ServiceDep) -> Page[CuratorCardOut]:
    return await service.my_subscriptions(user.id)


@me_router.get("/curating")
async def curating(user: CurrentUser, service: ServiceDep) -> CuratingOut:
    """Кабинет куратора: приюты, от имени которых можно вести анкеты, и статус волонтёра."""
    return await service.curating(user)
