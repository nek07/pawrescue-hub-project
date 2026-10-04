"""Вход через Google: OpenID Connect, authorization code + PKCE (Authlib).

Authlib сам хранит state, nonce и PKCE-верифайер в подписанной cookie
(SessionMiddleware в main.py) и проверяет подпись id_token по ключам Google,
aud и iss.
"""

from functools import lru_cache
from typing import Annotated, Any, Protocol, cast

from authlib.integrations.starlette_client import OAuth
from fastapi import Depends, Request, Response

from app.core.config import get_settings

GOOGLE_METADATA = "https://accounts.google.com/.well-known/openid-configuration"


class GoogleClient(Protocol):
    async def authorize_redirect(self, request: Request, redirect_uri: str) -> Response: ...

    async def authorize_access_token(self, request: Request) -> dict[str, Any]: ...


@lru_cache
def get_google_client() -> GoogleClient | None:
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        return None
    oauth = OAuth()
    oauth.register(
        "google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret.get_secret_value(),
        server_metadata_url=GOOGLE_METADATA,
        client_kwargs={"scope": "openid email profile", "code_challenge_method": "S256"},
    )
    return cast(GoogleClient, oauth.google)


GoogleDep = Annotated[GoogleClient | None, Depends(get_google_client)]
