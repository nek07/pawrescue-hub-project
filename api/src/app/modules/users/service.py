from collections.abc import Collection
from datetime import UTC, datetime
from uuid import UUID

from app.core.cities import City
from app.core.errors import DomainError
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

    async def verify_volunteer(self, user_id: UUID, *, city: City | None) -> User:
        """Модератор одобрил подключение волонтёра. Коммитит вызывающий."""
        user = await self._existing(user_id)
        fields: dict[str, object] = {"role": UserRole.VOLUNTEER, "verified_at": datetime.now(UTC)}
        if city is not None:
            fields["city"] = city
        await self.repo.update(user, fields)
        return user

    async def set_blocked(self, user_id: UUID, *, blocked: bool) -> User:
        """Заблокированный теряет все сессии сразу: resolve() отвергает его. Коммитит вызывающий."""
        user = await self._existing(user_id)
        if user.role == UserRole.MODERATOR:
            raise DomainError(
                "cannot_block_moderator", status=409, message="Cannot block a moderator"
            )
        await self.repo.update(user, {"blocked_at": datetime.now(UTC) if blocked else None})
        return user

    async def _existing(self, user_id: UUID) -> User:
        user = await self.repo.get(user_id)
        if user is None:
            raise DomainError("user_not_found", status=404, message="User not found")
        return user
