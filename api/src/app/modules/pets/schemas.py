from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, BaseModel, Field
from pydantic_core import PydanticCustomError

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
    is_favorite: bool = False  # всегда False для гостя

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


class FavoriteOut(BaseModel):
    favorite: bool


def _birth_date(value: date) -> date:
    if value > date.today():
        raise PydanticCustomError("birth_date_future", "Birth date is in the future")
    return value


def _unique_traits(values: list[PetTrait]) -> list[PetTrait]:
    return list(dict.fromkeys(values))


class PetUpdate(BaseModel):
    """Правка анкеты куратором; все поля необязательны (PATCH)."""

    name: str | None = Field(default=None, min_length=1, max_length=60)
    kind: PetKind | None = None
    sex: PetSex | None = None
    breed: str | None = Field(default=None, max_length=80)
    birth_date: Annotated[date, AfterValidator(_birth_date)] | None = None
    weight_kg: float | None = Field(default=None, gt=0, lt=100)
    sterilized: bool | None = None
    vaccinated_at: date | None = None
    chip: ChipStatus | None = None
    litter_trained: bool | None = None
    traits: Annotated[list[PetTrait], AfterValidator(_unique_traits)] | None = None
    story_title: str | None = Field(default=None, max_length=160)
    story: str | None = Field(default=None, max_length=5000)
    city: City | None = None


class PetCreate(PetUpdate):
    """Новая анкета создаётся черновиком; опубликовать — POST /pets/{id}/publish."""

    name: str = Field(min_length=1, max_length=60)
    kind: PetKind
    sex: PetSex
    birth_date: Annotated[date, AfterValidator(_birth_date)]
    # От имени какого приюта; без него — личная анкета проверенного волонтёра.
    shelter_id: UUID | None = None


class PetStatusIn(BaseModel):
    status: PetStatus


class PhotoOrderIn(BaseModel):
    """Новый порядок фото; первое станет обложкой."""

    photo_ids: list[UUID] = Field(min_length=1)


class ManagedPetFilters(PageQuery):
    status: PetStatus | None = None
