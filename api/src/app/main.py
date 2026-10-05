import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from starlette.middleware.sessions import SessionMiddleware

from app.core import health
from app.core.config import Settings, get_settings
from app.core.csrf import add_origin_check
from app.core.db import engine
from app.core.errors import ERROR_RESPONSES, register_error_handlers
from app.core.observability import add_request_context, configure_logging, init_sentry
from app.core.pubsub import get_pubsub
from app.core.queue import get_queue
from app.core.ratelimit import get_rate_limiter
from app.core.storage import get_storage
from app.modules.applications import router as applications_router
from app.modules.auth import router as auth_router
from app.modules.chat import realtime as chat_realtime
from app.modules.chat import router as chat_router
from app.modules.curators import router as curators_router
from app.modules.feed import router as feed_router
from app.modules.media import router as media_router
from app.modules.moderation import router as moderation_router
from app.modules.onboarding import router as onboarding_router
from app.modules.pets import router as pets_router

logger = logging.getLogger(__name__)
BUCKET_WAIT_SECONDS = 10


def operation_id(route: APIRoute) -> str:
    # pets-list_pets вместо list_pets_api_v1_pets_get — так читаются типы на фронте
    tag = route.tags[0] if route.tags else "default"
    return f"{tag}-{route.name}"


async def _ensure_dev_buckets(settings: Settings) -> None:
    """Удобство для разработки: создать бакеты, если S3 уже поднят.

    Старт API от этого не зависит — без S3 не работают только загрузки фото.
    Ждём не дольше BUCKET_WAIT_SECONDS: у botocore свои повторы с паузами.
    """

    async def ensure() -> None:
        while True:
            try:
                await get_storage().ensure_buckets(
                    settings.s3_uploads_bucket, settings.s3_photos_bucket, settings.s3_docs_bucket
                )
                return
            except (BotoCoreError, ClientError):
                await asyncio.sleep(1)  # SeaweedFS ещё поднимается

    try:
        await asyncio.wait_for(ensure(), timeout=BUCKET_WAIT_SECONDS)
    except TimeoutError:
        logger.warning("S3 is unavailable, buckets were not created")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    if settings.env == "dev":
        await _ensure_dev_buckets(settings)
    yield
    await get_queue().close()
    await get_pubsub().close()
    await get_rate_limiter().close()
    await engine.dispose()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings)
    init_sentry(settings)
    app = FastAPI(
        title="Pana API",
        version="1",
        lifespan=lifespan,
        generate_unique_id_function=operation_id,
        responses=ERROR_RESPONSES,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Короткая подписанная cookie только на время входа через Google (state, PKCE).
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret.get_secret_value(),
        session_cookie="prh_oauth",
        max_age=600,
        path="/api/v1/auth",
        same_site="lax",
        https_only=settings.env == "prod",
    )
    add_origin_check(app, settings.cors_origins)
    # Последним — значит, снаружи: request_id есть у всех логов запроса, включая 403 выше.
    add_request_context(app)
    register_error_handlers(app)

    v1 = APIRouter(prefix="/api/v1")
    v1.include_router(health.router)
    v1.include_router(auth_router.router)
    if settings.env != "prod":
        v1.include_router(auth_router.dev_router)
    v1.include_router(pets_router.router)
    v1.include_router(curators_router.router)
    v1.include_router(curators_router.shelters_router)
    v1.include_router(curators_router.me_router)
    v1.include_router(pets_router.me_router)
    v1.include_router(applications_router.router)
    v1.include_router(media_router.router)
    v1.include_router(chat_router.router)
    v1.include_router(chat_realtime.router)
    v1.include_router(feed_router.router)
    v1.include_router(onboarding_router.router)
    v1.include_router(moderation_router.router)
    app.include_router(v1)
    return app


app = create_app()
