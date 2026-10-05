from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Index, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, pg_enum


class PostKind(StrEnum):
    STORY = "story"  # «Тоша уехал домой», «Месяц дома: Бусинка»
    HELP = "help"  # «Нужна помощь»: передержка, корм, лекарства
    UPDATE = "update"  # «Обновления от куратора» на странице питомца


class PostAuthorType(StrEnum):
    """Кто написал — фиксируем при создании, чтобы фильтровать ленту без join."""

    SHELTER = "shelter"  # сотрудник от имени приюта
    VOLUNTEER = "volunteer"  # проверенный волонтёр
    OWNER = "owner"  # новый хозяин, забравший питомца через платформу


class PhotoLabel(StrEnum):
    BEFORE = "before"  # «Февраль, в приюте»
    AFTER = "after"  # «Сегодня, дома»


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (Index("ix_posts_created_at_id", "created_at", "id"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    author_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    author_type: Mapped[PostAuthorType] = mapped_column(pg_enum(PostAuthorType, "post_author_type"))
    shelter_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("shelters.id", ondelete="CASCADE"), index=True
    )
    pet_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("pets.id", ondelete="SET NULL"), index=True
    )
    kind: Mapped[PostKind] = mapped_column(pg_enum(PostKind, "post_kind"))
    title: Mapped[str | None] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    hidden_at: Mapped[datetime | None]  # скрыт модератором
    created_at: Mapped[datetime] = mapped_column(server_default=func.clock_timestamp())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class PostPhoto(Base):
    __tablename__ = "post_photos"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    post_id: Mapped[UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(500))
    card_url: Mapped[str | None] = mapped_column(String(500))
    original_url: Mapped[str | None] = mapped_column(String(500))
    label: Mapped[PhotoLabel | None] = mapped_column(pg_enum(PhotoLabel, "photo_label"))
    caption: Mapped[str | None] = mapped_column(String(80))
    position: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class PostLike(Base):
    __tablename__ = "post_likes"

    post_id: Mapped[UUID] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Comment(Base):
    """Комментарий или ответ на него — только один уровень вложенности."""

    __tablename__ = "comments"
    __table_args__ = (Index("ix_comments_post_created", "post_id", "created_at", "id"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    post_id: Mapped[UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"))
    author_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # Ответ от имени приюта: «"Тёплый угол" Асель, спасибо, что делились!»
    shelter_id: Mapped[UUID | None] = mapped_column(ForeignKey("shelters.id", ondelete="CASCADE"))
    parent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), index=True
    )
    body: Mapped[str] = mapped_column(Text)
    hidden_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.clock_timestamp())


class CommentLike(Base):
    __tablename__ = "comment_likes"

    comment_id: Mapped[UUID] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
