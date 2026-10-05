from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Computed,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from app.core.cities import City
from app.core.db import Base, pg_enum


class PetStatus(StrEnum):
    """Один список статусов на бэке и фронте (entities/pet/model).

    Руками куратор переключает только seeking ↔ needs_foster / treatment.
    reserved и adopted ставит сервис заявок при одобрении и завершении.
    """

    DRAFT = "draft"
    SEEKING = "seeking"
    NEEDS_FOSTER = "needs_foster"
    TREATMENT = "treatment"
    RESERVED = "reserved"
    ADOPTED = "adopted"


class PetKind(StrEnum):
    CAT = "cat"
    DOG = "dog"


class PetSex(StrEnum):
    FEMALE = "female"
    MALE = "male"


class ChipStatus(StrEnum):
    NONE = "none"
    PLANNED = "planned"
    DONE = "done"


class PetTrait(StrEnum):
    """Ключи черт характера: фронт переводит их и строит из них чипы и фильтры."""

    AFFECTIONATE = "affectionate"
    GOOD_WITH_KIDS = "good_with_kids"
    CALM = "calm"
    PLAYFUL = "playful"
    QUIET = "quiet"
    LOVES_PEOPLE = "loves_people"
    WELL_MANNERED = "well_mannered"
    NO_DOGS = "no_dogs"
    NO_CATS = "no_cats"
    APARTMENT_OK = "apartment_ok"
    AFTER_TREATMENT = "after_treatment"


SEARCH_EXPR = (
    "to_tsvector('russian'::regconfig, "
    "coalesce(name, '') || ' ' || coalesce(breed, '') || ' ' || coalesce(story, ''))"
)


class Pet(Base):
    __tablename__ = "pets"
    __table_args__ = (
        # Ровно один куратор: приют или волонтёр.
        CheckConstraint("(shelter_id IS NULL) <> (volunteer_id IS NULL)", name="one_curator"),
        Index("ix_pets_catalog", "status", "city", "kind"),
        Index("ix_pets_created_at_id", "created_at", "id"),
        Index("ix_pets_birth_date", "birth_date"),
        Index("ix_pets_traits", "traits", postgresql_using="gin"),
        Index("ix_pets_search", "search", postgresql_using="gin"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(60))
    kind: Mapped[PetKind] = mapped_column(pg_enum(PetKind, "pet_kind"))
    sex: Mapped[PetSex] = mapped_column(pg_enum(PetSex, "pet_sex"))
    breed: Mapped[str | None] = mapped_column(String(80))
    # Часто известна примерно — храним дату, возраст считаем на лету.
    birth_date: Mapped[date]
    weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    sterilized: Mapped[bool] = mapped_column(default=False, server_default="false")
    vaccinated_at: Mapped[date | None]
    chip: Mapped[ChipStatus] = mapped_column(
        pg_enum(ChipStatus, "chip_status"), default=ChipStatus.NONE, server_default=ChipStatus.NONE
    )
    litter_trained: Mapped[bool | None]
    traits: Mapped[list[str]] = mapped_column(ARRAY(String(32)), default=list, server_default="{}")
    story_title: Mapped[str | None] = mapped_column(String(160))
    story: Mapped[str | None] = mapped_column(Text)
    city: Mapped[City] = mapped_column(pg_enum(City, "city"))
    status: Mapped[PetStatus] = mapped_column(
        pg_enum(PetStatus, "pet_status"), default=PetStatus.DRAFT, server_default=PetStatus.DRAFT
    )
    shelter_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("shelters.id", ondelete="RESTRICT"), index=True
    )
    volunteer_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    search: Mapped[str] = mapped_column(
        TSVECTOR, Computed(SEARCH_EXPR, persisted=True), deferred=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class PetPhoto(Base):
    __tablename__ = "pet_photos"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    pet_id: Mapped[UUID] = mapped_column(ForeignKey("pets.id", ondelete="CASCADE"), index=True)
    # Три WebP от воркера: страница питомца (url), карточка каталога и исходник.
    url: Mapped[str] = mapped_column(String(500))
    card_url: Mapped[str | None] = mapped_column(String(500))
    original_url: Mapped[str | None] = mapped_column(String(500))
    position: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class PetFavorite(Base):
    """♡ «В избранное» на карточке и странице питомца."""

    __tablename__ = "pet_favorites"

    pet_id: Mapped[UUID] = mapped_column(
        ForeignKey("pets.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.clock_timestamp())
