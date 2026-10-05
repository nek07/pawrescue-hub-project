from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import DomainError

router = APIRouter(tags=["system"])


class HealthOut(BaseModel):
    status: Literal["ok"]
    db: Literal["ok"]


@router.get("/health")
async def health(session: Annotated[AsyncSession, Depends(get_session)]) -> HealthOut:
    try:
        await session.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError) as exc:
        raise DomainError("db_unavailable", status=503, message="Database unavailable") from exc
    return HealthOut(status="ok", db="ok")
