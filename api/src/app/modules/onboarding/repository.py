from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageParams, apply_cursor, cut_page
from app.modules.onboarding.models import (
    OnboardingDocument,
    OnboardingRequest,
    OnboardingStatus,
)

ACTIVE = (OnboardingStatus.DRAFT, OnboardingStatus.SUBMITTED)


class OnboardingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def commit(self) -> None:
        await self.session.commit()

    async def get(self, request_id: UUID, *, for_update: bool = False) -> OnboardingRequest | None:
        return await self.session.get(
            OnboardingRequest, request_id, with_for_update=for_update, populate_existing=for_update
        )

    async def latest_for(self, user_id: UUID) -> OnboardingRequest | None:
        stmt = (
            select(OnboardingRequest)
            .where(OnboardingRequest.user_id == user_id)
            .order_by(OnboardingRequest.created_at.desc())
            .limit(1)
        )
        return await self.session.scalar(stmt)

    async def has_active(self, user_id: UUID) -> bool:
        stmt = select(OnboardingRequest.id).where(
            OnboardingRequest.user_id == user_id, OnboardingRequest.status.in_(ACTIVE)
        )
        return await self.session.scalar(stmt.limit(1)) is not None

    async def create(self, **fields: Any) -> OnboardingRequest:
        request = OnboardingRequest(**fields)
        self.session.add(request)
        await self.session.flush()
        await self.session.refresh(request)
        return request

    async def update(self, request: OnboardingRequest, fields: dict[str, Any]) -> None:
        for key, value in fields.items():
            setattr(request, key, value)
        await self.session.flush()
        await self.session.refresh(request)

    async def page(
        self, status: OnboardingStatus, params: PageParams
    ) -> tuple[list[OnboardingRequest], str | None, int]:
        cond = OnboardingRequest.status == status
        # Модератор разбирает очередь с самых старых заявок.
        stmt = apply_cursor(
            select(OnboardingRequest).where(cond),
            created_at=OnboardingRequest.created_at,
            id_=OnboardingRequest.id,
            params=params,
            newest_first=False,
        )
        rows = list(await self.session.scalars(stmt))
        items, next_cursor = cut_page(rows, params=params, key=lambda r: (r.created_at, r.id))
        total = await self.session.scalar(
            select(func.count()).select_from(OnboardingRequest).where(cond)
        )
        return items, next_cursor, total or 0

    async def documents(self, request_id: UUID) -> list[OnboardingDocument]:
        stmt = (
            select(OnboardingDocument)
            .where(OnboardingDocument.request_id == request_id)
            .order_by(OnboardingDocument.created_at)
        )
        return list(await self.session.scalars(stmt))

    async def add_document(self, **fields: Any) -> OnboardingDocument:
        document = OnboardingDocument(**fields)
        self.session.add(document)
        await self.session.flush()
        return document

    async def get_document(
        self, document_id: UUID, *, for_update: bool = False
    ) -> OnboardingDocument | None:
        return await self.session.get(
            OnboardingDocument,
            document_id,
            with_for_update=for_update,
            populate_existing=for_update,
        )

    async def delete_document(self, document: OnboardingDocument) -> None:
        await self.session.delete(document)
        await self.session.flush()
