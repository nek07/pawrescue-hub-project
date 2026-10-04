from collections.abc import Collection
from datetime import date
from uuid import UUID

from app.core.errors import DomainError
from app.core.pagination import Page, PageParams
from app.modules.pets.models import Pet, PetStatus
from app.modules.pets.repository import CatalogRow, PetRepository
from app.modules.pets.schemas import (
    CuratorCounts,
    CuratorOut,
    PetCardOut,
    PetDetailOut,
    PetFilters,
    PetPhotoOut,
)
from app.modules.shelters.service import ShelterService
from app.modules.users.service import UserService

SIMILAR_LIMIT = 4  # «Тоже ищут дом»


class PetService:
    def __init__(self, repo: PetRepository, shelters: ShelterService, users: UserService) -> None:
        self.repo, self.shelters, self.users = repo, shelters, users

    async def list_catalog(
        self, filters: PetFilters, params: PageParams, *, today: date
    ) -> Page[PetCardOut]:
        rows, next_cursor, total = await self.repo.list_catalog(filters, params, today=today)
        return Page(items=await self._cards(rows), next_cursor=next_cursor, total=total)

    async def get_detail(self, pet_id: UUID) -> PetDetailOut:
        pet = await self.get_pet(pet_id)
        curators = await self._curators([pet])
        return PetDetailOut.build_detail(
            pet,
            curator=curators[pet.id],
            photos=await self.repo.photos(pet.id),
            similar=await self._cards(await self.repo.similar(pet, limit=SIMILAR_LIMIT)),
        )

    async def get_pet(self, pet_id: UUID, *, for_update: bool = False) -> Pet:
        """Опубликованный питомец. Черновик для всех выглядит как несуществующий."""
        pet = await self.repo.get(pet_id, for_update=for_update)
        if pet is None or pet.status == PetStatus.DRAFT:
            raise DomainError("pet_not_found", status=404, message="Pet not found")
        return pet

    async def get_managed_pet(self, pet_id: UUID, user_id: UUID) -> Pet:
        """Питомец, которого ведёт этот человек, — включая черновики."""
        pet = await self.repo.get(pet_id)
        if pet is None:
            raise DomainError("pet_not_found", status=404, message="Pet not found")
        if not await self.is_curator(pet, user_id):
            if pet.status == PetStatus.DRAFT:  # чужой черновик не раскрываем
                raise DomainError("pet_not_found", status=404, message="Pet not found")
            raise DomainError("not_curator", status=403, message="Only the curator can do this")
        return pet

    async def get_photo(self, photo_id: UUID) -> PetPhotoOut | None:
        photo = await self.repo.get_photo(photo_id)
        return PetPhotoOut.from_photo(photo) if photo else None

    async def add_photo(
        self, pet_id: UUID, *, url: str, card_url: str, original_url: str
    ) -> PetPhotoOut:
        """Для воркера фото: транзакцию коммитит вызывающий."""
        photo = await self.repo.add_photo(
            pet_id, url=url, card_url=card_url, original_url=original_url
        )
        return PetPhotoOut.from_photo(photo)

    async def get_cards(self, pet_ids: Collection[UUID]) -> dict[UUID, PetCardOut]:
        pets = await self.repo.get_many(pet_ids)
        covers = await self.repo.covers(pet_ids)
        cards = await self._cards([CatalogRow(pet=p, cover_url=covers.get(p.id)) for p in pets])
        return {card.id: card for card in cards}

    async def is_curator(self, pet: Pet, user_id: UUID) -> bool:
        if pet.volunteer_id is not None:
            return pet.volunteer_id == user_id
        assert pet.shelter_id is not None  # CHECK ck_pets_one_curator
        return await self.shelters.is_member(pet.shelter_id, user_id)

    async def curated_pet_ids(self, user_id: UUID) -> list[UUID]:
        shelter_ids = await self.shelters.member_shelter_ids(user_id)
        return await self.repo.curated_ids(shelter_ids=shelter_ids, volunteer_id=user_id)

    async def set_status(self, pet: Pet, status: PetStatus) -> None:
        """Только для сервиса заявок: он сам держит блокировку и коммитит транзакцию."""
        await self.repo.set_status(pet, status)

    async def count_by_curator(
        self, *, shelter_ids: Collection[UUID], volunteer_ids: Collection[UUID]
    ) -> dict[UUID, CuratorCounts]:
        return await self.repo.count_by_curator(
            shelter_ids=shelter_ids, volunteer_ids=volunteer_ids
        )

    async def _cards(self, rows: list[CatalogRow]) -> list[PetCardOut]:
        curators = await self._curators([row.pet for row in rows])
        return [
            PetCardOut.build(row.pet, cover_url=row.cover_url, curator=curators[row.pet.id])
            for row in rows
        ]

    async def _curators(self, pets: list[Pet]) -> dict[UUID, CuratorOut]:
        # Чужие таблицы не читаем — имена кураторов берём у сервисов-владельцев.
        shelters = await self.shelters.get_shelters({p.shelter_id for p in pets if p.shelter_id})
        volunteers = await self.users.get_users({p.volunteer_id for p in pets if p.volunteer_id})
        result: dict[UUID, CuratorOut] = {}
        for pet in pets:
            if pet.shelter_id:
                result[pet.id] = CuratorOut.from_shelter(shelters[pet.shelter_id])
            elif pet.volunteer_id:
                result[pet.id] = CuratorOut.from_volunteer(volunteers[pet.volunteer_id])
        return result
