from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from contextlib import AsyncExitStack
from datetime import date
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from testcontainers.postgres import PostgresContainer

from app.core.clock import get_today
from app.core.config import Settings, get_settings
from app.core.db import get_session
from app.core.pubsub import get_pubsub
from app.core.queue import get_queue
from app.core.ratelimit import get_rate_limiter
from app.core.storage import get_storage
from app.main import create_app
from app.modules.auth.google import get_google_client
from app.seed import seed
from helpers import (
    BOT_TOKEN,
    FakeGoogle,
    MemoryPubSub,
    MemoryRateLimiter,
    MemoryStorage,
    RecordingQueue,
)

API_ROOT = Path(__file__).resolve().parents[1]
TODAY = date(2026, 10, 4)


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    """Настоящий PostgreSQL в контейнере, схема — через миграции Alembic."""
    with PostgresContainer("postgres:17", driver="asyncpg") as pg:
        url = pg.get_connection_url()
        cfg = Config(str(API_ROOT / "alembic.ini"))
        cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
        command.upgrade(cfg, "head")
        yield url


@pytest.fixture(scope="session")
async def engine(database_url: str) -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(database_url)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """Каждый тест — в своей транзакции, которая откатывается в конце."""
    async with engine.connect() as conn:
        trans = await conn.begin()
        session = AsyncSession(
            bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint"
        )
        try:
            yield session
        finally:
            await session.close()
            await trans.rollback()


@pytest.fixture
def settings() -> Settings:
    return Settings(
        env="test",
        telegram_bot_token=SecretStr(BOT_TOKEN),
        google_client_id="google-client",
        google_client_secret=SecretStr("google-secret"),
        web_url="http://web.test",
        api_public_url="http://api.test",
    )


@pytest.fixture
def queue() -> RecordingQueue:
    return RecordingQueue()


@pytest.fixture
def google() -> FakeGoogle:
    return FakeGoogle()


@pytest.fixture
def storage() -> MemoryStorage:
    return MemoryStorage()


@pytest.fixture
def pubsub() -> MemoryPubSub:
    return MemoryPubSub()


@pytest.fixture
def app(
    db_session: AsyncSession,
    settings: Settings,
    queue: RecordingQueue,
    google: FakeGoogle,
    storage: MemoryStorage,
    pubsub: MemoryPubSub,
) -> FastAPI:
    app = create_app(settings)

    async def _session() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_session] = _session
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_queue] = lambda: queue
    app.dependency_overrides[get_google_client] = lambda: google
    app.dependency_overrides[get_storage] = lambda: storage
    app.dependency_overrides[get_pubsub] = lambda: pubsub
    limiter = MemoryRateLimiter()  # свежие счётчики на каждый тест
    app.dependency_overrides[get_rate_limiter] = lambda: limiter
    # Возрасты сид-питомцев считаются от фиксированной даты, а не от сегодняшней.
    app.dependency_overrides[get_today] = lambda: TODAY
    return app


@pytest.fixture
async def seeded(db_session: AsyncSession) -> None:
    await seed(db_session)


@pytest.fixture
async def make_client(app: FastAPI) -> AsyncIterator[Callable[[], Awaitable[AsyncClient]]]:
    """Отдельный клиент со своими cookie — для сценариев «заявитель + куратор»."""
    async with AsyncExitStack() as stack:

        async def _make() -> AsyncClient:
            transport = ASGITransport(app=app)
            return await stack.enter_async_context(
                AsyncClient(transport=transport, base_url="http://test")
            )

        yield _make


@pytest.fixture
async def client(make_client: Callable[[], Awaitable[AsyncClient]]) -> AsyncClient:
    return await make_client()
