"""Заявки на питомцев и их статусы.

Статус питомца меняется только здесь и в одной транзакции со статусом заявки:
одобрили → питомец «Забронирован», остальные активные заявки закрываются;
завершили → «Нашёл дом»; отменили одобренную → питомец снова ищет дом.
"""

from collections.abc import Collection
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.core.pagination import Page
from app.core.queue import Queue
from app.modules.applications.models import Application, ApplicationStatus, Household
from app.modules.applications.repository import ApplicationRepository
from app.modules.applications.schemas import (
    ApplicationCreate,
    ApplicationFilters,
    ApplicationOut,
)
from app.modules.pets.models import Pet, PetStatus
from app.modules.pets.schemas import PetCardOut
from app.modules.pets.service import PetService
from app.modules.users.models import User

S = ApplicationStatus

CURATOR_TRANSITIONS: dict[ApplicationStatus, frozenset[ApplicationStatus]] = {
    S.SENT: frozenset({S.MEETING, S.APPROVED, S.REJECTED}),
    S.MEETING: frozenset({S.APPROVED, S.REJECTED}),
    S.APPROVED: frozenset({S.COMPLETED, S.REJECTED}),
}
APPLICANT_TRANSITIONS: dict[ApplicationStatus, frozenset[ApplicationStatus]] = {
    S.SENT: frozenset({S.WITHDRAWN}),
    S.MEETING: frozenset({S.WITHDRAWN}),
    S.APPROVED: frozenset({S.WITHDRAWN}),
}
# Подать заявку можно на того, кто ищет дом или передержку (не на лечении и не занят).
OPEN_PET_STATUSES = frozenset({PetStatus.SEEKING, PetStatus.NEEDS_FOSTER})
PHONE_VISIBLE_TO_CURATOR = frozenset({S.APPROVED, S.COMPLETED})


def _not_found() -> DomainError:
    return DomainError("application_not_found", status=404, message="Application not found")


