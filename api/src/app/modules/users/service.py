from collections.abc import Collection
from uuid import UUID

from app.core.cities import City
from app.modules.users.models import User, UserRole
from app.modules.users.repository import UserRepository


class UserService:
    """Транзакцией управляет вызывающий сервис — здесь только flush."""

    def __init__(self, repo: UserRepository) -> None:
        self.repo = repo

    async def get_user(self, user_id: UUID) -> User | None:
        return await self.repo.get(user_id)

    async def get_users(self, ids: Collection[UUID]) -> dict[UUID, User]:
        return {user.id: user for user in await self.repo.get_many(ids)}

    async def list_verified_volunteers(
        self, *, city: City | None = None, q: str | None = None, limit: int = 100
    ) -> list[User]:
        return await self.repo.list_verified_volunteers(city=city, q=q, limit=limit)

    async def create_user(
        self, *, name: str, role: UserRole = UserRole.USER, avatar_url: str | None = None
    ) -> User:
        return await self.repo.create(name=name, role=role, avatar_url=avatar_url)
