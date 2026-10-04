from collections.abc import Collection
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cities import City
from app.core.db import like_escape
from app.modules.shelters.models import Shelter, ShelterMember, ShelterSubscription


class ShelterRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def commit(self) -> None:
        await self.session.commit()

    async def get(self, shelter_id: UUID) -> Shelter | None:
        return await self.session.get(Shelter, shelter_id)

    async def get_many(self, ids: Collection[UUID]) -> list[Shelter]:
        if not ids:
            return []
        return list(await self.session.scalars(select(Shelter).where(Shelter.id.in_(ids))))

    async def list_verified(self, *, city: City | None, q: str | None, limit: int) -> list[Shelter]:
        stmt = select(Shelter).where(Shelter.verified_at.is_not(None))
        if city:
            stmt = stmt.where(Shelter.city == city)
        if q:
            stmt = stmt.where(Shelter.name.ilike(f"%{like_escape(q)}%", escape="\\"))
        return list(await self.session.scalars(stmt.order_by(Shelter.name).limit(limit)))

    async def member_shelter_ids(self, user_id: UUID) -> list[UUID]:
        stmt = select(ShelterMember.shelter_id).where(ShelterMember.user_id == user_id)
        return list(await self.session.scalars(stmt))

    async def member_user_ids(self, shelter_id: UUID) -> list[UUID]:
        stmt = select(ShelterMember.user_id).where(ShelterMember.shelter_id == shelter_id)
        return list(await self.session.scalars(stmt))

    async def subscriber_counts(self, shelter_ids: Collection[UUID]) -> dict[UUID, int]:
        if not shelter_ids:
            return {}
        stmt = (
            select(ShelterSubscription.shelter_id, func.count())
            .where(ShelterSubscription.shelter_id.in_(shelter_ids))
            .group_by(ShelterSubscription.shelter_id)
        )
        return dict((await self.session.execute(stmt)).tuples().all())

    async def subscribed_ids(self, user_id: UUID) -> set[UUID]:
        stmt = select(ShelterSubscription.shelter_id).where(ShelterSubscription.user_id == user_id)
        return set(await self.session.scalars(stmt))

    async def set_subscription(self, shelter_id: UUID, user_id: UUID, subscribed: bool) -> None:
        if subscribed:
            stmt = insert(ShelterSubscription).values(shelter_id=shelter_id, user_id=user_id)
            await self.session.execute(stmt.on_conflict_do_nothing())
        else:
            await self.session.execute(
                delete(ShelterSubscription).where(
                    ShelterSubscription.shelter_id == shelter_id,
                    ShelterSubscription.user_id == user_id,
                )
            )
