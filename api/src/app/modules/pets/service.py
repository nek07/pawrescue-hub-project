from collections.abc import Collection
from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.core.cities import City
from app.core.errors import DomainError
from app.core.pagination import Page, PageParams
from app.modules.pets.models import Pet, PetStatus
from app.modules.pets.repository import CatalogRow, PetRepository
from app.modules.pets.schemas import (
    CuratorCounts,
    CuratorOut,
    FavoriteOut,
    ManagedPetFilters,
    PetCardOut,
    PetCreate,
    PetDetailOut,
    PetFilters,
    PetPhotoOut,
    PetUpdate,
)
from app.modules.shelters.service import ShelterService
from app.modules.users.models import User, UserRole
from app.modules.users.service import UserService

SIMILAR_LIMIT = 4  # «Тоже ищут дом»
MANUAL_STATUSES = frozenset({PetStatus.SEEKING, PetStatus.NEEDS_FOSTER, PetStatus.TREATMENT})
# Колонки без NULL: в PATCH их можно не передавать, но нельзя обнулить.
_REQUIRED = frozenset({"name", "kind", "sex", "birth_date", "sterilized", "chip", "traits", "city"})


def _not_curator() -> DomainError:
    return DomainError(
        "not_curator", status=403, message="Only verified shelters and volunteers publish pets"
    )


def _pet_fields(values: dict[str, Any]) -> dict[str, Any]:
    """Поля схемы → колонки модели (вес храним в Numeric, черты — строками)."""
    fields = dict(values)
    if fields.get("weight_kg") is not None:
        fields["weight_kg"] = Decimal(str(round(fields["weight_kg"], 1)))
    if fields.get("traits") is not None:
        fields["traits"] = [str(t) for t in fields["traits"]]
    if isinstance(fields.get("name"), str):
        fields["name"] = fields["name"].strip()
    return fields


