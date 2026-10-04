from collections import defaultdict
from collections.abc import Collection
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, delete, exists, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageParams, apply_cursor, cut_page
from app.modules.feed.models import (
    Comment,
    CommentLike,
    PhotoLabel,
    Post,
    PostAuthorType,
    PostKind,
    PostLike,
    PostPhoto,
)
from app.modules.feed.schemas import FeedCategory, PostFilters

PREVIEW_COMMENTS = 3


def _has_photo(label: PhotoLabel) -> ColumnElement[bool]:
    return exists().where(PostPhoto.post_id == Post.id, PostPhoto.label == label)


def _post_conditions(f: PostFilters) -> list[ColumnElement[bool]]:
    conds: list[ColumnElement[bool]] = [Post.hidden_at.is_(None)]
    match f.category:
        case FeedCategory.CURATORS:
            conds.append(Post.author_type.in_([PostAuthorType.SHELTER, PostAuthorType.VOLUNTEER]))
        case FeedCategory.OWNERS:
            conds.append(Post.author_type == PostAuthorType.OWNER)
        case FeedCategory.HELP:
            conds.append(Post.kind == PostKind.HELP)
        case FeedCategory.BEFORE_AFTER:
            conds += [_has_photo(PhotoLabel.BEFORE), _has_photo(PhotoLabel.AFTER)]
    if f.kind:
        conds.append(Post.kind == f.kind)
    if f.pet_id:
        conds.append(Post.pet_id == f.pet_id)
    if f.shelter_id:
        conds.append(Post.shelter_id == f.shelter_id)
    if f.author_id:
        conds.append(Post.author_id == f.author_id)
    return conds


class FeedRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --- посты

    async def create_post(self, **fields: Any) -> Post:
        post = Post(**fields)
        self.session.add(post)
        await self.session.flush()
        await self.session.refresh(post, ["created_at"])
        return post

    async def get_post(self, post_id: UUID, *, include_hidden: bool = False) -> Post | None:
        post = await self.session.get(Post, post_id)
        if post is None or (post.hidden_at is not None and not include_hidden):
            return None
        return post

    async def delete_post(self, post: Post) -> None:
        await self.session.delete(post)
        await self.session.flush()

    async def page_posts(
        self, f: PostFilters, params: PageParams
    ) -> tuple[list[Post], str | None, int]:
        conds = _post_conditions(f)
        stmt = apply_cursor(
            select(Post).where(*conds), created_at=Post.created_at, id_=Post.id, params=params
        )
        rows = list(await self.session.scalars(stmt))
        items, next_cursor = cut_page(rows, params=params, key=lambda p: (p.created_at, p.id))
        total = await self.session.scalar(select(func.count()).select_from(Post).where(*conds))
        return items, next_cursor, total or 0

    async def photos(self, post_ids: Collection[UUID]) -> dict[UUID, list[PostPhoto]]:
        result: dict[UUID, list[PostPhoto]] = defaultdict(list)
        if post_ids:
            stmt = (
                select(PostPhoto)
                .where(PostPhoto.post_id.in_(post_ids))
                .order_by(PostPhoto.position, PostPhoto.created_at)
            )
            for photo in await self.session.scalars(stmt):
                result[photo.post_id].append(photo)
        return result

    async def add_photo(self, post_id: UUID, **fields: Any) -> PostPhoto:
        last = await self.session.scalar(
            select(func.max(PostPhoto.position)).where(PostPhoto.post_id == post_id)
        )
        photo = PostPhoto(post_id=post_id, position=(last + 1) if last is not None else 0, **fields)
        self.session.add(photo)
        await self.session.flush()
        return photo

    async def get_photo(self, photo_id: UUID) -> PostPhoto | None:
        return await self.session.get(PostPhoto, photo_id)

    # --- лайки

    async def like_counts(
        self, model: type[PostLike] | type[CommentLike], ids: Collection[UUID]
    ) -> dict[UUID, int]:
        if not ids:
            return {}
        key = PostLike.post_id if model is PostLike else CommentLike.comment_id
        stmt = select(key, func.count()).where(key.in_(ids)).group_by(key)
        return dict((await self.session.execute(stmt)).tuples().all())

    async def liked_by(
        self, model: type[PostLike] | type[CommentLike], ids: Collection[UUID], user_id: UUID | None
    ) -> set[UUID]:
        if not ids or user_id is None:
            return set()
        key = PostLike.post_id if model is PostLike else CommentLike.comment_id
        user = PostLike.user_id if model is PostLike else CommentLike.user_id
        stmt = select(key).where(key.in_(ids), user == user_id)
        return set(await self.session.scalars(stmt))

    async def set_like(
        self, model: type[PostLike] | type[CommentLike], target_id: UUID, user_id: UUID, liked: bool
    ) -> None:
        """Идемпотентно: повторный лайк и повторное «снять лайк» ничего не ломают."""
        key = "post_id" if model is PostLike else "comment_id"
        if liked:
            stmt = (
                insert(model).values({key: target_id, "user_id": user_id}).on_conflict_do_nothing()
            )
            await self.session.execute(stmt)
        else:
            column = PostLike.post_id if model is PostLike else CommentLike.comment_id
            user = PostLike.user_id if model is PostLike else CommentLike.user_id
            await self.session.execute(delete(model).where(column == target_id, user == user_id))

    # --- комментарии

    async def comment_counts(self, post_ids: Collection[UUID]) -> dict[UUID, int]:
        if not post_ids:
            return {}
        stmt = (
            select(Comment.post_id, func.count())
            .where(Comment.post_id.in_(post_ids), Comment.hidden_at.is_(None))
            .group_by(Comment.post_id)
        )
        return dict((await self.session.execute(stmt)).tuples().all())

    async def comments_preview(self, post_ids: Collection[UUID]) -> dict[UUID, list[Comment]]:
        result: dict[UUID, list[Comment]] = defaultdict(list)
        if not post_ids:
            return result
        rank = (
            func.row_number()
            .over(partition_by=Comment.post_id, order_by=(Comment.created_at, Comment.id))
            .label("rank")
        )
        ranked = (
            select(Comment.id, rank)
            .where(Comment.post_id.in_(post_ids), Comment.hidden_at.is_(None))
            .subquery()
        )
        stmt = (
            select(Comment)
            .join(ranked, ranked.c.id == Comment.id)
            .where(ranked.c.rank <= PREVIEW_COMMENTS)
            .order_by(Comment.created_at, Comment.id)
        )
        for comment in await self.session.scalars(stmt):
            result[comment.post_id].append(comment)
        return result

    async def comments_page(
        self, post_id: UUID, params: PageParams
    ) -> tuple[list[Comment], str | None, int]:
        """Комментарии верхнего уровня по порядку; ответы — отдельным запросом."""
        conds = [
            Comment.post_id == post_id,
            Comment.parent_id.is_(None),
            Comment.hidden_at.is_(None),
        ]
        stmt = apply_cursor(
            select(Comment).where(*conds),
            created_at=Comment.created_at,
            id_=Comment.id,
            params=params,
            newest_first=False,
        )
        rows = list(await self.session.scalars(stmt))
        items, next_cursor = cut_page(rows, params=params, key=lambda c: (c.created_at, c.id))
        total = await self.session.scalar(select(func.count()).select_from(Comment).where(*conds))
        return items, next_cursor, total or 0

    async def replies(self, parent_ids: Collection[UUID]) -> dict[UUID, list[Comment]]:
        result: dict[UUID, list[Comment]] = defaultdict(list)
        if parent_ids:
            stmt = (
                select(Comment)
                .where(Comment.parent_id.in_(parent_ids), Comment.hidden_at.is_(None))
                .order_by(Comment.created_at, Comment.id)
            )
            for reply in await self.session.scalars(stmt):
                assert reply.parent_id is not None
                result[reply.parent_id].append(reply)
        return result

    async def get_comment(self, comment_id: UUID) -> Comment | None:
        comment = await self.session.get(Comment, comment_id)
        return None if comment is None or comment.hidden_at is not None else comment

    async def add_comment(self, **fields: Any) -> Comment:
        comment = Comment(**fields)
        self.session.add(comment)
        await self.session.flush()
        await self.session.refresh(comment, ["created_at"])
        return comment

    async def delete_comment(self, comment: Comment) -> None:
        await self.session.delete(comment)
        await self.session.flush()
