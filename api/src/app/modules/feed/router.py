from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.db import DbSession
from app.core.pagination import Page, PageQuery
from app.core.queue import QueueDep
from app.core.ratelimit import rate_limit
from app.modules.applications.router import get_application_service
from app.modules.auth.dependencies import CurrentUser, OptionalUser
from app.modules.feed.repository import FeedRepository
from app.modules.feed.schemas import (
    CommentCreate,
    CommentOut,
    LikeOut,
    PostCreate,
    PostFilters,
    PostOut,
)
from app.modules.feed.service import FeedService
from app.modules.pets.dependencies import get_pet_service
from app.modules.shelters.repository import ShelterRepository
from app.modules.shelters.service import ShelterService
from app.modules.users.repository import UserRepository
from app.modules.users.service import UserService

router = APIRouter(tags=["feed"])


def get_feed_service(session: DbSession, queue: QueueDep) -> FeedService:
    return FeedService(
        session,
        FeedRepository(session),
        get_pet_service(session),
        ShelterService(ShelterRepository(session)),
        UserService(UserRepository(session)),
        get_application_service(session, queue),
    )


ServiceDep = Annotated[FeedService, Depends(get_feed_service)]


@router.get("/posts")
async def list_posts(
    filters: Annotated[PostFilters, Query()], viewer: OptionalUser, service: ServiceDep
) -> Page[PostOut]:
    """Лента доступна гостю; liked_by_me — только для вошедших."""
    return await service.list_posts(filters, viewer)


@router.post(
    "/posts", status_code=201, dependencies=[Depends(rate_limit("posts", limit=10, window=3600))]
)
async def create_post(body: PostCreate, user: CurrentUser, service: ServiceDep) -> PostOut:
    return await service.create_post(user, body)


@router.get("/posts/{post_id}")
async def get_post(post_id: UUID, viewer: OptionalUser, service: ServiceDep) -> PostOut:
    return await service.get_post(post_id, viewer)


@router.delete("/posts/{post_id}", status_code=204)
async def delete_post(post_id: UUID, user: CurrentUser, service: ServiceDep) -> None:
    await service.delete_post(post_id, user)


@router.put("/posts/{post_id}/like")
async def like_post(post_id: UUID, user: CurrentUser, service: ServiceDep) -> LikeOut:
    return await service.like_post(post_id, user, liked=True)


@router.delete("/posts/{post_id}/like")
async def unlike_post(post_id: UUID, user: CurrentUser, service: ServiceDep) -> LikeOut:
    return await service.like_post(post_id, user, liked=False)


@router.get("/posts/{post_id}/comments")
async def list_comments(
    post_id: UUID, q: Annotated[PageQuery, Query()], viewer: OptionalUser, service: ServiceDep
) -> Page[CommentOut]:
    return await service.list_comments(post_id, viewer, q)


@router.post(
    "/posts/{post_id}/comments",
    status_code=201,
    dependencies=[Depends(rate_limit("comments", limit=10, window=60))],
)
async def add_comment(
    post_id: UUID, body: CommentCreate, user: CurrentUser, service: ServiceDep
) -> CommentOut:
    return await service.add_comment(post_id, user, body)


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(comment_id: UUID, user: CurrentUser, service: ServiceDep) -> None:
    await service.delete_comment(comment_id, user)


@router.put("/comments/{comment_id}/like")
async def like_comment(comment_id: UUID, user: CurrentUser, service: ServiceDep) -> LikeOut:
    return await service.like_comment(comment_id, user, liked=True)


@router.delete("/comments/{comment_id}/like")
async def unlike_comment(comment_id: UUID, user: CurrentUser, service: ServiceDep) -> LikeOut:
    return await service.like_comment(comment_id, user, liked=False)