class ApplicationService:
    def __init__(
        self, session: AsyncSession, repo: ApplicationRepository, pets: PetService, queue: Queue
    ) -> None:
        self.session, self.repo, self.pets, self.queue = session, repo, pets, queue

    async def apply(self, pet_id: UUID, user: User, data: ApplicationCreate) -> ApplicationOut:
        pet = await self.pets.get_pet(pet_id)
        if pet.status not in OPEN_PET_STATUSES:
            raise DomainError("pet_not_available", status=409, message="Pet is not available")
        if await self.pets.is_curator(pet, user.id):
            raise DomainError("own_pet", status=409, message="Cannot apply for your own pet")
        if await self.repo.exists_active(pet_id=pet.id, user_id=user.id):
            raise DomainError("application_exists", status=409, message="Already applied")

        fields = data.model_dump(exclude={"consent"})
        try:
            # flush внутри create уже упирается в уникальный индекс — ловим и его
            application = await self.repo.create(pet_id=pet.id, user_id=user.id, **fields)
            await self.session.commit()
        except IntegrityError as exc:  # гонка двух одновременных заявок (двойной клик)
            await self.session.rollback()
            raise DomainError("application_exists", status=409, message="Already applied") from exc

        await self.queue.enqueue("notify_new_application", str(application.id))
        cards = await self.pets.get_cards([pet.id])
        return self._out(application, cards[pet.id], is_curator=False)

    async def change_status(
        self, application_id: UUID, user: User, new: ApplicationStatus
    ) -> ApplicationOut:
        found = await self.repo.get(application_id)
        if found is None:
            raise _not_found()
        # Порядок блокировок всегда «питомец → заявка», иначе два одновременных
        # одобрения на одного питомца взаимно заблокируют друг друга.
        pet = await self.pets.get_pet(found.pet_id, for_update=True)
        application = await self.repo.get(application_id, for_update=True)
        assert application is not None

        is_curator = await self.pets.is_curator(pet, user.id)
        if not is_curator and application.user_id != user.id:
            raise _not_found()  # не раскрываем, что чужая заявка существует
        if new not in self._allowed(application, is_curator=is_curator):
            raise DomainError(
                "transition_not_allowed",
                status=409,
                message=f"Cannot change {application.status} to {new}",
            )

        closed = await self._apply_pet_effects(application, pet, new)
        application.status = new
        await self.session.commit()

        for app_id in [application.id, *closed]:
            await self.queue.enqueue("notify_application_status", str(app_id))
        await self.session.refresh(application)
        cards = await self.pets.get_cards([pet.id])
        return self._out(application, cards[pet.id], is_curator=is_curator)

    async def get(self, application_id: UUID, user: User) -> ApplicationOut:
        application = await self.repo.get(application_id)
        if application is None:
            raise _not_found()
        pet = await self.pets.get_pet(application.pet_id)
        is_curator = await self.pets.is_curator(pet, user.id)
        if not is_curator and application.user_id != user.id:
            raise _not_found()
        cards = await self.pets.get_cards([pet.id])
        return self._out(application, cards[pet.id], is_curator=is_curator)

    async def latest_for_pairs(
        self, pairs: Collection[tuple[UUID, UUID]]
    ) -> dict[tuple[UUID, UUID], Application]:
        return await self.repo.latest_for_pairs(pairs)

    async def get_raw(self, application_id: UUID) -> Application | None:
        """Для фоновых задач: без проверки прав."""
        return await self.repo.get(application_id)

    async def list_mine(self, user: User, f: ApplicationFilters) -> Page[ApplicationOut]:
        items, next_cursor, total = await self.repo.page(
            params=f.page(), status=f.status, user_id=user.id
        )
        return await self._page(items, next_cursor, total, is_curator=False)

    async def list_incoming(self, user: User, f: ApplicationFilters) -> Page[ApplicationOut]:
        pet_ids = set(await self.pets.curated_pet_ids(user.id))
        if f.pet_id is not None:
            pet_ids &= {f.pet_id}
        items, next_cursor, total = await self.repo.page(
            params=f.page(), status=f.status, pet_ids=pet_ids
        )
        return await self._page(items, next_cursor, total, is_curator=True)

    async def _apply_pet_effects(
        self, application: Application, pet: Pet, new: ApplicationStatus
    ) -> list[UUID]:
        """Меняет статус питомца. Возвращает id заявок, закрытых автоматически."""
        if new == S.APPROVED:
            if pet.status not in OPEN_PET_STATUSES:
                raise DomainError("pet_not_available", status=409, message="Pet is not available")
            await self.pets.set_status(pet, PetStatus.RESERVED)
            return await self.repo.reject_other_active(pet_id=pet.id, except_id=application.id)
        if new == S.COMPLETED:
            await self.pets.set_status(pet, PetStatus.ADOPTED)
        elif new in (S.REJECTED, S.WITHDRAWN) and application.status == S.APPROVED:
            await self.pets.set_status(pet, PetStatus.SEEKING)
        return []

    @staticmethod
    def _allowed(application: Application, *, is_curator: bool) -> list[ApplicationStatus]:
        table = CURATOR_TRANSITIONS if is_curator else APPLICANT_TRANSITIONS
        return sorted(table.get(application.status, frozenset()))

    async def _page(
        self, items: list[Application], next_cursor: str | None, total: int, *, is_curator: bool
    ) -> Page[ApplicationOut]:
        cards = await self.pets.get_cards({a.pet_id for a in items})
        return Page(
            items=[self._out(a, cards[a.pet_id], is_curator=is_curator) for a in items],
            next_cursor=next_cursor,
            total=total,
        )

    def _out(
        self, application: Application, pet: PetCardOut, *, is_curator: bool
    ) -> ApplicationOut:
        show_phone = not is_curator or application.status in PHONE_VISIBLE_TO_CURATOR
        return ApplicationOut(
            id=application.id,
            status=application.status,
            pet=pet,
            name=application.name,
            phone=application.phone if show_phone else None,
            city=application.city,
            housing=application.housing,
            household=[Household(h) for h in application.household],
            about=application.about,
            created_at=application.created_at,
            updated_at=application.updated_at,
            viewer_role="curator" if is_curator else "applicant",
            allowed_transitions=self._allowed(application, is_curator=is_curator),
        )
