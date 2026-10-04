from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.cities import City
from app.core.db import Base, pg_enum


class UserRole(StrEnum):
    USER = "user"
    VOLUNTEER = "volunteer"
    MODERATOR = "moderator"


NAME_MAX = 100
AVATAR_URL_MAX = 500


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(NAME_MAX))
    role: Mapped[UserRole] = mapped_column(
        pg_enum(UserRole, "user_role"), default=UserRole.USER, server_default=UserRole.USER
    )
    city: Mapped[City | None] = mapped_column(pg_enum(City, "city"))
    # Не приходит ни от Google, ни от Telegram — спрашиваем в форме заявки.
    phone: Mapped[str | None] = mapped_column(String(16))
    avatar_url: Mapped[str | None] = mapped_column(String(AVATAR_URL_MAX))
    # Для волонтёров: отметка «Проверен платформой».
    verified_at: Mapped[datetime | None]
    blocked_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
