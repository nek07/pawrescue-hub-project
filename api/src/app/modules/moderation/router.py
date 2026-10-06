"""Панель модератора: проверка приютов и волонтёров, контент ленты, лайки, блокировки."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.db import DbSession
from app.core.pagination import Page, PageQuery
from app.modules.auth.dependencies import ModeratorUser
from app.modules.feed.models import CommentLike, PostLike
from app.modules.feed.repository import FeedRepository
from app.modules.feed.router import get_feed_service
from app.modules.feed.service import FeedService
from app.modules.moderation.repository import ModerationRepository
from app.modules.moderation.schemas import (
    LikerOut,
    ModCommentFilters,
    ModCommentOut,
    ModerationStats,
    ModPostFilters,
    ModPostOut,
    ModUserFilters,
    ModUserOut,
)
from app.modules.moderation.service import ModerationService
from app.modules.onboarding.router import get_onboarding_service
from app.modules.onboarding.schemas import ModerationFilters, OnboardingOut, RejectIn
from app.modules.onboarding.service import OnboardingService
from app.modules.pets.dependencies import PetServiceDep, get_pet_service
from app.modules.pets.schemas import PetDetailOut
from app.modules.shelters.repository import ShelterRepository
from app.modules.shelters.service import ShelterService
from app.modules.users.repository import UserRepository
from app.modules.users.service import UserService

router = APIRouter(prefix="/moderation", tags=["moderation"])

OnboardingDep = Annotated[OnboardingService, Depends(get_onboarding_service)]
FeedDep = Annotated[FeedService, Depends(get_feed_service)]


def get_moderation_service(session: DbSession) -> ModerationService:
    return ModerationService(
        session,
        ModerationRepository(session),
        FeedRepository(session),
        get_pet_service(session),
        ShelterService(ShelterRepository(session)),
        UserService(UserRepository(session)),
    )


ModerationDep = Annotated[ModerationService, Depends(get_moderation_service)]


@router.get("/stats")
async def stats(_: ModeratorUser, service: ModerationDep) -> ModerationStats:
    return await service.stats()


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


@router.get("/posts")
async def list_posts(
    filters: Annotated[ModPostFilters, Query()], _: ModeratorUser, service: ModerationDep
) -> Page[ModPostOut]:
    """Все посты, новые сверху, включая скрытые."""
    return await service.list_posts(filters)


@router.delete("/posts/{post_id}", status_code=204)
async def delete_post(post_id: UUID, _: ModeratorUser, service: ModerationDep) -> None:
    """Навсегда, вместе с комментариями, лайками и фото."""
    await service.delete_post(post_id)


@router.get("/posts/{post_id}/likes")
async def post_likers(
    post_id: UUID, q: Annotated[PageQuery, Query()], _: ModeratorUser, service: ModerationDep
) -> Page[LikerOut]:
    return await service.likers(PostLike, post_id, q)


@router.delete("/posts/{post_id}/likes/{user_id}", status_code=204)
async def remove_post_like(
    post_id: UUID, user_id: UUID, _: ModeratorUser, service: ModerationDep
) -> None:
    await service.remove_like(PostLike, post_id, user_id)


@router.put("/posts/{post_id}/hidden", status_code=204)
async def hide_post(post_id: UUID, _: ModeratorUser, service: FeedDep) -> None:
    await service.set_post_hidden(post_id, hidden=True)


@router.delete("/posts/{post_id}/hidden", status_code=204)
async def unhide_post(post_id: UUID, _: ModeratorUser, service: FeedDep) -> None:
    await service.set_post_hidden(post_id, hidden=False)


@router.get("/comments")
async def list_comments(
    filters: Annotated[ModCommentFilters, Query()], _: ModeratorUser, service: ModerationDep
) -> Page[ModCommentOut]:
    """Все комментарии и ответы, новые сверху, включая скрытые."""
    return await service.list_comments(filters)


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(comment_id: UUID, _: ModeratorUser, service: ModerationDep) -> None:
    """Навсегда, вместе с ответами и лайками."""
    await service.delete_comment(comment_id)


@router.get("/comments/{comment_id}/likes")
async def comment_likers(
    comment_id: UUID, q: Annotated[PageQuery, Query()], _: ModeratorUser, service: ModerationDep
) -> Page[LikerOut]:
    return await service.likers(CommentLike, comment_id, q)


@router.delete("/comments/{comment_id}/likes/{user_id}", status_code=204)
async def remove_comment_like(
    comment_id: UUID, user_id: UUID, _: ModeratorUser, service: ModerationDep
) -> None:
    await service.remove_like(CommentLike, comment_id, user_id)


@router.put("/comments/{comment_id}/hidden", status_code=204)
async def hide_comment(comment_id: UUID, _: ModeratorUser, service: FeedDep) -> None:
    await service.set_comment_hidden(comment_id, hidden=True)


@router.delete("/comments/{comment_id}/hidden", status_code=204)
async def unhide_comment(comment_id: UUID, _: ModeratorUser, service: FeedDep) -> None:
    await service.set_comment_hidden(comment_id, hidden=False)


@router.post("/pets/{pet_id}/unpublish")
async def unpublish_pet(pet_id: UUID, _: ModeratorUser, service: PetServiceDep) -> PetDetailOut:
    return await service.unpublish(pet_id)


@router.get("/users")
async def list_users(
    filters: Annotated[ModUserFilters, Query()], _: ModeratorUser, service: ModerationDep
) -> Page[ModUserOut]:
    return await service.list_users(filters)


@router.put("/users/{user_id}/blocked", status_code=204)
async def block_user(user_id: UUID, _: ModeratorUser, session: DbSession) -> None:
    await UserService(UserRepository(session)).set_blocked(user_id, blocked=True)
    await session.commit()


@router.delete("/users/{user_id}/blocked", status_code=204)
async def unblock_user(user_id: UUID, _: ModeratorUser, session: DbSession) -> None:
    await UserService(UserRepository(session)).set_blocked(user_id, blocked=False)
    await session.commit()
