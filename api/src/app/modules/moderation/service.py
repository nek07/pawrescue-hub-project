"""Панель модератора: весь контент ленты (со скрытым), лайки, пользователи, сводка.

Скрыть — обратимо (PUT/DELETE …/hidden). Удалить — навсегда: вместе с ответами,
лайками и фото (каскад в базе).
"""

from collections.abc import Collection
from typing import Literal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.core.pagination import Page, PageQuery
from app.modules.feed.models import Comment, CommentLike, Post, PostAuthorType, PostLike
from app.modules.feed.repository import FeedRepository
from app.modules.feed.schemas import AuthorOut
from app.modules.moderation.repository import LikeModel, ModerationRepository
from app.modules.moderation.schemas import (
    AccountOut,
    LikerOut,
    ModCommentFilters,
    ModCommentOut,
    ModerationStats,
    ModPostFilters,
    ModPostOut,
    ModUserFilters,
    ModUserOut,
)
from app.modules.pets.service import PetService
from app.modules.shelters.models import Shelter
from app.modules.shelters.service import ShelterService
from app.modules.users.models import User, UserRole
from app.modules.users.service import UserService

POST_TITLE_EXCERPT = 80


def _not_found(what: str) -> DomainError:
    return DomainError(f"{what}_not_found", status=404, message=f"{what.capitalize()} not found")


def _account(user: User) -> AccountOut:
    return AccountOut(
        id=user.id,
        name=user.name,
        role=user.role,
        avatar_url=user.avatar_url,
        blocked=user.blocked_at is not None,
    )


def _is_verified_volunteer(user: User) -> bool:
    return user.role == UserRole.VOLUNTEER and user.verified_at is not None


def _author(
    user: User, shelter: Shelter | None, *, fallback: Literal["volunteer", "owner", "user"]
) -> AuthorOut:
    """Как подпись в ленте: от имени приюта или от человека."""
    if shelter is not None:
        return AuthorOut(
            type="shelter",
            id=shelter.id,
            name=shelter.name,
            avatar_url=shelter.avatar_url,
            verified=shelter.verified_at is not None,
            city=shelter.city,
        )
    volunteer = _is_verified_volunteer(user)
    return AuthorOut(
        type="volunteer" if volunteer else fallback,
        id=user.id,
        name=user.name,
        avatar_url=user.avatar_url,
        verified=volunteer,
        city=user.city,
    )


def _post_title(post: Post) -> str:
    if post.title:
        return post.title
    text = " ".join(post.body.split())
    return text if len(text) <= POST_TITLE_EXCERPT else text[: POST_TITLE_EXCERPT - 1] + "…"


