from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, pg_enum


class ChatSide(StrEnum):
    USER = "user"  # человек, который ищет питомца
    CURATOR = "curator"  # приют (любой сотрудник) или волонтёр


class MessageKind(StrEnum):
    TEXT = "text"
    SYSTEM = "system"  # «Заявка на Мурку отправлена» — от платформы, без автора


class Conversation(Base):
    """Диалог человека с куратором: о конкретном питомце или просто с приютом."""

    __tablename__ = "conversations"
    __table_args__ = (
        CheckConstraint("(shelter_id IS NULL) <> (volunteer_id IS NULL)", name="one_curator"),
        # Один диалог на пару «человек + питомец» и «человек + куратор» без питомца.
        Index(
            "uq_conversations_user_pet",
            "user_id",
            "pet_id",
            unique=True,
            postgresql_where=text("pet_id IS NOT NULL"),
        ),
        Index(
            "uq_conversations_user_shelter",
            "user_id",
            "shelter_id",
            unique=True,
            postgresql_where=text("pet_id IS NULL AND shelter_id IS NOT NULL"),
        ),
        Index(
            "uq_conversations_user_volunteer",
            "user_id",
            "volunteer_id",
            unique=True,
            postgresql_where=text("pet_id IS NULL AND volunteer_id IS NOT NULL"),
        ),
        Index("ix_conversations_last_message_at_id", "last_message_at", "id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    pet_id: Mapped[UUID | None] = mapped_column(ForeignKey("pets.id", ondelete="CASCADE"))
    shelter_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("shelters.id", ondelete="CASCADE"), index=True
    )
    volunteer_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Прочитано по сторонам: у приюта отметка общая для всех сотрудников.
    user_last_read_at: Mapped[datetime | None]
    curator_last_read_at: Mapped[datetime | None]
    last_message_at: Mapped[datetime] = mapped_column(server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_conversation_created", "conversation_id", "created_at", "id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE")
    )
    sender_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    side: Mapped[ChatSide | None] = mapped_column(pg_enum(ChatSide, "chat_side"))
    kind: Mapped[MessageKind] = mapped_column(
        pg_enum(MessageKind, "message_kind"),
        default=MessageKind.TEXT,
        server_default=MessageKind.TEXT,
    )
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.clock_timestamp())
