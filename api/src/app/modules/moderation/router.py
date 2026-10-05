"""Панель модератора: проверка приютов и волонтёров, скрытие контента, блокировки."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.db import DbSession
from app.core.pagination import Page
from app.modules.auth.dependencies import ModeratorUser
from app.modules.feed.router import get_feed_service
from app.modules.feed.service import FeedService
from app.modules.onboarding.router import get_onboarding_service
from app.modules.onboarding.schemas import ModerationFilters, OnboardingOut, RejectIn
from app.modules.onboarding.service import OnboardingService
from app.modules.pets.dependencies import PetServiceDep
from app.modules.pets.schemas import PetDetailOut
from app.modules.users.repository import UserRepository
from app.modules.users.service import UserService

router = APIRouter(prefix="/moderation", tags=["moderation"])

OnboardingDep = Annotated[OnboardingService, Depends(get_onboarding_service)]
FeedDep = Annotated[FeedService, Depends(get_feed_service)]


@router.get("/onboarding")
async def onboarding_queue(
    filters: Annotated[ModerationFilters, Query()], _: ModeratorUser, service: OnboardingDep
) -> Page[OnboardingOut]:
    return await service.queue(filters)


@router.get("/onboarding/{request_id}")
async def review_onboarding(
    request_id: UUID, _: ModeratorUser, service: OnboardingDep
) -> OnboardingOut:
    """С короткими ссылками на документы (5 минут)."""
    return await service.review(request_id)


@router.post("/onboarding/{request_id}/approve")
async def approve_onboarding(
    request_id: UUID, moderator: ModeratorUser, service: OnboardingDep
) -> OnboardingOut:
    return await service.approve(request_id, moderator)


@router.post("/onboarding/{request_id}/reject")
async def reject_onboarding(
    request_id: UUID, body: RejectIn, moderator: ModeratorUser, service: OnboardingDep
) -> OnboardingOut:
    return await service.reject(request_id, moderator, body.reason)


@router.put("/posts/{post_id}/hidden", status_code=204)
async def hide_post(post_id: UUID, _: ModeratorUser, service: FeedDep) -> None:
    await service.set_post_hidden(post_id, hidden=True)


@router.delete("/posts/{post_id}/hidden", status_code=204)
async def unhide_post(post_id: UUID, _: ModeratorUser, service: FeedDep) -> None:
    await service.set_post_hidden(post_id, hidden=False)


@router.put("/comments/{comment_id}/hidden", status_code=204)
async def hide_comment(comment_id: UUID, _: ModeratorUser, service: FeedDep) -> None:
    await service.set_comment_hidden(comment_id, hidden=True)


@router.delete("/comments/{comment_id}/hidden", status_code=204)
async def unhide_comment(comment_id: UUID, _: ModeratorUser, service: FeedDep) -> None:
    await service.set_comment_hidden(comment_id, hidden=False)


@router.post("/pets/{pet_id}/unpublish")
async def unpublish_pet(pet_id: UUID, _: ModeratorUser, service: PetServiceDep) -> PetDetailOut:
    return await service.unpublish(pet_id)


@router.put("/users/{user_id}/blocked", status_code=204)
async def block_user(user_id: UUID, _: ModeratorUser, session: DbSession) -> None:
    await UserService(UserRepository(session)).set_blocked(user_id, blocked=True)
    await session.commit()


@router.delete("/users/{user_id}/blocked", status_code=204)
async def unblock_user(user_id: UUID, _: ModeratorUser, session: DbSession) -> None:
    await UserService(UserRepository(session)).set_blocked(user_id, blocked=False)
    await session.commit()