class ModerationService:
    def __init__(
        self,
        session: AsyncSession,
        repo: ModerationRepository,
        feed: FeedRepository,
        pets: PetService,
        shelters: ShelterService,
        users: UserService,
    ) -> None:
        self.session, self.repo, self.feed = session, repo, feed
        self.pets, self.shelters, self.users = pets, shelters, users

    async def stats(self) -> ModerationStats:
        return ModerationStats(**await self.repo.stats())

    # --- посты

    async def list_posts(self, f: ModPostFilters) -> Page[ModPostOut]:
        posts, next_cursor, total = await self.repo.posts(f)
        return Page(items=await self._post_outs(posts), next_cursor=next_cursor, total=total)

    async def delete_post(self, post_id: UUID) -> None:
        post = await self.repo.get_post(post_id)
        if post is None:
            raise _not_found("post")
        await self.repo.delete(post)
        await self.session.commit()

    # --- комментарии

    async def list_comments(self, f: ModCommentFilters) -> Page[ModCommentOut]:
        comments, next_cursor, total = await self.repo.comments(f)
        return Page(items=await self._comment_outs(comments), next_cursor=next_cursor, total=total)

    async def delete_comment(self, comment_id: UUID) -> None:
        comment = await self.repo.get_comment(comment_id)
        if comment is None:
            raise _not_found("comment")
        await self.repo.delete(comment)
        await self.session.commit()

    # --- лайки

    async def likers(self, model: LikeModel, target_id: UUID, q: PageQuery) -> Page[LikerOut]:
        await self._ensure_target(model, target_id)
        rows, next_cursor, total = await self.repo.likers(model, target_id, q.page())
        users = await self.users.get_users({user_id for user_id, _ in rows})
        return Page(
            items=[
                LikerOut(account=_account(users[user_id]), created_at=created_at)
                for user_id, created_at in rows
            ],
            next_cursor=next_cursor,
            total=total,
        )

    async def remove_like(self, model: LikeModel, target_id: UUID, user_id: UUID) -> None:
        """Снять накрученный лайк. Повторный вызов — не ошибка."""
        await self._ensure_target(model, target_id)
        await self.repo.remove_like(model, target_id, user_id)
        await self.session.commit()

    async def _ensure_target(self, model: LikeModel, target_id: UUID) -> None:
        if model is PostLike:
            if await self.repo.get_post(target_id) is None:
                raise _not_found("post")
        elif await self.repo.get_comment(target_id) is None:
            raise _not_found("comment")

    # --- пользователи

    async def list_users(self, f: ModUserFilters) -> Page[ModUserOut]:
        users, next_cursor, total = await self.repo.users(f)
        ids = [u.id for u in users]
        posts = await self.repo.authored_counts(Post, ids)
        comments = await self.repo.authored_counts(Comment, ids)
        return Page(
            items=[
                ModUserOut(
                    id=u.id,
                    name=u.name,
                    role=u.role,
                    avatar_url=u.avatar_url,
                    verified=_is_verified_volunteer(u),
                    blocked_at=u.blocked_at,
                    posts_count=posts.get(u.id, 0),
                    comments_count=comments.get(u.id, 0),
                    created_at=u.created_at,
                )
                for u in users
            ],
            next_cursor=next_cursor,
            total=total,
        )

    # --- сборка ответа

    async def _people(
        self, items: Collection[Post | Comment]
    ) -> tuple[dict[UUID, User], dict[UUID, Shelter]]:
        users = await self.users.get_users({i.author_id for i in items})
        shelters = await self.shelters.get_shelters({i.shelter_id for i in items if i.shelter_id})
        return users, shelters

    async def _post_outs(self, posts: list[Post]) -> list[ModPostOut]:
        if not posts:
            return []
        ids = [p.id for p in posts]
        users, shelters = await self._people(posts)
        cards = await self.pets.get_cards({p.pet_id for p in posts if p.pet_id})
        photos = await self.feed.photos(ids)
        likes = await self.feed.like_counts(PostLike, ids)
        comments = await self.repo.comment_counts(ids)
        result = []
        for p in posts:
            user = users[p.author_id]
            fallback: Literal["volunteer", "owner"] = (
                "volunteer" if p.author_type == PostAuthorType.VOLUNTEER else "owner"
            )
            post_photos = photos.get(p.id, [])
            card = cards.get(p.pet_id) if p.pet_id else None
            result.append(
                ModPostOut(
                    id=p.id,
                    kind=p.kind,
                    author=_author(
                        user,
                        shelters.get(p.shelter_id) if p.shelter_id else None,
                        fallback=fallback,
                    ),
                    account=_account(user),
                    title=p.title,
                    body=p.body,
                    pet_name=card.name if card else None,
                    cover_url=(post_photos[0].card_url or post_photos[0].url)
                    if post_photos
                    else (card.cover_url if card else None),
                    photos_count=len(post_photos),
                    likes_count=likes.get(p.id, 0),
                    comments_count=comments.get(p.id, 0),
                    hidden_at=p.hidden_at,
                    created_at=p.created_at,
                )
            )
        return result

    async def _comment_outs(self, comments: list[Comment]) -> list[ModCommentOut]:
        if not comments:
            return []
        ids = [c.id for c in comments]
        users, shelters = await self._people(comments)
        posts = await self.repo.get_posts({c.post_id for c in comments})
        likes = await self.feed.like_counts(CommentLike, ids)
        result = []
        for c in comments:
            user, post = users[c.author_id], posts[c.post_id]
            result.append(
                ModCommentOut(
                    id=c.id,
                    post_id=c.post_id,
                    post_title=_post_title(post),
                    parent_id=c.parent_id,
                    author=_author(
                        user,
                        shelters.get(c.shelter_id) if c.shelter_id else None,
                        fallback="user",
                    ),
                    account=_account(user),
                    body=c.body,
                    likes_count=likes.get(c.id, 0),
                    hidden_at=c.hidden_at,
                    post_hidden=post.hidden_at is not None,
                    created_at=c.created_at,
                )
            )
        return result
