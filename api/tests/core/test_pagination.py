import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import Column, DateTime, MetaData, Table, Uuid, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.core.pagination import (
    Cursor,
    PageParams,
    apply_cursor,
    cut_page,
    decode_cursor,
    encode_cursor,
)

items = Table(
    "pagination_items",
    MetaData(),
    Column("id", Uuid, primary_key=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
)


def test_cursor_roundtrip() -> None:
    created_at = datetime(2026, 10, 4, 12, 30, tzinfo=UTC)
    id_ = uuid.uuid4()
    assert decode_cursor(encode_cursor(created_at, id_)) == Cursor(created_at, id_)


@pytest.mark.parametrize(
    "raw", ["", "not-base64!", encode_cursor(datetime.now(UTC), uuid.uuid4())[:-4]]
)
def test_malformed_cursor_is_domain_error(raw: str) -> None:
    with pytest.raises(DomainError) as exc:
        decode_cursor(raw)
    assert exc.value.code == "invalid_cursor"


async def test_keyset_pages_are_stable_with_ties_and_new_rows(db_session: AsyncSession) -> None:
    conn = await db_session.connection()
    await conn.run_sync(items.metadata.create_all)

    base = datetime(2026, 10, 1, tzinfo=UTC)
    # по два элемента на одну секунду — проверяем, что id разбивает ничьи
    rows = [{"id": uuid.uuid4(), "created_at": base + timedelta(seconds=i // 2)} for i in range(7)]
    await db_session.execute(insert(items), rows)
    expected = [
        r["id"] for r in sorted(rows, key=lambda r: (r["created_at"], r["id"]), reverse=True)
    ]

    async def fetch(params: PageParams) -> tuple[list[uuid.UUID], str | None]:
        stmt = apply_cursor(
            select(items.c.id, items.c.created_at),
            created_at=items.c.created_at,
            id_=items.c.id,
            params=params,
        )
        result = (await db_session.execute(stmt)).all()
        page, next_cursor = cut_page(result, params=params, key=lambda r: (r.created_at, r.id))
        return [r.id for r in page], next_cursor

    seen, next_cursor = await fetch(PageParams(limit=3, cursor=None))
    # новая запись сверху не должна сдвинуть следующие страницы
    await db_session.execute(
        insert(items), [{"id": uuid.uuid4(), "created_at": base + timedelta(days=1)}]
    )
    while next_cursor:
        page, next_cursor = await fetch(PageParams(limit=3, cursor=decode_cursor(next_cursor)))
        seen += page

    assert seen == expected
