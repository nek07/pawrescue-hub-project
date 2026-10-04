from typing import Annotated
from urllib.parse import urlencode

import httpx
from authlib.integrations.starlette_client import OAuthError
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from joserfc.errors import JoseError

from app.core.config import Settings, get_settings
from app.core.errors import DomainError
from app.core.security import clear_session_cookie, safe_next_path, set_session_cookie
from app.modules.auth.dependencies import AuthServiceDep, CurrentUser, SessionToken
from app.modules.auth.google import GoogleDep
from app.modules.auth.models import AuthProvider
from app.modules.auth.schemas import DevLoginIn, MeOut, TelegramLoginIn
from app.modules.auth.telegram import verify_login_widget

SettingsDep = Annotated[Settings, Depends(get_settings)]

router = APIRouter(prefix="/auth", tags=["auth"])


def _not_configured(provider: str) -> DomainError:
    return DomainError("provider_not_configured", status=503, message=f"{provider} login is off")


@router.get("/me")
async def me(user: CurrentUser) -> MeOut:
    return MeOut.from_user(user)


@router.post("/logout", status_code=204)
async def logout(
    response: Response, token: SessionToken, auth: AuthServiceDep, settings: SettingsDep
) -> None:
    if token:
        await auth.logout(token)
    clear_session_cookie(response, settings)


@router.post("/telegram")
async def telegram_login(
    body: TelegramLoginIn, response: Response, auth: AuthServiceDep, settings: SettingsDep
) -> MeOut:
    if settings.telegram_bot_token is None:
        raise _not_configured("Telegram")
    if not verify_login_widget(body.check_data(), settings.telegram_bot_token.get_secret_value()):
        raise DomainError("telegram_auth_invalid", status=401, message="Bad Telegram signature")
    user, token = await auth.login(
        AuthProvider.TELEGRAM, str(body.id), name=body.full_name, avatar_url=body.photo_url
    )
    set_session_cookie(response, token, settings)
    return MeOut.from_user(user)


@router.get("/google/login", status_code=302, response_class=RedirectResponse)
async def google_login(
    request: Request, google: GoogleDep, settings: SettingsDep, next: str = "/"
) -> Response:
    if google is None:
        raise _not_configured("Google")
    request.session["next"] = safe_next_path(next)
    redirect_uri = f"{settings.api_public_url}/api/v1/auth/google/callback"
    return await google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback", status_code=302, response_class=RedirectResponse)
async def google_callback(
    request: Request, google: GoogleDep, auth: AuthServiceDep, settings: SettingsDep
) -> RedirectResponse:
    # Это навигация браузера, а не fetch: ошибки отдаём редиректом на страницу входа.
    def fail(code: str) -> RedirectResponse:
        return RedirectResponse(f"{settings.web_url}/login?{urlencode({'error': code})}", 302)

    next_path = safe_next_path(request.session.pop("next", None))
    if google is None:
        return fail("provider_not_configured")
    try:
        token = await google.authorize_access_token(request)
    except (OAuthError, JoseError, httpx.HTTPError):  # state, подпись id_token, сеть
        return fail("google_failed")
    info = token.get("userinfo") or {}
    # Пользователя узнаём по sub, а не по email: почта может смениться.
    if not info.get("sub") or not info.get("email_verified"):
        return fail("google_email_unverified")
    try:
        _, session_token = await auth.login(
            AuthProvider.GOOGLE,
            str(info["sub"]),
            name=str(info.get("name") or info.get("email") or "Google"),
            avatar_url=info.get("picture"),
        )
    except DomainError as exc:
        return fail(exc.code)
    response = RedirectResponse(f"{settings.web_url}{next_path}", 302)
    set_session_cookie(response, session_token, settings)
    return response


# Подключается только вне прода (см. main.py): вход без Google и Telegram
# для локальной разработки, сид-данных и тестов.
dev_router = APIRouter(prefix="/auth", tags=["auth"])


@dev_router.post("/dev-login")
async def dev_login(
    body: DevLoginIn, response: Response, auth: AuthServiceDep, settings: SettingsDep
) -> MeOut:
    user, token = await auth.login(
        AuthProvider.DEV, f"{body.role}:{body.name}", name=body.name, role=body.role
    )
    set_session_cookie(response, token, settings)
    return MeOut.from_user(user)
