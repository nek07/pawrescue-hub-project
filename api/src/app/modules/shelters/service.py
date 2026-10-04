from collections.abc import Collection
from uuid import UUID

from app.core.cities import City
from app.core.errors import DomainError
from app.modules.shelters.models import Shelter
from app.modules.shelters.repository import ShelterRepository


class ShelterService:
    def __init__(self, repo: ShelterRepository) -> None:
        self.repo = repo

    async def get_shelter(self, shelter_id: UUID) -> Shelter:
        shelter = await self.repo.get(shelter_id)
        # Непроверенный приют публично не показываем.
        if shelter is None or shelter.verified_at is None:
            raise DomainError("shelter_not_found", status=404, message="Shelter not found")
        return shelter

    async def get_shelters(self, ids: Collection[UUID]) -> dict[UUID, Shelter]:
        return {shelter.id: shelter for shelter in await self.repo.get_many(ids)}

    async def list_verified(
        self, *, city: City | None = None, q: str | None = None, limit: int = 100
    ) -> list[Shelter]:
        return await self.repo.list_verified(city=city, q=q, limit=limit)

    async def member_shelter_ids(self, user_id: UUID) -> list[UUID]:
        return await self.repo.member_shelter_ids(user_id)

    async def member_user_ids(self, shelter_id: UUID) -> list[UUID]:
        return await self.repo.member_user_ids(shelter_id)

    async def is_member(self, shelter_id: UUID, user_id: UUID) -> bool:
        return shelter_id in await self.repo.member_shelter_ids(user_id)

    async def subscriber_counts(self, shelter_ids: Collection[UUID]) -> dict[UUID, int]:
        return await self.repo.subscriber_counts(shelter_ids)

    async def subscribed_ids(self, user_id: UUID) -> set[UUID]:
        return await self.repo.subscribed_ids(user_id)

    async def set_subscription(self, shelter_id: UUID, user_id: UUID, *, subscribed: bool) -> int:
        """Подписывает или отписывает; возвращает новое число подписчиков."""
        shelter = await self.get_shelter(shelter_id)
        await self.repo.set_subscription(shelter.id, user_id, subscribed)
        await self.repo.commit()
        return (await self.repo.subscriber_counts([shelter.id])).get(shelter.id, 0)