class PetService:
    def __init__(self, repo: PetRepository, shelters: ShelterService, users: UserService) -> None:
        self.repo, self.shelters, self.users = repo, shelters, users

    async def list_catalog(
        self, filters: PetFilters, params: PageParams, *, today: date, viewer_id: UUID | None = None
    ) -> Page[PetCardOut]:
        rows, next_cursor, total = await self.repo.list_catalog(filters, params, today=today)
        items = await self._cards(rows, viewer_id)
        return Page(items=items, next_cursor=next_cursor, total=total)

    async def get_detail(self, pet_id: UUID, viewer_id: UUID | None = None) -> PetDetailOut:
        pet = await self.get_pet(pet_id)
        curators = await self._curators([pet])
        detail = PetDetailOut.build_detail(
            pet,
            curator=curators[pet.id],
            photos=await self.repo.photos(pet.id),
            similar=await self._cards(await self.repo.similar(pet, limit=SIMILAR_LIMIT), viewer_id),
        )
        if viewer_id is not None:
            detail.is_favorite = pet.id in await self.repo.favorite_ids(viewer_id, [pet.id])
        return detail

    async def set_favorite(self, pet_id: UUID, user_id: UUID, *, favorite: bool) -> FavoriteOut:
        pet = await self.get_pet(pet_id)
        await self.repo.set_favorite(pet.id, user_id, favorite)
        await self.repo.commit()
        return FavoriteOut(favorite=favorite)

    async def list_favorites(self, user_id: UUID, params: PageParams) -> Page[PetCardOut]:
        rows, next_cursor, total = await self.repo.favorites_page(user_id, params)
        items = await self._cards(rows, user_id)
        return Page(items=items, next_cursor=next_cursor, total=total)

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

    async def _cards(
        self, rows: list[CatalogRow], viewer_id: UUID | None = None
    ) -> list[PetCardOut]:
        curators = await self._curators([row.pet for row in rows])
        favorites = (
            await self.repo.favorite_ids(viewer_id, [row.pet.id for row in rows])
            if viewer_id
            else set()
        )
        return [
            PetCardOut.build(
                row.pet, cover_url=row.cover_url, curator=curators[row.pet.id]
            ).model_copy(update={"is_favorite": row.pet.id in favorites})
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

    # --- кабинет куратора

    async def create_pet(self, user: User, data: PetCreate) -> PetDetailOut:
        """Новая анкета — всегда черновик: в каталоге появится после publish."""
        city: City | None
        if data.shelter_id is not None:
            if not await self.shelters.is_member(data.shelter_id, user.id):
                raise _not_curator()
            shelter = await self.shelters.get_shelter(data.shelter_id)  # только проверенный
            curator: dict[str, Any] = {"shelter_id": shelter.id}
            city = data.city or shelter.city
        else:
            if not (user.role == UserRole.VOLUNTEER and user.verified_at is not None):
                raise _not_curator()
            curator = {"volunteer_id": user.id}
            city = data.city or user.city
            if city is None:
                raise DomainError("validation_error", status=422, fields={"city": "missing"})
        fields = _pet_fields(data.model_dump(exclude={"shelter_id", "city"}, exclude_none=True))
        pet = await self.repo.create(**fields, **curator, city=city, status=PetStatus.DRAFT)
        await self.repo.commit()
        return await self._managed_detail(pet)

    async def update_pet(self, pet_id: UUID, user: User, data: PetUpdate) -> PetDetailOut:
        pet = await self.get_managed_pet(pet_id, user.id)
        changes = data.model_dump(exclude_unset=True)
        nulls = {k: "null_not_allowed" for k, v in changes.items() if v is None and k in _REQUIRED}
        if nulls:
            raise DomainError("validation_error", status=422, fields=nulls)
        await self.repo.update(pet, _pet_fields(changes))
        await self.repo.commit()
        return await self._managed_detail(pet)

    async def publish(self, pet_id: UUID, user: User) -> PetDetailOut:
        pet = await self.get_managed_pet(pet_id, user.id)
        if pet.status != PetStatus.DRAFT:
            raise DomainError("already_published", status=409, message="Pet is already published")
        missing = {}
        if not pet.story:
            missing["story"] = "required"
        if not await self.repo.photos(pet.id):
            missing["photos"] = "required"
        if missing:
            # Без истории и фото анкета не работает — так говорят волонтёры в макете.
            raise DomainError("publish_incomplete", status=422, fields=missing)
        await self.repo.update(pet, {"status": PetStatus.SEEKING})
        await self.repo.commit()
        return await self._managed_detail(pet)

    async def change_status(self, pet_id: UUID, user: User, status: PetStatus) -> PetDetailOut:
        """Руками — только «Ищет дом» ↔ «Нужна передержка» ↔ «На лечении».
        «Забронирован» и «Нашёл дом» ставит сервис заявок."""
        await self.get_managed_pet(pet_id, user.id)
        pet = await self.get_pet(pet_id, for_update=True)  # не гоняемся с одобрением заявки
        if pet.status not in MANUAL_STATUSES or status not in MANUAL_STATUSES:
            raise DomainError(
                "status_not_allowed", status=409, message=f"Cannot change {pet.status} to {status}"
            )
        await self.repo.update(pet, {"status": status})
        await self.repo.commit()
        return await self._managed_detail(pet)

    async def delete_pet(self, pet_id: UUID, user: User) -> None:
        pet = await self.get_managed_pet(pet_id, user.id)
        if pet.status != PetStatus.DRAFT:
            raise DomainError("pet_published", status=409, message="Only drafts can be deleted")
        await self.repo.delete(pet)
        await self.repo.commit()

    async def delete_photo(self, pet_id: UUID, photo_id: UUID, user: User) -> None:
        pet = await self.get_managed_pet(pet_id, user.id)
        photo = await self.repo.get_photo(photo_id)
        if photo is None or photo.pet_id != pet.id:
            raise DomainError("photo_not_found", status=404, message="Photo not found")
        await self.repo.delete_photo(photo)
        await self.repo.commit()

    async def reorder_photos(
        self, pet_id: UUID, user: User, photo_ids: list[UUID]
    ) -> list[PetPhotoOut]:
        pet = await self.get_managed_pet(pet_id, user.id)
        photos = {p.id: p for p in await self.repo.photos(pet.id)}
        if len(photo_ids) != len(set(photo_ids)) or set(photo_ids) != set(photos):
            raise DomainError(
                "photo_order_mismatch", status=422, message="Pass every photo of the pet once"
            )
        ordered = [photos[i] for i in photo_ids]
        await self.repo.reorder_photos(ordered)
        await self.repo.commit()
        return [PetPhotoOut.from_photo(p) for p in ordered]

    async def managed_detail(self, pet_id: UUID, user: User) -> PetDetailOut:
        return await self._managed_detail(await self.get_managed_pet(pet_id, user.id))

    async def list_managed(self, user: User, f: ManagedPetFilters) -> Page[PetCardOut]:
        shelter_ids = await self.shelters.member_shelter_ids(user.id)
        rows, next_cursor, total = await self.repo.managed_page(
            shelter_ids=shelter_ids, volunteer_id=user.id, status=f.status, params=f.page()
        )
        return Page(items=await self._cards(rows), next_cursor=next_cursor, total=total)

    async def _managed_detail(self, pet: Pet) -> PetDetailOut:
        curators = await self._curators([pet])
        return PetDetailOut.build_detail(
            pet, curator=curators[pet.id], photos=await self.repo.photos(pet.id), similar=[]
        )
