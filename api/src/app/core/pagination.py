"""Курсорная пагинация: ?limit=20&cursor=... → {items, next_cursor, total}.

Курсор — (created_at, id) последней записи. В отличие от offset, лента и чат
не «съезжают», когда сверху появляются новые записи.
"""

import base64
import binascii
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import ColumnElement, Select, tuple_
from sqlalchemy.orm import QueryableAttribute

from app.core.errors import DomainError

DEFAULT_LIMIT = 20
MAX_LIMIT = 100

type SortColumn[T] = ColumnElement[T] | QueryableAttribute[T]


class Page[T](BaseModel):
    items: list[T]
    next_cursor: str | None
    total: int


@dataclass(frozen=True)
class Cursor:
    created_at: datetime
    id: UUID


def encode_cursor(created_at: datetime, id_: UUID) -> str:
    raw = f"{created_at.isoformat()}|{id_}".encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(value: str) -> Cursor:
    try:
        padded = value + "=" * (-len(value) % 4)
        created_at, id_ = base64.urlsafe_b64decode(padded).decode().split("|")
        return Cursor(created_at=datetime.fromisoformat(created_at), id=UUID(id_))
    except (binascii.Error, UnicodeDecodeError, ValueError) as exc:
        raise DomainError("invalid_cursor", status=400, message="Malformed cursor") from exc


class PageParams(BaseModel):
    limit: int
    cursor: Cursor | None


class PageQuery(BaseModel):
    """База для query-моделей списков: FastAPI разворачивает в параметры
    только одну модель на эндпоинт, поэтому фильтры наследуются от неё."""

    limit: int = Field(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT)
    cursor: str | None = None

    def page(self) -> PageParams:
        return PageParams(
            limit=self.limit, cursor=decode_cursor(self.cursor) if self.cursor else None
        )


def apply_cursor[*Ts](
    stmt: Select[*Ts],
    *,
    created_at: SortColumn[datetime],
    id_: SortColumn[UUID],
    params: PageParams,
    newest_first: bool = True,
) -> Select[*Ts]:
    """Добавляет условие курсора, сортировку и limit + 1 (лишняя строка = есть ещё)."""
    if params.cursor is not None:
        key = tuple_(created_at, id_)
        value = tuple_(params.cursor.created_at, params.cursor.id)
        stmt = stmt.where(key < value if newest_first else key > value)
    order = (created_at.desc(), id_.desc()) if newest_first else (created_at.asc(), id_.asc())
    return stmt.order_by(*order).limit(params.limit + 1)


def cut_page[T](
    rows: Sequence[T],
    *,
    params: PageParams,
    key: Callable[[T], tuple[datetime, UUID]],
) -> tuple[list[T], str | None]:
    """Отрезает лишнюю строку от apply_cursor и считает next_cursor."""
    items = list(rows[: params.limit])
    next_cursor = encode_cursor(*key(items[-1])) if len(rows) > params.limit else None
    return items, next_cursor
