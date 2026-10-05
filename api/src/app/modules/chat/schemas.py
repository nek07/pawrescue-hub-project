from datetime import datetime
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import AfterValidator, BaseModel, model_validator
from pydantic_core import PydanticCustomError

from app.core.pagination import PageQuery
from app.modules.applications.models import ApplicationStatus
from app.modules.chat.models import ChatSide, Message, MessageKind
from app.modules.pets.schemas import PetCardOut

MESSAGE_MAX = 4000


def _text(value: str) -> str:
    value = value.strip()
    if not value:
        raise PydanticCustomError("message_empty", "Message is empty")
    if len(value) > MESSAGE_MAX:
        raise PydanticCustomError("message_too_long", "Message is too long")
    return value


class StartConversationIn(BaseModel):
    """С кем начать диалог: о питомце («Спросить куратора») или с приютом/волонтёром."""

    pet_id: UUID | None = None
    shelter_id: UUID | None = None
    volunteer_id: UUID | None = None

    @model_validator(mode="after")
    def _one_target(self) -> Self:
        if sum(x is not None for x in (self.pet_id, self.shelter_id, self.volunteer_id)) != 1:
            raise PydanticCustomError(
                "one_target", "Pass exactly one of pet_id, shelter_id, volunteer_id"
            )
        return self


class MessageIn(BaseModel):
    text: Annotated[str, AfterValidator(_text)]


class MessagesQuery(PageQuery):
    # После реконнекта: всё, что пришло после последнего известного сообщения (по возрастанию).
    after: UUID | None = None


class MessageOut(BaseModel):
    id: UUID
    conversation_id: UUID
    kind: MessageKind
    side: ChatSide | None  # None — системное сообщение платформы
    sender_id: UUID | None
    # Для kind=system — ключ перевода: application.sent, application.approved, …
    text: str
    created_at: datetime

    @classmethod
    def from_message(cls, m: Message) -> "MessageOut":
        return cls(
            id=m.id,
            conversation_id=m.conversation_id,
            kind=m.kind,
            side=m.side,
            sender_id=m.sender_id,
            text=m.text,
            created_at=m.created_at,
        )


class CounterpartOut(BaseModel):
    type: Literal["shelter", "volunteer", "user"]
    id: UUID
    name: str
    avatar_url: str | None
    verified: bool


class ApplicationRefOut(BaseModel):
    """Для панели «Ваша заявка» рядом с диалогом."""

    id: UUID
    status: ApplicationStatus


class ConversationOut(BaseModel):
    id: UUID
    my_side: ChatSide
    counterpart: CounterpartOut
    pet: PetCardOut | None
    last_message: MessageOut | None
    last_message_at: datetime
    unread_count: int
    application: ApplicationRefOut | None


class UnreadOut(BaseModel):
    count: int
