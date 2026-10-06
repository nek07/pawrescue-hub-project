from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.pagination import PageQuery
from app.modules.feed.models import PostKind
from app.modules.feed.schemas import AuthorOut
from app.modules.users.models import UserRole


class Visibility(StrEnum):
    ALL = "all"
    VISIBLE = "visible"
    HIDDEN = "hidden"


class ContentFilters(PageQuery):
    visibility: Visibility = Visibility.ALL
    q: str | None = Field(default=None, max_length=100)  # поиск по тексту
    author_id: UUID | None = None  # всё от одного человека


class ModPostFilters(ContentFilters):
    kind: PostKind | None = None


class ModCommentFilters(ContentFilters):
    post_id: UUID | None = None


class ModUserFilters(PageQuery):
    q: str | None = Field(default=None, max_length=100)  # поиск по имени
    role: UserRole | None = None
    blocked: bool | None = None


class AccountOut(BaseModel):
    """Настоящий аккаунт автора — даже если пост от имени приюта: его и блокируют."""

    id: UUID
    name: str
    role: UserRole
    avatar_url: str | None
    blocked: bool


class ModPostOut(BaseModel):
    id: UUID
    kind: PostKind
    author: AuthorOut
    account: AccountOut
    title: str | None
    body: str
    pet_name: str | None
    cover_url: str | None
    photos_count: int
    likes_count: int
    comments_count: int  # вместе со скрытыми
    hidden_at: datetime | None
    created_at: datetime


class ModCommentOut(BaseModel):
    id: UUID
    post_id: UUID
    post_title: str  # заголовок поста или начало его текста
    parent_id: UUID | None
    author: AuthorOut
    account: AccountOut
    body: str
    likes_count: int
    hidden_at: datetime | None
    post_hidden: bool
    created_at: datetime


class LikerOut(BaseModel):
    account: AccountOut
    created_at: datetime


class ModUserOut(BaseModel):
    id: UUID
    name: str
    role: UserRole
    avatar_url: str | None
    verified: bool
    blocked_at: datetime | None
    posts_count: int
    comments_count: int
    created_at: datetime


class ModerationStats(BaseModel):
    posts: int
    posts_hidden: int
    comments: int
    comments_hidden: int
    likes: int
    users: int
    users_blocked: int
    onboarding_pending: int
