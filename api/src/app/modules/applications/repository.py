from collections.abc import Collection
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, func, select, tuple_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageParams, apply_cursor, cut_page
from app.modules.applications.models import ACTIVE_STATUSES, Application, ApplicationStatus


class ApplicationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, application_id: UUID, *, for_update: bool = False) -> Application | None:
        return await self.session.get(
            Application, application_id, with_for_update=for_update, populate_existing=for_update
        )

    async def exists_active(self, *, pet_id: UUID, user_id: UUID) -> bool:
        stmt = select(Application.id).where(
            Application.pet_id == pet_id,
            Application.user_id == user_id,
            Application.status.in_(ACTIVE_STATUSES),
        )
        return await self.session.scalar(stmt.limit(1)) is not None

    async def create(self, **fields: Any) -> Application:
        application = Application(**fields, consented_at=datetime.now(UTC))
        self.session.add(application)
        await self.session.flush()
        return application

    async def reject_other_active(self, *, pet_id: UUID, except_id: UUID) -> list[UUID]:
        stmt = (
            update(Application)
            .where(
                Application.pet_id == pet_id,
                Application.id != except_id,
                Application.status.in_(ACTIVE_STATUSES),
            )
            .values(status=ApplicationStatus.REJECTED, updated_at=func.now())
            .returning(Application.id)
        )
        return list(await self.session.scalars(stmt))

    async def page(
        self,
        *,
        params: PageParams,
        status: ApplicationStatus | None,
        user_id: UUID | None = None,
        pet_ids: Collection[UUID] | None = None,
    ) -> tuple[list[Application], str | None, int]:
        conds: list[ColumnElement[bool]] = []
        if user_id is not None:
            conds.append(Application.user_id == user_id)
        if pet_ids is not None:
            conds.append(Application.pet_id.in_(pet_ids))
        if status is not None:
            conds.append(Application.status == status)
        stmt = apply_cursor(
            select(Application).where(*conds),
            created_at=Application.created_at,
            id_=Application.id,
            params=params,
        )
        rows = list(await self.session.scalars(stmt))
        items, next_cursor = cut_page(rows, params=params, key=lambda a: (a.created_at, a.id))
        total = await self.session.scalar(
            select(func.count()).select_from(Application).where(*conds)
        )
        return items, next_cursor, total or 0

    async def latest_for_pairs(
        self, pairs: Collection[tuple[UUID, UUID]]
    ) -> dict[tuple[UUID, UUID], Application]:
        """Последняя заявка на каждую пару (pet_id, user_id) — для панели в чате."""
        if not pairs:
            return {}
        stmt = (
            select(Application)
            .where(tuple_(Application.pet_id, Application.user_id).in_(list(pairs)))
            .distinct(Application.pet_id, Application.user_id)
            .order_by(Application.pet_id, Application.user_id, Application.created_at.desc())
        )
        return {(a.pet_id, a.user_id): a for a in await self.session.scalars(stmt)}
