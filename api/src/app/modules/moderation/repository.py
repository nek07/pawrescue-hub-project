"""Запросы панели модератора: видит всё, включая скрытое."""

from collections.abc import Collection
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.core.pagination import PageParams, apply_cursor, cut_page
from app.modules.feed.models import Comment, CommentLike, Post, PostLike
from app.modules.moderation.schemas import (
    ContentFilters,
    ModCommentFilters,
    ModPostFilters,
    ModUserFilters,
    Visibility,
)
from app.modules.onboarding.models import OnboardingRequest, OnboardingStatus
from app.modules.users.models import User

type LikeModel = type[PostLike] | type[CommentLike]


def _contains(column: InstrumentedAttribute[Any], q: str) -> ColumnElement[bool]:
    """ILIKE по подстроке: % и _ из запроса ищутся как обычные символы."""
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return column.ilike(f"%{escaped}%", escape="\\")


def _content_conditions(
    model: type[Post] | type[Comment], f: ContentFilters
) -> list[ColumnElement[bool]]:
    conds: list[ColumnElement[bool]] = []
    if f.visibility == Visibility.VISIBLE:
        conds.append(model.hidden_at.is_(None))
    elif f.visibility == Visibility.HIDDEN:
        conds.append(model.hidden_at.is_not(None))
    if f.author_id:
        conds.append(model.author_id == f.author_id)
    return conds


def _like_columns(model: LikeModel) -> tuple[Any, Any, Any]:
    if model is PostLike:
        return PostLike.post_id, PostLike.user_id, PostLike.created_at
    return CommentLike.comment_id, CommentLike.user_id, CommentLike.created_at


class ModerationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _page[T: (Post, Comment, User)](
        self, model: type[T], conds: list[ColumnElement[bool]], params: PageParams
    ) -> tuple[list[T], str | None, int]:
        stmt = apply_cursor(
            select(model).where(*conds), created_at=model.created_at, id_=model.id, params=params
        )
        rows = list(await self.session.scalars(stmt))
        items, next_cursor = cut_page(rows, params=params, key=lambda r: (r.created_at, r.id))
        total = await self.session.scalar(select(func.count()).select_from(model).where(*conds))
        return items, next_cursor, total or 0

    # --- контент

    async def posts(self, f: ModPostFilters) -> tuple[list[Post], str | None, int]:
        conds = _content_conditions(Post, f)
        if f.kind:
            conds.append(Post.kind == f.kind)
        if f.q:
            conds.append(_contains(Post.body, f.q) | _contains(Post.title, f.q))
        return await self._page(Post, conds, f.page())

    async def comments(self, f: ModCommentFilters) -> tuple[list[Comment], str | None, int]:
        conds = _content_conditions(Comment, f)
        if f.post_id:
            conds.append(Comment.post_id == f.post_id)
        if f.q:
            conds.append(_contains(Comment.body, f.q))
        return await self._page(Comment, conds, f.page())

    async def get_posts(self, ids: Collection[UUID]) -> dict[UUID, Post]:
        if not ids:
            return {}
        return {p.id: p for p in await self.session.scalars(select(Post).where(Post.id.in_(ids)))}

    async def get_post(self, post_id: UUID) -> Post | None:
        return await self.session.get(Post, post_id)

    async def get_comment(self, comment_id: UUID) -> Comment | None:
        return await self.session.get(Comment, comment_id)

    async def delete(self, target: Post | Comment) -> None:
        """Каскад в базе уносит ответы, лайки и фото."""
        await self.session.delete(target)
        await self.session.flush()

    async def comment_counts(self, post_ids: Collection[UUID]) -> dict[UUID, int]:
        """Все комментарии поста, скрытые тоже."""
        if not post_ids:
            return {}
        stmt = (
            select(Comment.post_id, func.count())
            .where(Comment.post_id.in_(post_ids))
            .group_by(Comment.post_id)
        )
        return dict((await self.session.execute(stmt)).tuples().all())

    # --- лайки

    async def likers(
        self, model: LikeModel, target_id: UUID, params: PageParams
    ) -> tuple[list[tuple[UUID, datetime]], str | None, int]:
        """Кто лайкнул, новые сверху: (user_id, когда)."""
        target, user, created_at = _like_columns(model)
        stmt = apply_cursor(
            select(user, created_at).where(target == target_id),
            created_at=created_at,
            id_=user,
            params=params,
        )
        rows = list((await self.session.execute(stmt)).tuples().all())
        items, next_cursor = cut_page(rows, params=params, key=lambda r: (r[1], r[0]))
        total = await self.session.scalar(select(func.count()).where(target == target_id))
        return items, next_cursor, total or 0

    async def remove_like(self, model: LikeModel, target_id: UUID, user_id: UUID) -> bool:
        target, user, _ = _like_columns(model)
        result = await self.session.execute(
            delete(model).where(target == target_id, user == user_id)
        )
        return bool(getattr(result, "rowcount", 0))

    # --- пользователи

    async def users(self, f: ModUserFilters) -> tuple[list[User], str | None, int]:
        conds: list[ColumnElement[bool]] = []
        if f.q:
            conds.append(_contains(User.name, f.q))
        if f.role:
            conds.append(User.role == f.role)
        if f.blocked is not None:
            conds.append(User.blocked_at.is_not(None) if f.blocked else User.blocked_at.is_(None))
        return await self._page(User, conds, f.page())

    async def authored_counts(
        self, model: type[Post] | type[Comment], user_ids: Collection[UUID]
    ) -> dict[UUID, int]:
        if not user_ids:
            return {}
        stmt = (
            select(model.author_id, func.count())
            .where(model.author_id.in_(user_ids))
            .group_by(model.author_id)
        )
        return dict((await self.session.execute(stmt)).tuples().all())

    # --- сводка

    async def stats(self) -> dict[str, int]:
        def count(model: Any, *conds: ColumnElement[bool]) -> Any:
            return select(func.count()).select_from(model).where(*conds).scalar_subquery()

        stmt = select(
            count(Post).label("posts"),
            count(Post, Post.hidden_at.is_not(None)).label("posts_hidden"),
            count(Comment).label("comments"),
            count(Comment, Comment.hidden_at.is_not(None)).label("comments_hidden"),
            (count(PostLike) + count(CommentLike)).label("likes"),
            count(User).label("users"),
            count(User, User.blocked_at.is_not(None)).label("users_blocked"),
            count(OnboardingRequest, OnboardingRequest.status == OnboardingStatus.SUBMITTED).label(
                "onboarding_pending"
            ),
        )
        return dict((await self.session.execute(stmt)).one()._mapping)
