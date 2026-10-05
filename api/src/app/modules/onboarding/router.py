from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.core.db import DbSession
from app.core.storage import StorageDep
from app.modules.auth.dependencies import CurrentUser
from app.modules.onboarding.repository import OnboardingRepository
from app.modules.onboarding.schemas import (
    DocumentCreate,
    DocumentOut,
    DocumentTicketOut,
    OnboardingOut,
    OnboardingStart,
    OnboardingUpdate,
)
from app.modules.onboarding.service import OnboardingService
from app.modules.shelters.repository import ShelterRepository
from app.modules.shelters.service import ShelterService
from app.modules.users.repository import UserRepository
from app.modules.users.service import UserService

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


def get_onboarding_service(
    session: DbSession, storage: StorageDep, settings: Annotated[Settings, Depends(get_settings)]
) -> OnboardingService:
    return OnboardingService(
        session,
        OnboardingRepository(session),
        ShelterService(ShelterRepository(session)),
        UserService(UserRepository(session)),
        storage,
        settings,
    )


ServiceDep = Annotated[OnboardingService, Depends(get_onboarding_service)]


@router.post("", status_code=201)
async def start_onboarding(
    body: OnboardingStart, user: CurrentUser, service: ServiceDep
) -> OnboardingOut:
    """Шаг 1 «Кто вы»: приют или волонтёр."""
    return await service.start(user, body)


@router.get("/me")
async def my_onboarding(user: CurrentUser, service: ServiceDep) -> OnboardingOut:
    """Последняя заявка: черновик, на проверке или с решением модератора."""
    return await service.mine(user)


@router.patch("/me")
async def update_onboarding(
    body: OnboardingUpdate, user: CurrentUser, service: ServiceDep
) -> OnboardingOut:
    return await service.update(user, body)


@router.post("/me/documents", status_code=201)
async def add_document(
    body: DocumentCreate, user: CurrentUser, service: ServiceDep
) -> DocumentTicketOut:
    """Шаг 2 «Документы»: presigned PUT в приватный бакет."""
    return await service.add_document(user, body)


@router.post("/me/documents/{document_id}/confirm")
async def confirm_document(
    document_id: UUID, user: CurrentUser, service: ServiceDep
) -> DocumentOut:
    return await service.confirm_document(user, document_id)


@router.delete("/me/documents/{document_id}", status_code=204)
async def delete_document(document_id: UUID, user: CurrentUser, service: ServiceDep) -> None:
    await service.delete_document(user, document_id)


@router.post("/me/submit")
async def submit_onboarding(user: CurrentUser, service: ServiceDep) -> OnboardingOut:
    """Шаг 4 «Проверка»: отправить модератору."""
    return await service.submit(user)
