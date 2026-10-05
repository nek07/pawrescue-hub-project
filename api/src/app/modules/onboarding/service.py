"""Подключение приюта или волонтёра: «Кто вы → Документы → Профиль → Проверка».

Документы лежат в приватном бакете: людям показываем только отметку «Проверен»,
модератору — короткие ссылки на просмотр.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import DomainError
from app.core.pagination import Page
from app.core.storage import Storage
from app.modules.onboarding.models import (
    DocumentKind,
    OnboardingDocument,
    OnboardingRequest,
    OnboardingStatus,
    OnboardingType,
)
from app.modules.onboarding.repository import OnboardingRepository
from app.modules.onboarding.schemas import (
    DOCUMENT_URL_TTL,
    MAX_DOCUMENT_BYTES,
    MAX_TERRITORY_PHOTOS,
    MIN_TERRITORY_PHOTOS,
    VIEW_URL_TTL,
    ApplicantOut,
    DocumentCreate,
    DocumentOut,
    DocumentTicketOut,
    ModerationFilters,
    OnboardingOut,
    OnboardingStart,
    OnboardingUpdate,
)
from app.modules.shelters.service import ShelterService
from app.modules.users.models import User
from app.modules.users.service import UserService


def _not_found() -> DomainError:
    return DomainError("onboarding_not_found", status=404, message="Onboarding request not found")


def _document_key(request_id: UUID, document_id: UUID) -> str:
    return f"requests/{request_id}/{document_id}"


def _staged_key(document_id: UUID) -> str:
    # Ключ, на который presigned PUT не выдавался: подменить проверенный файл нельзя.
    return f"confirmed/{document_id}"


def _missing(request: OnboardingRequest, documents: list[OnboardingDocument]) -> list[str]:
    """Что ещё не заполнено для отправки на проверку."""
    missing = []
    if request.city is None:
        missing.append("city")
    if not request.contact_phone:
        missing.append("contact_phone")
    if not request.about:
        missing.append("about")
    confirmed = [d for d in documents if d.confirmed]
    if request.type == OnboardingType.SHELTER:
        if not request.address:
            missing.append("address")
        if not any(d.kind == DocumentKind.REGISTRATION for d in confirmed):
            missing.append("registration")
        photos = sum(d.kind == DocumentKind.TERRITORY_PHOTO for d in confirmed)
        if photos < MIN_TERRITORY_PHOTOS:
            missing.append("territory_photos")
    return missing


class OnboardingService:
    def __init__(
        self,
        session: AsyncSession,
        repo: OnboardingRepository,
        shelters: ShelterService,
        users: UserService,
        storage: Storage,
        settings: Settings,
    ) -> None:
        self.session, self.repo, self.shelters, self.users = session, repo, shelters, users
        self.storage, self.bucket = storage, settings.s3_docs_bucket

    # --- шаги заявки

    async def start(self, user: User, data: OnboardingStart) -> OnboardingOut:
        if await self.repo.has_active(user.id):
            raise DomainError("onboarding_exists", status=409, message="Finish the current request")
        try:
            request = await self.repo.create(
                user_id=user.id, type=data.type, name=data.name.strip(), city=data.city
            )
            await self.repo.commit()
        except IntegrityError as exc:  # двойной клик «Далее»
            await self.session.rollback()
            raise DomainError(
                "onboarding_exists", status=409, message="Finish the current request"
            ) from exc
        return await self._out(request)

    async def mine(self, user: User) -> OnboardingOut:
        request = await self.repo.latest_for(user.id)
        if request is None:
            raise _not_found()
        return await self._out(request)

    async def update(self, user: User, data: OnboardingUpdate) -> OnboardingOut:
        request = await self._draft(user)
        changes = data.model_dump(exclude_unset=True)
        if changes.get("name") is None:
            changes.pop("name", None)  # имя обязательно: пустое не сохраняем
        await self.repo.update(request, changes)
        await self.repo.commit()
        return await self._out(request)

    async def add_document(self, user: User, data: DocumentCreate) -> DocumentTicketOut:
        request = await self._draft(user)
        if data.kind == DocumentKind.TERRITORY_PHOTO:
            if data.content_type == "application/pdf":
                raise DomainError(
                    "validation_error", status=422, fields={"content_type": "image_required"}
                )
            documents = await self.repo.documents(request.id)
            if (
                sum(d.kind == DocumentKind.TERRITORY_PHOTO for d in documents)
                >= MAX_TERRITORY_PHOTOS
            ):
                raise DomainError("too_many_photos", status=409, message="Up to 10 photos")
        document_id = uuid4()
        document = await self.repo.add_document(
            id=document_id,
            request_id=request.id,
            kind=data.kind,
            filename=data.filename,
            content_type=data.content_type,
        )
        url = self.storage.presign_put(
            self.bucket,
            _document_key(request.id, document_id),
            content_type=data.content_type,
            expires=DOCUMENT_URL_TTL,
        )
        await self.repo.commit()
        return DocumentTicketOut(
            **_document_out(document).model_dump(),
            upload_url=url,
            headers={"Content-Type": data.content_type},
            expires_at=datetime.now(UTC) + timedelta(seconds=DOCUMENT_URL_TTL),
        )

    async def confirm_document(self, user: User, document_id: UUID) -> DocumentOut:
        request = await self._draft(user)
        document = await self.repo.get_document(document_id, for_update=True)
        if document is None or document.request_id != request.id:
            raise DomainError("document_not_found", status=404, message="Document not found")
        if document.confirmed:
            return _document_out(document)
        original = _document_key(request.id, document.id)
        if await self.storage.head(self.bucket, original) is None:
            raise DomainError("upload_missing", status=409, message="File was not uploaded")
        staged = _staged_key(document.id)
        await self.storage.copy(self.bucket, original, staged)
        await self.storage.delete(self.bucket, original)
        info = await self.storage.head(self.bucket, staged)
        if info is None or info.size > MAX_DOCUMENT_BYTES:
            await self.storage.delete(self.bucket, staged)
            await self.repo.delete_document(document)
            await self.repo.commit()
            raise DomainError("file_too_large", status=422, message="File is larger than 20 MB")
        document.confirmed, document.size = True, info.size
        await self.repo.commit()
        return _document_out(document)

    async def delete_document(self, user: User, document_id: UUID) -> None:
        request = await self._draft(user)
        document = await self.repo.get_document(document_id)
        if document is None or document.request_id != request.id:
            raise DomainError("document_not_found", status=404, message="Document not found")
        key = (
            _staged_key(document.id)
            if document.confirmed
            else _document_key(request.id, document.id)
        )
        await self.repo.delete_document(document)
        await self.repo.commit()
        await self.storage.delete(self.bucket, key)

    async def submit(self, user: User) -> OnboardingOut:
        request = await self._draft(user)
        missing = _missing(request, await self.repo.documents(request.id))
        if missing:
            raise DomainError(
                "onboarding_incomplete",
                status=422,
                message="Fill in all steps before review",
                fields=dict.fromkeys(missing, "required"),
            )
        await self.repo.update(
            request, {"status": OnboardingStatus.SUBMITTED, "submitted_at": datetime.now(UTC)}
        )
        await self.repo.commit()
        return await self._out(request)

    # --- модератор

    async def queue(self, f: ModerationFilters) -> Page[OnboardingOut]:
        items, next_cursor, total = await self.repo.page(f.status, f.page())
        return Page(
            items=[await self._out(r, for_moderator=True) for r in items],
            next_cursor=next_cursor,
            total=total,
        )

    async def review(self, request_id: UUID) -> OnboardingOut:
        request = await self.repo.get(request_id)
        if request is None:
            raise _not_found()
        return await self._out(request, for_moderator=True)

    async def approve(self, request_id: UUID, moderator: User) -> OnboardingOut:
        request = await self._submitted(request_id)
        if request.type == OnboardingType.SHELTER:
            assert request.city is not None  # проверено при отправке
            shelter = await self.shelters.create_verified(
                admin_id=request.user_id,
                name=request.name,
                city=request.city,
                address=request.address,
                about=request.about,
                visit_hours=request.visit_hours,
            )
            shelter_id: UUID | None = shelter.id
        else:
            await self.users.verify_volunteer(request.user_id, city=request.city)
            shelter_id = None
        await self.repo.update(
            request,
            {
                "status": OnboardingStatus.APPROVED,
                "shelter_id": shelter_id,
                "decided_by": moderator.id,
                "decided_at": datetime.now(UTC),
            },
        )
        await self.repo.commit()
        return await self._out(request, for_moderator=True)

    async def reject(self, request_id: UUID, moderator: User, reason: str) -> OnboardingOut:
        request = await self._submitted(request_id)
        await self.repo.update(
            request,
            {
                "status": OnboardingStatus.REJECTED,
                "reject_reason": reason.strip(),
                "decided_by": moderator.id,
                "decided_at": datetime.now(UTC),
            },
        )
        await self.repo.commit()
        return await self._out(request, for_moderator=True)

    # --- служебное

    async def _draft(self, user: User) -> OnboardingRequest:
        request = await self.repo.latest_for(user.id)
        if request is None:
            raise _not_found()
        if request.status != OnboardingStatus.DRAFT:
            raise DomainError("onboarding_locked", status=409, message="Request is under review")
        return request

    async def _submitted(self, request_id: UUID) -> OnboardingRequest:
        request = await self.repo.get(request_id, for_update=True)  # два модератора разом
        if request is None:
            raise _not_found()
        if request.status != OnboardingStatus.SUBMITTED:
            raise DomainError("onboarding_not_submitted", status=409, message="Already decided")
        return request

    async def _out(
        self, request: OnboardingRequest, *, for_moderator: bool = False
    ) -> OnboardingOut:
        documents = await self.repo.documents(request.id)
        docs = []
        for d in documents:
            out = _document_out(d)
            if for_moderator and d.confirmed:
                out.view_url = self.storage.presign_get(
                    self.bucket, _staged_key(d.id), expires=VIEW_URL_TTL
                )
            docs.append(out)
        applicant = None
        if for_moderator:
            user = await self.users.get_user(request.user_id)
            if user is not None:
                applicant = ApplicantOut(id=user.id, name=user.name, avatar_url=user.avatar_url)
        return OnboardingOut(
            id=request.id,
            type=request.type,
            status=request.status,
            name=request.name,
            city=request.city,
            contact_phone=request.contact_phone,
            recommender=request.recommender,
            about=request.about,
            address=request.address,
            visit_hours=request.visit_hours,
            documents=docs,
            missing=_missing(request, documents),
            reject_reason=request.reject_reason,
            shelter_id=request.shelter_id,
            submitted_at=request.submitted_at,
            decided_at=request.decided_at,
            created_at=request.created_at,
            applicant=applicant,
        )


def _document_out(document: OnboardingDocument) -> DocumentOut:
    return DocumentOut(
        id=document.id,
        kind=document.kind,
        filename=document.filename,
        content_type=document.content_type,
        size=document.size,
        confirmed=document.confirmed,
    )
