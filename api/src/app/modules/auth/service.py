from collections.abc import Collection
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.core.security import SESSION_TTL, hash_token, new_session_token
from app.modules.auth.models import AuthProvider
from app.modules.auth.repository import AuthRepository
from app.modules.users.models import User, UserRole
from app.modules.users.service import UserService


class AuthService:
    def __init__(self, session: AsyncSession, repo: AuthRepository, users: UserService) -> None:
        self.session, self.repo, self.users = session, repo, users

    async def login(
        self,
        provider: AuthProvider,
        provider_user_id: str,
        *,
        name: str,
        avatar_url: str | None = None,
        role: UserRole = UserRole.USER,
    ) -> tuple[User, str]:
        """Находит или создаёт пользователя по способу входа и открывает сессию.

        Провайдер уже проверен вызывающим кодом (подпись Telegram, id_token Google).
        """
        identity = await self.repo.find_identity(provider, provider_user_id)
        if identity is None:
            user = await self.users.create_user(name=name, role=role, avatar_url=avatar_url)
            await self.repo.add_identity(
                user_id=user.id, provider=provider, provider_user_id=provider_user_id
            )
        else:
            found = await self.users.get_user(identity.user_id)
            if found is None:  # невозможно при ON DELETE CASCADE, но mypy об этом не знает
                raise DomainError("user_not_found", status=404)
            user = found
        if user.blocked_at is not None:
            raise DomainError("user_blocked", status=403, message="Account is blocked")

        token = new_session_token()
        await self.repo.add_session(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=datetime.now(UTC) + SESSION_TTL,
        )
        await self.session.commit()
        return user, token

    async def resolve(self, token: str) -> User | None:
        session = await self.repo.find_active_session(hash_token(token), datetime.now(UTC))
        if session is None:
            return None
        user = await self.users.get_user(session.user_id)
        if user is None or user.blocked_at is not None:
            return None
        return user

    async def logout(self, token: str) -> None:
        await self.repo.revoke_session(hash_token(token), datetime.now(UTC))
        await self.session.commit()

    async def telegram_chat_ids(self, user_ids: Collection[UUID]) -> list[str]:
        """Для уведомлений: у Telegram id пользователя совпадает с id личного чата с ботом."""
        return await self.repo.provider_user_ids(AuthProvider.TELEGRAM, user_ids)
