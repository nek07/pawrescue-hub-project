from collections.abc import Collection
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, and_, func, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageParams, apply_cursor, cut_page
from app.modules.chat.models import ChatSide, Conversation, Message

EPOCH = datetime(1970, 1, 1, tzinfo=UTC)


def _visible_to(user_id: UUID, shelter_ids: Collection[UUID]) -> ColumnElement[bool]:
    return or_(
        Conversation.user_id == user_id,
        Conversation.volunteer_id == user_id,
        Conversation.shelter_id.in_(shelter_ids),
    )


def _unread_for(user_id: UUID) -> ColumnElement[bool]:
    """Сообщение не прочитано мной: оно со стороны собеседника (или системное)
    и пришло позже отметки «прочитано» моей стороны."""
    as_user = and_(
        Conversation.user_id == user_id,
        or_(Message.side.is_(None), Message.side == ChatSide.CURATOR),
        Message.created_at > func.coalesce(Conversation.user_last_read_at, EPOCH),
    )
    as_curator = and_(
        Conversation.user_id != user_id,
        or_(Message.side.is_(None), Message.side == ChatSide.USER),
        Message.created_at > func.coalesce(Conversation.curator_last_read_at, EPOCH),
    )
    return or_(as_user, as_curator)


class ChatRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, conversation_id: UUID) -> Conversation | None:
        return await self.session.get(Conversation, conversation_id)

    async def find(
        self,
        *,
        user_id: UUID,
        pet_id: UUID | None = None,
        shelter_id: UUID | None = None,
        volunteer_id: UUID | None = None,
    ) -> Conversation | None:
        stmt = select(Conversation).where(Conversation.user_id == user_id)
        if pet_id is not None:
            stmt = stmt.where(Conversation.pet_id == pet_id)
        else:
            stmt = stmt.where(
                Conversation.pet_id.is_(None),
                Conversation.shelter_id == shelter_id
                if shelter_id
                else Conversation.volunteer_id == volunteer_id,
            )
        return await self.session.scalar(stmt)

    async def create(self, **fields: Any) -> Conversation:
        conversation = Conversation(**fields)
        self.session.add(conversation)
        await self.session.flush()
        return conversation

    async def page(
        self, *, user_id: UUID, shelter_ids: Collection[UUID], params: PageParams
    ) -> tuple[list[Conversation], str | None, int]:
        cond = _visible_to(user_id, shelter_ids)
        stmt = apply_cursor(
            select(Conversation).where(cond),
            created_at=Conversation.last_message_at,
            id_=Conversation.id,
            params=params,
        )
        rows = list(await self.session.scalars(stmt))
        items, next_cursor = cut_page(rows, params=params, key=lambda c: (c.last_message_at, c.id))
        total = await self.session.scalar(
            select(func.count()).select_from(Conversation).where(cond)
        )
        return items, next_cursor, total or 0

    async def last_messages(self, conversation_ids: Collection[UUID]) -> dict[UUID, Message]:
        if not conversation_ids:
            return {}
        stmt = (
            select(Message)
            .where(Message.conversation_id.in_(conversation_ids))
            .distinct(Message.conversation_id)
            .order_by(Message.conversation_id, Message.created_at.desc(), Message.id.desc())
        )
        return {m.conversation_id: m for m in await self.session.scalars(stmt)}

    async def unread_counts(
        self,
        *,
        user_id: UUID,
        shelter_ids: Collection[UUID],
        conversation_ids: Collection[UUID] | None = None,
    ) -> dict[UUID, int]:
        stmt = (
            select(Message.conversation_id, func.count())
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(_visible_to(user_id, shelter_ids), _unread_for(user_id))
            .group_by(Message.conversation_id)
        )
        if conversation_ids is not None:
            stmt = stmt.where(Message.conversation_id.in_(conversation_ids))
        rows = (await self.session.execute(stmt)).tuples().all()
        return dict(rows)

    async def messages_page(
        self, conversation_id: UUID, params: PageParams
    ) -> tuple[list[Message], str | None, int]:
        cond = Message.conversation_id == conversation_id
        stmt = apply_cursor(
            select(Message).where(cond),
            created_at=Message.created_at,
            id_=Message.id,
            params=params,
        )
        rows = list(await self.session.scalars(stmt))
        items, next_cursor = cut_page(rows, params=params, key=lambda m: (m.created_at, m.id))
        total = await self.session.scalar(select(func.count()).select_from(Message).where(cond))
        return items, next_cursor, total or 0

    async def messages_after(
        self, conversation_id: UUID, message_id: UUID, limit: int
    ) -> list[Message]:
        anchor = await self.session.get(Message, message_id)
        if anchor is None or anchor.conversation_id != conversation_id:
            return []
        stmt = (
            select(Message)
            .where(
                Message.conversation_id == conversation_id,
                tuple_(Message.created_at, Message.id) > tuple_(anchor.created_at, anchor.id),
            )
            .order_by(Message.created_at, Message.id)
            .limit(limit)
        )
        return list(await self.session.scalars(stmt))

    async def add_message(self, conversation: Conversation, **fields: Any) -> Message:
        message = Message(conversation_id=conversation.id, **fields)
        self.session.add(message)
        await self.session.flush()
        await self.session.refresh(message, ["created_at"])
        conversation.last_message_at = message.created_at
        await self.session.flush()
        return message

    async def latest_message_at(self, conversation_id: UUID) -> datetime | None:
        stmt = select(func.max(Message.created_at)).where(
            Message.conversation_id == conversation_id
        )
        return await self.session.scalar(stmt)
