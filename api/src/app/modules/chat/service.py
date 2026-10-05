"""Сообщения между человеком и куратором.

Источник правды — PostgreSQL: POST сохраняет сообщение, а событие в Redis только
сообщает открытым вкладкам, что пора его показать.
"""

from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.core.pagination import Page
from app.core.pubsub import PubSub
from app.modules.applications.service import ApplicationService
from app.modules.chat.models import ChatSide, Conversation, Message, MessageKind
from app.modules.chat.repository import ChatRepository
from app.modules.chat.schemas import (
    ApplicationRefOut,
    ConversationOut,
    CounterpartOut,
    MessageOut,
    MessagesQuery,
    StartConversationIn,
)
from app.modules.pets.models import Pet
from app.modules.pets.service import PetService
from app.modules.shelters.service import ShelterService
from app.modules.users.models import User, UserRole
from app.modules.users.service import UserService

AFTER_LIMIT = 100  # сколько догружаем после реконнекта за раз


def _not_found() -> DomainError:
    return DomainError("conversation_not_found", status=404, message="Conversation not found")


class ChatService:
    def __init__(
        self,
        session: AsyncSession,
        repo: ChatRepository,
        pets: PetService,
        shelters: ShelterService,
        users: UserService,
        applications: ApplicationService,
        pubsub: PubSub,
    ) -> None:
        self.session, self.repo, self.pets = session, repo, pets
        self.shelters, self.users, self.applications = shelters, users, applications
        self.pubsub = pubsub

    # --- начать диалог

    async def start(self, user: User, data: StartConversationIn) -> ConversationOut:
        if data.pet_id is not None:
            pet = await self.pets.get_pet(data.pet_id)
            if await self.pets.is_curator(pet, user.id):
                raise DomainError("own_pet", status=409, message="This is your own pet")
            conversation = await self.ensure_for_pet(user.id, pet)
        elif data.shelter_id is not None:
            shelter = await self.shelters.get_shelter(data.shelter_id)
            if await self.shelters.is_member(shelter.id, user.id):
                raise DomainError("own_shelter", status=409, message="This is your own shelter")
            conversation = await self._ensure(user.id, shelter_id=shelter.id)
        else:
            assert data.volunteer_id is not None
            volunteer = await self.users.get_user(data.volunteer_id)
            if (
                volunteer is None
                or volunteer.role != UserRole.VOLUNTEER
                or volunteer.verified_at is None
                or volunteer.blocked_at is not None
            ):
                raise DomainError("curator_not_found", status=404, message="Volunteer not found")
            if volunteer.id == user.id:
                raise DomainError("self_chat", status=409, message="Cannot message yourself")
            conversation = await self._ensure(user.id, volunteer_id=volunteer.id)
        await self.session.commit()
        return (await self._outs([conversation], user))[0]

    async def ensure_for_pet(self, user_id: UUID, pet: Pet) -> Conversation:
        """Диалог о питомце с его куратором; создаётся один раз (и из воркера заявок)."""
        return await self._ensure(
            user_id, pet_id=pet.id, shelter_id=pet.shelter_id, volunteer_id=pet.volunteer_id
        )

    async def _ensure(
        self,
        user_id: UUID,
        *,
        pet_id: UUID | None = None,
        shelter_id: UUID | None = None,
        volunteer_id: UUID | None = None,
    ) -> Conversation:
        target = (
            {"pet_id": pet_id}
            if pet_id
            else {"shelter_id": shelter_id, "volunteer_id": volunteer_id}
        )
        found = await self.repo.find(user_id=user_id, **target)
        if found is not None:
            return found
        try:
            async with self.session.begin_nested():  # гонка двух «Спросить куратора»
                return await self.repo.create(
                    user_id=user_id, pet_id=pet_id, shelter_id=shelter_id, volunteer_id=volunteer_id
                )
        except IntegrityError:
            found = await self.repo.find(user_id=user_id, **target)
            if found is None:
                raise
            return found

    # --- чтение

    async def list_conversations(self, user: User, q: MessagesQuery) -> Page[ConversationOut]:
        shelter_ids = await self.shelters.member_shelter_ids(user.id)
        items, next_cursor, total = await self.repo.page(
            user_id=user.id, shelter_ids=shelter_ids, params=q.page()
        )
        return Page(items=await self._outs(items, user), next_cursor=next_cursor, total=total)

    async def get(self, conversation_id: UUID, user: User) -> ConversationOut:
        conversation, _ = await self._access(conversation_id, user)
        return (await self._outs([conversation], user))[0]

    async def messages(
        self, conversation_id: UUID, user: User, q: MessagesQuery
    ) -> Page[MessageOut]:
        conversation, _ = await self._access(conversation_id, user)
        if q.after is not None:
            after = await self.repo.messages_after(conversation.id, q.after, AFTER_LIMIT)
            items = [MessageOut.from_message(m) for m in after]
            return Page(items=items, next_cursor=None, total=len(items))
        rows, next_cursor, total = await self.repo.messages_page(conversation.id, q.page())
        return Page(
            items=[MessageOut.from_message(m) for m in rows], next_cursor=next_cursor, total=total
        )

    async def unread_count(self, user: User) -> int:
        shelter_ids = await self.shelters.member_shelter_ids(user.id)
        counts = await self.repo.unread_counts(user_id=user.id, shelter_ids=shelter_ids)
        return sum(counts.values())

    # --- запись

    async def send(self, conversation_id: UUID, user: User, text: str) -> MessageOut:
        conversation, side = await self._access(conversation_id, user)
        message = await self.repo.add_message(
            conversation, sender_id=user.id, side=side, kind=MessageKind.TEXT, text=text
        )
        self._mark_read(conversation, side, message)  # своё сообщение прочитано мной
        await self.session.commit()
        out = MessageOut.from_message(message)
        await self._publish(
            conversation, {"type": "message.new", "message": out.model_dump(mode="json")}
        )
        return out

    async def post_system(self, conversation: Conversation, text: str) -> MessageOut:
        """Сообщение платформы в диалоге (статусы заявки). Для воркера."""
        message = await self.repo.add_message(conversation, kind=MessageKind.SYSTEM, text=text)
        await self.session.commit()
        out = MessageOut.from_message(message)
        await self._publish(
            conversation, {"type": "message.new", "message": out.model_dump(mode="json")}
        )
        return out

    async def mark_read(self, conversation_id: UUID, user: User) -> None:
        conversation, side = await self._access(conversation_id, user)
        latest = await self.repo.latest_message_at(conversation.id)
        if latest is None:
            return
        if side == ChatSide.USER:
            conversation.user_last_read_at = latest
        else:
            conversation.curator_last_read_at = latest
        await self.session.commit()
        await self._publish(
            conversation,
            {
                "type": "message.read",
                "conversation_id": str(conversation.id),
                "side": side.value,
                "read_at": latest.isoformat(),
            },
        )

    async def typing(self, conversation_id: UUID, user: User) -> None:
        conversation, side = await self._access(conversation_id, user)
        # «Печатает…» видит только другая сторона.
        recipients = (
            await self._curator_user_ids(conversation)
            if side == ChatSide.USER
            else [conversation.user_id]
        )
        await self.pubsub.publish(
            recipients,
            {"type": "typing", "conversation_id": str(conversation.id), "side": side.value},
        )

    # --- права и участники

    async def _access(self, conversation_id: UUID, user: User) -> tuple[Conversation, ChatSide]:
        conversation = await self.repo.get(conversation_id)
        if conversation is None:
            raise _not_found()
        side = await self.side_of(conversation, user.id)
        if side is None:
            raise _not_found()  # чужой диалог выглядит как несуществующий
        return conversation, side

    async def side_of(self, conversation: Conversation, user_id: UUID) -> ChatSide | None:
        if conversation.user_id == user_id:
            return ChatSide.USER
        if conversation.volunteer_id == user_id:
            return ChatSide.CURATOR
        if conversation.shelter_id and await self.shelters.is_member(
            conversation.shelter_id, user_id
        ):
            return ChatSide.CURATOR
        return None

    async def participants(self, conversation: Conversation) -> list[UUID]:
        return [conversation.user_id, *await self._curator_user_ids(conversation)]

    async def _curator_user_ids(self, conversation: Conversation) -> list[UUID]:
        if conversation.volunteer_id is not None:
            return [conversation.volunteer_id]
        assert conversation.shelter_id is not None
        return await self.shelters.member_user_ids(conversation.shelter_id)

    async def _publish(self, conversation: Conversation, event: dict[str, object]) -> None:
        event.setdefault("conversation_id", str(conversation.id))
        await self.pubsub.publish(await self.participants(conversation), event)

    @staticmethod
    def _mark_read(conversation: Conversation, side: ChatSide, message: Message) -> None:
        if side == ChatSide.USER:
            conversation.user_last_read_at = message.created_at
        else:
            conversation.curator_last_read_at = message.created_at

    # --- сборка ответа

    async def _outs(self, conversations: list[Conversation], user: User) -> list[ConversationOut]:
        if not conversations:
            return []
        ids = [c.id for c in conversations]
        shelter_ids = await self.shelters.member_shelter_ids(user.id)
        last = await self.repo.last_messages(ids)
        unread = await self.repo.unread_counts(
            user_id=user.id, shelter_ids=shelter_ids, conversation_ids=ids
        )
        cards = await self.pets.get_cards({c.pet_id for c in conversations if c.pet_id})
        shelters = await self.shelters.get_shelters(
            {c.shelter_id for c in conversations if c.shelter_id}
        )
        people = await self.users.get_users(
            {c.volunteer_id for c in conversations if c.volunteer_id}
            | {c.user_id for c in conversations}
        )
        applications = await self.applications.latest_for_pairs(
            {(c.pet_id, c.user_id) for c in conversations if c.pet_id}
        )

        result = []
        for c in conversations:
            my_side = ChatSide.USER if c.user_id == user.id else ChatSide.CURATOR
            if my_side == ChatSide.CURATOR:
                person = people[c.user_id]
                counterpart = CounterpartOut(
                    type="user",
                    id=person.id,
                    name=person.name,
                    avatar_url=person.avatar_url,
                    verified=False,
                )
            elif c.shelter_id:
                s = shelters[c.shelter_id]
                counterpart = CounterpartOut(
                    type="shelter", id=s.id, name=s.name, avatar_url=s.avatar_url,
                    verified=s.verified_at is not None,
                )  # fmt: skip
            else:
                assert c.volunteer_id is not None
                v = people[c.volunteer_id]
                counterpart = CounterpartOut(
                    type="volunteer", id=v.id, name=v.name, avatar_url=v.avatar_url,
                    verified=v.verified_at is not None,
                )  # fmt: skip
            application = applications.get((c.pet_id, c.user_id)) if c.pet_id else None
            result.append(
                ConversationOut(
                    id=c.id,
                    my_side=my_side,
                    counterpart=counterpart,
                    pet=cards.get(c.pet_id) if c.pet_id else None,
                    last_message=MessageOut.from_message(last[c.id]) if c.id in last else None,
                    last_message_at=c.last_message_at,
                    unread_count=unread.get(c.id, 0),
                    application=ApplicationRefOut(id=application.id, status=application.status)
                    if application
                    else None,
                )
            )
        return result
