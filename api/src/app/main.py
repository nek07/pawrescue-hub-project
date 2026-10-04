from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

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
from app.core.queue import get_queue
from app.core.storage import get_storage


def operation_id(route: APIRoute) -> str:
    # pets-list_pets вместо list_pets_api_v1_pets_get — так читаются типы на фронте
    tag = route.tags[0] if route.tags else "default"
    return f"{tag}-{route.name}"


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    if settings.env == "dev":
        storage = get_storage()
        await storage.ensure_buckets(settings.s3_uploads_bucket, settings.s3_photos_bucket)
    yield
    await get_queue().close()
    await engine.dispose()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings)
    init_sentry(settings)
    app = FastAPI(
        title="Paw Rescue Hub API",
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
    app.include_router(v1)
    return app


app = create_app()
