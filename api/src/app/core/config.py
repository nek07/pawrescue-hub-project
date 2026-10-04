from functools import lru_cache
from typing import Literal, Self

from pydantic import PostgresDsn, RedisDsn, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET = "dev-only-secret-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: Literal["dev", "test", "prod"] = "dev"
    database_url: PostgresDsn = PostgresDsn("postgresql+asyncpg://paw:paw@localhost:5433/paw")
    redis_url: RedisDsn = RedisDsn("redis://localhost:6379/0")
    # JSON-список в .env: CORS_ORIGINS=["https://pawrescue.kz"]
    cors_origins: list[str] = ["http://localhost:3000"]
    sql_echo: bool = False

    # Куда возвращать браузер после OAuth и какой адрес API видит Google.
    web_url: str = "http://localhost:3000"
    api_public_url: str = "http://localhost:8000"

    # В проде — общий родительский домен (".pawrescue.kz"), чтобы cookie от api.
    # видел и Next.js-сервер. Локально не задаём.
    session_cookie_domain: str | None = None
    # Подписывает короткую cookie с state и PKCE на время входа через Google.
    session_secret: SecretStr = SecretStr(DEV_SECRET)

    google_client_id: str | None = None
    google_client_secret: SecretStr | None = None
    # Для dev — отдельный тестовый бот, привязанный к localhost через /setdomain.
    telegram_bot_token: SecretStr | None = None

    # S3-совместимое хранилище. endpoint — адрес для API и воркера,
    # public — для браузера: presigned URL подписывается именно под этот хост.
    s3_endpoint_url: str = "http://localhost:8333"
    s3_public_url: str = "http://localhost:8333"
    s3_region: str = "us-east-1"
    s3_access_key: str = "paw"
    s3_secret_key: SecretStr = SecretStr("pawpawpaw")
    s3_uploads_bucket: str = "uploads"  # приватный: сырые загрузки
    s3_photos_bucket: str = "pet-photos"  # публичное чтение: готовые WebP
    # В проде — CDN перед бакетом с фото; по умолчанию {s3_public_url}/{bucket}
    photos_public_url: str | None = None

    log_level: str = "INFO"
    log_json: bool = True
    sentry_dsn: SecretStr | None = None

    @model_validator(mode="after")
    def _prod_requires_secrets(self) -> Self:
        if self.env == "prod" and self.session_secret.get_secret_value() == DEV_SECRET:
            raise ValueError("SESSION_SECRET must be set in prod")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
