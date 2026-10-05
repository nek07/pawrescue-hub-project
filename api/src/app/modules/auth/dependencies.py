from typing import Annotated

from fastapi import Depends
from fastapi.security import APIKeyCookie

from app.core.db import DbSession
from app.core.errors import DomainError
from app.core.security import SESSION_COOKIE
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import AuthService
from app.modules.users.models import User, UserRole
from app.modules.users.repository import UserRepository
from app.modules.users.service import UserService

# Через APIKeyCookie, чтобы cookie-авторизация была описана в OpenAPI.
session_cookie = APIKeyCookie(name=SESSION_COOKIE, auto_error=False)
SessionToken = Annotated[str | None, Depends(session_cookie)]


def get_auth_service(session: DbSession) -> AuthService:
    return AuthService(session, AuthRepository(session), UserService(UserRepository(session)))


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


async def optional_user(token: SessionToken, auth: AuthServiceDep) -> User | None:
    return await auth.resolve(token) if token else None


async def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    if user is None:
        raise DomainError("unauthorized", status=401, message="Login required")
    return user


async def moderator_user(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != UserRole.MODERATOR:
        raise DomainError("forbidden", status=403, message="Moderators only")
    return user


OptionalUser = Annotated[User | None, Depends(optional_user)]
CurrentUser = Annotated[User, Depends(current_user)]
ModeratorUser = Annotated[User, Depends(moderator_user)]
