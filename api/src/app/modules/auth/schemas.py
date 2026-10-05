from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.cities import City
from app.modules.users.models import User, UserRole


class MeOut(BaseModel):
    id: UUID
    name: str
    role: UserRole
    city: City | None
    avatar_url: str | None
    verified: bool

    @classmethod
    def from_user(cls, user: User) -> "MeOut":
        return cls(
            id=user.id,
            name=user.name,
            role=user.role,
            city=user.city,
            avatar_url=user.avatar_url,
            verified=user.verified_at is not None,
        )


class DevLoginIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    role: UserRole = UserRole.USER


class TelegramLoginIn(BaseModel):
    """Поля Telegram Login Widget — фронт шлёт их как есть."""

    # Неизвестные поля тоже входят в подпись, поэтому не отбрасываем их.
    model_config = ConfigDict(extra="allow")

    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str

    def check_data(self) -> dict[str, str]:
        return {k: str(v) for k, v in self.model_dump(exclude_none=True).items()}

    @property
    def full_name(self) -> str:
        return " ".join(part for part in (self.first_name, self.last_name) if part)
