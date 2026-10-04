from collections.abc import AsyncIterator
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, ClassVar

from fastapi import Depends
from sqlalchemy import DateTime, MetaData
from sqlalchemy import Enum as SAEnum
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

# Стабильные имена constraint'ов — иначе Alembic не сможет их удалить или переименовать.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    type_annotation_map: ClassVar[dict[Any, Any]] = {datetime: DateTime(timezone=True)}


def pg_enum(enum_cls: type[StrEnum], name: str) -> SAEnum:
    """Enum в PostgreSQL со значениями StrEnum ("seeking"), а не именами ("SEEKING")."""
    return SAEnum(
        enum_cls,
        name=name,
        values_callable=lambda members: [m.value for m in members],
        validate_strings=True,
    )


def like_escape(value: str) -> str:
    """Экранирует % и _ для ILIKE ... ESCAPE '\\'."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


_settings = get_settings()
engine = create_async_engine(
    str(_settings.database_url), pool_pre_ping=True, echo=_settings.sql_echo
)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session


DbSession = Annotated[AsyncSession, Depends(get_session)]
