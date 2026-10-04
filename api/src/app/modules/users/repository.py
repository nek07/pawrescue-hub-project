from collections.abc import Collection
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cities import City
from app.core.db import like_escape
from app.modules.users.models import User, UserRole


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, user_id: UUID) -> User | None:
        return await self.session.get(User, user_id)

    async def get_many(self, ids: Collection[UUID]) -> list[User]:
        if not ids:
            return []
        return list(await self.session.scalars(select(User).where(User.id.in_(ids))))

    async def list_verified_volunteers(
        self, *, city: City | None, q: str | None, limit: int
    ) -> list[User]:
        stmt = select(User).where(
            User.role == UserRole.VOLUNTEER,
            User.verified_at.is_not(None),
            User.blocked_at.is_(None),
        )
        if city:
            stmt = stmt.where(User.city == city)
        if q:
            stmt = stmt.where(User.name.ilike(f"%{like_escape(q)}%", escape="\\"))
        return list(await self.session.scalars(stmt.order_by(User.name).limit(limit)))

    async def create(self, *, name: str, role: UserRole, avatar_url: str | None) -> User:
        user = User(name=name, role=role, avatar_url=avatar_url)
        self.session.add(user)
        await self.session.flush()
        return user
