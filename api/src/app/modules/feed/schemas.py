from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, BaseModel, Field
from pydantic_core import PydanticCustomError

from app.core.cities import City
from app.core.pagination import PageQuery
from app.modules.feed.models import PhotoLabel, PostKind
from app.modules.pets.schemas import PetCardOut

POST_MAX = 5000
COMMENT_MAX = 2000


def _post_body(value: str) -> str:
    value = value.strip()
    if not value:
        raise PydanticCustomError("post_empty", "Post is empty")
    if len(value) > POST_MAX:
        raise PydanticCustomError("post_too_long", "Post is too long")
    return value


def _comment_body(value: str) -> str:
    value = value.strip()
    if not value:
        raise PydanticCustomError("comment_empty", "Comment is empty")
    if len(value) > COMMENT_MAX:
        raise PydanticCustomError("comment_too_long", "Comment is too long")
    return value


class FeedCategory(StrEnum):
    """Вкладки ленты из макета."""

    ALL = "all"  # «Все посты»
    CURATORS = "curators"  # «Приюты и волонтёры»
    OWNERS = "owners"  # «Новые хозяева»
    BEFORE_AFTER = "before_after"  # «Истории „до и после“»
    HELP = "help"  # «Нужна помощь»


class PostFilters(PageQuery):
    category: FeedCategory = FeedCategory.ALL
    kind: PostKind | None = None
    pet_id: UUID | None = None  # «Обновления от куратора» на странице питомца
    shelter_id: UUID | None = None  # вкладка «Лента» в профиле приюта
    author_id: UUID | None = None  # лента волонтёра


class PostCreate(BaseModel):
    kind: PostKind
    pet_id: UUID | None = None
    # Пост от имени приюта: автор должен быть его сотрудником.
    shelter_id: UUID | None = None
    title: str | None = Field(default=None, max_length=160)
    body: Annotated[str, AfterValidator(_post_body)]


class CommentCreate(BaseModel):
    body: Annotated[str, AfterValidator(_comment_body)]
    parent_id: UUID | None = None  # ответ на комментарий (один уровень)
    as_shelter: bool = False  # ответить от имени приюта — автора поста


class AuthorOut(BaseModel):
    type: Literal["shelter", "volunteer", "owner", "user"]
    id: UUID
    name: str
    avatar_url: str | None
    verified: bool
    city: City | None


class PostPhotoOut(BaseModel):
    id: UUID
    url: str
    card_url: str
    original_url: str
    label: PhotoLabel | None
    caption: str | None


class CommentOut(BaseModel):
    id: UUID
    post_id: UUID
    parent_id: UUID | None
    author: AuthorOut
    body: str
    likes_count: int
    liked_by_me: bool
    created_at: datetime
    replies: list["CommentOut"] = []


class PostOut(BaseModel):
    id: UUID
    kind: PostKind
    author: AuthorOut
    title: str | None
    body: str
    pet: PetCardOut | None
    photos: list[PostPhotoOut]
    likes_count: int
    comments_count: int
    liked_by_me: bool
    # Первые комментарии под постом, как в макете; остальные — GET /posts/{id}/comments
    comments_preview: list[CommentOut]
    created_at: datetime


class LikeOut(BaseModel):
    liked: bool
    likes_count: int
