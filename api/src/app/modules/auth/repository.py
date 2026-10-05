from collections.abc import Collection
from datetime import datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import AuthIdentity, AuthProvider, AuthSession


class AuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def find_identity(
        self, provider: AuthProvider, provider_user_id: str
    ) -> AuthIdentity | None:
        stmt = select(AuthIdentity).where(
            AuthIdentity.provider == provider,
            AuthIdentity.provider_user_id == provider_user_id,
        )
        return await self.session.scalar(stmt)

    async def add_identity(
        self, *, user_id: UUID, provider: AuthProvider, provider_user_id: str
    ) -> None:
        self.session.add(
            AuthIdentity(user_id=user_id, provider=provider, provider_user_id=provider_user_id)
        )
        await self.session.flush()

    async def add_session(self, *, user_id: UUID, token_hash: str, expires_at: datetime) -> None:
        self.session.add(AuthSession(user_id=user_id, token_hash=token_hash, expires_at=expires_at))
        await self.session.flush()

    async def find_active_session(self, token_hash: str, now: datetime) -> AuthSession | None:
        stmt = select(AuthSession).where(
            AuthSession.token_hash == token_hash,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
        )
        return await self.session.scalar(stmt)

    async def revoke_session(self, token_hash: str, now: datetime) -> None:
        stmt = (
            update(AuthSession)
            .where(AuthSession.token_hash == token_hash, AuthSession.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        await self.session.execute(stmt)

    async def provider_user_ids(
        self, provider: AuthProvider, user_ids: Collection[UUID]
    ) -> list[str]:
        if not user_ids:
            return []
        stmt = select(AuthIdentity.provider_user_id).where(
            AuthIdentity.provider == provider, AuthIdentity.user_id.in_(user_ids)
        )
        return list(await self.session.scalars(stmt))
