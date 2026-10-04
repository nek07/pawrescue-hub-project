from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.cities import City
from app.core.pagination import PageQuery
from app.modules.pets.models import ChipStatus, Pet, PetKind, PetPhoto, PetSex, PetStatus, PetTrait
from app.modules.shelters.models import Shelter
from app.modules.users.models import User


class AgeBucket(StrEnum):
    UNDER_1 = "lt1"  # «До года»
    FROM_1_TO_5 = "1to5"  # «1–5 лет»
    OVER_5 = "gt5"  # «Старше 5»


class PetSort(StrEnum):
    NEW = "new"  # «Сначала новые»
    OLD = "old"


class PetFilters(PageQuery):
    """Фильтры каталога. Имена совпадают с параметрами URL на фронте."""

    q: str | None = Field(default=None, max_length=100)
    kind: PetKind | None = None
    age: AgeBucket | None = None
    city: City | None = None
    sterilized: bool | None = None
    good_with_kids: bool | None = None
    needs_foster: bool | None = None
    # Вкладка «Питомцы» в профиле приюта или волонтёра
    shelter_id: UUID | None = None
    volunteer_id: UUID | None = None
    sort: PetSort = PetSort.NEW


@dataclass(frozen=True)
class CuratorCounts:
    seeking: int  # в каталоге: ищут дом, передержка, лечение
    adopted: int


class CuratorOut(BaseModel):
    type: Literal["shelter", "volunteer"]
    id: UUID
    name: str
    verified: bool

    @classmethod
    def from_shelter(cls, shelter: Shelter) -> "CuratorOut":
        verified = shelter.verified_at is not None
        return cls(type="shelter", id=shelter.id, name=shelter.name, verified=verified)

    @classmethod
    def from_volunteer(cls, user: User) -> "CuratorOut":
        verified = user.verified_at is not None
        return cls(type="volunteer", id=user.id, name=user.name, verified=verified)


class PetCardOut(BaseModel):
    """Карточка каталога. Возраст и подпись «Кошка · 4 года» собирает фронт."""

    id: UUID
    name: str
    kind: PetKind
    sex: PetSex
    birth_date: date
    city: City
    status: PetStatus
    sterilized: bool
    vaccinated: bool
    traits: list[PetTrait]
    cover_url: str | None
    curator: CuratorOut

    @classmethod
    def build(cls, pet: Pet, *, cover_url: str | None, curator: CuratorOut) -> "PetCardOut":
        return cls(
            id=pet.id,
            name=pet.name,
            kind=pet.kind,
            sex=pet.sex,
            birth_date=pet.birth_date,
            city=pet.city,
            status=pet.status,
            sterilized=pet.sterilized,
            vaccinated=pet.vaccinated_at is not None,
            traits=[PetTrait(t) for t in pet.traits],
            cover_url=cover_url,
            curator=curator,
        )


class PetPhotoOut(BaseModel):
    id: UUID
    url: str  # 1600 px — страница питомца
    card_url: str  # 600 px — карточки и превью
    original_url: str

    @classmethod
    def from_photo(cls, photo: PetPhoto) -> "PetPhotoOut":
        return cls(
            id=photo.id,
            url=photo.url,
            card_url=photo.card_url or photo.url,
            original_url=photo.original_url or photo.url,
        )


class PetDetailOut(PetCardOut):
    """Страница питомца: факты, история, фото и «Тоже ищут дом»."""

    breed: str | None
    weight_kg: float | None
    vaccinated_at: date | None
    chip: ChipStatus
    litter_trained: bool | None
    story_title: str | None
    story: str | None
    photos: list[PetPhotoOut]
    similar: list[PetCardOut]

    @classmethod
    def build_detail(
        cls,
        pet: Pet,
        *,
        curator: CuratorOut,
        photos: list[PetPhoto],
        similar: list[PetCardOut],
    ) -> "PetDetailOut":
        cover = (photos[0].card_url or photos[0].url) if photos else None
        card = PetCardOut.build(pet, cover_url=cover, curator=curator)
        weight = pet.weight_kg
        return cls(
            **dict(card),
            breed=pet.breed,
            weight_kg=float(weight) if isinstance(weight, Decimal) else None,
            vaccinated_at=pet.vaccinated_at,
            chip=pet.chip,
            litter_trained=pet.litter_trained,
            story_title=pet.story_title,
            story=pet.story,
            photos=[PetPhotoOut.from_photo(ph) for ph in photos],
            similar=similar,
        )
