from collections.abc import Collection
from dataclasses import dataclass
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, ScalarSelect, delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import years_ago
from app.core.db import like_escape
from app.core.pagination import PageParams, apply_cursor, cut_page
from app.modules.pets.models import Pet, PetFavorite, PetPhoto, PetStatus, PetTrait
from app.modules.pets.schemas import AgeBucket, CuratorCounts, PetFilters, PetSort

# В каталоге — те, кого можно забрать или взять на передержку.
# draft ещё не опубликован, reserved и adopted уже нашли дом.
CATALOG_STATUSES = (PetStatus.SEEKING, PetStatus.NEEDS_FOSTER, PetStatus.TREATMENT)


# Черты хранятся ключами, а люди ищут словами с карточки: «ласк» → affectionate.
# Слова — из подписей фронта (messages: pet.trait.*), обе формы рода и казахский.
TRAIT_WORDS: dict[PetTrait, tuple[str, ...]] = {
    PetTrait.AFFECTIONATE: ("ласковый", "ласковая", "еркелегіш"),
    PetTrait.GOOD_WITH_KIDS: ("ладит", "детьми", "дети", "балалармен"),
    PetTrait.CALM: ("спокойный", "спокойная", "сабырлы"),
    PetTrait.PLAYFUL: ("игривый", "игривая", "ойнақы"),
    PetTrait.QUIET: ("тихий", "тихая", "тыныш"),
    PetTrait.LOVES_PEOPLE: ("любит", "людей", "адамдарды"),
    PetTrait.WELL_MANNERED: ("воспитанный", "воспитанная", "тәрбиелі"),
    PetTrait.APARTMENT_OK: ("квартира", "квартиры", "пәтерге"),
    PetTrait.AFTER_TREATMENT: ("лечения", "лечение", "емделгеннен"),
}
MIN_TRAIT_PREFIX = 3


def _traits_matching(q: str) -> list[str]:
    """Черты, у которых какое-то слово начинается с одного из слов запроса."""
    prefixes = [w for w in q.lower().replace("ё", "е").split() if len(w) >= MIN_TRAIT_PREFIX]
    return [
        trait.value
        for trait, words in TRAIT_WORDS.items()
        if any(word.replace("ё", "е").startswith(p) for word in words for p in prefixes)
    ]


@dataclass(frozen=True)
class CatalogRow:
    pet: Pet
    cover_url: str | None


def _cover() -> ScalarSelect[Any]:
    return (
        select(func.coalesce(PetPhoto.card_url, PetPhoto.url))
        .where(PetPhoto.pet_id == Pet.id)
        .order_by(PetPhoto.position, PetPhoto.created_at)
        .limit(1)
        .correlate(Pet)
        .scalar_subquery()
    )


def _catalog_conditions(f: PetFilters, today: date) -> list[ColumnElement[bool]]:
    conds: list[ColumnElement[bool]] = [Pet.status.in_(CATALOG_STATUSES)]
    if f.kind:
        conds.append(Pet.kind == f.kind)
    if f.city:
        conds.append(Pet.city == f.city)
    if f.shelter_id:
        conds.append(Pet.shelter_id == f.shelter_id)
    if f.volunteer_id:
        conds.append(Pet.volunteer_id == f.volunteer_id)
    if f.sterilized:
        conds.append(Pet.sterilized.is_(True))
    if f.good_with_kids:
        conds.append(Pet.traits.contains([PetTrait.GOOD_WITH_KIDS.value]))
    if f.needs_foster:
        conds.append(Pet.status == PetStatus.NEEDS_FOSTER)
    # Возраст — по полным годам: 5 лет и 11 месяцев — это ещё «1–5 лет».
    match f.age:
        case AgeBucket.UNDER_1:
            conds.append(Pet.birth_date > years_ago(today, 1))
        case AgeBucket.FROM_1_TO_5:
            conds.append(Pet.birth_date <= years_ago(today, 1))
            conds.append(Pet.birth_date > years_ago(today, 6))
        case AgeBucket.OVER_5:
            conds.append(Pet.birth_date <= years_ago(today, 6))
    if f.q:
        # Полнотекстовый поиск по имени, породе и истории + префикс имени («Мур» → Мурка),
        # подстрока породы («сиам» → сиамская) и черты характера («ласк» → ласковая).
        query = func.websearch_to_tsquery("russian", f.q)
        pattern = like_escape(f.q)
        matches = [
            Pet.search.bool_op("@@")(query),
            Pet.name.ilike(f"{pattern}%", escape="\\"),
            Pet.breed.ilike(f"%{pattern}%", escape="\\"),
        ]
        if traits := _traits_matching(f.q):
            matches.append(Pet.traits.overlap(traits))
        conds.append(or_(*matches))
    return conds


class PetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def commit(self) -> None:
        await self.session.commit()

    async def get(self, pet_id: UUID, *, for_update: bool = False) -> Pet | None:
        return await self.session.get(
            Pet, pet_id, with_for_update=for_update, populate_existing=for_update
        )

    async def get_many(self, ids: Collection[UUID]) -> list[Pet]:
        if not ids:
            return []
        return list(await self.session.scalars(select(Pet).where(Pet.id.in_(ids))))

    async def photos(self, pet_id: UUID) -> list[PetPhoto]:
        stmt = (
            select(PetPhoto)
            .where(PetPhoto.pet_id == pet_id)
            .order_by(PetPhoto.position, PetPhoto.created_at)
        )
        return list(await self.session.scalars(stmt))

    async def covers(self, pet_ids: Collection[UUID]) -> dict[UUID, str]:
        if not pet_ids:
            return {}
        stmt = select(Pet.id, _cover()).where(Pet.id.in_(pet_ids))
        rows = (await self.session.execute(stmt)).tuples().all()
        return {pid: url for pid, url in rows if url}

    async def similar(self, pet: Pet, *, limit: int) -> list[CatalogRow]:
        stmt = (
            select(Pet, _cover())
            .where(
                Pet.status.in_(CATALOG_STATUSES),
                Pet.kind == pet.kind,
                Pet.city == pet.city,
                Pet.id != pet.id,
            )
            .order_by(Pet.created_at.desc(), Pet.id.desc())
            .limit(limit)
        )
        rows = (await self.session.execute(stmt)).tuples().all()
        return [CatalogRow(pet=p, cover_url=url) for p, url in rows]

    async def get_photo(self, photo_id: UUID) -> PetPhoto | None:
        return await self.session.get(PetPhoto, photo_id)

    async def add_photo(
        self, pet_id: UUID, *, url: str, card_url: str, original_url: str
    ) -> PetPhoto:
        last = await self.session.scalar(
            select(func.max(PetPhoto.position)).where(PetPhoto.pet_id == pet_id)
        )
        photo = PetPhoto(
            pet_id=pet_id,
            url=url,
            card_url=card_url,
            original_url=original_url,
            position=(last + 1) if last is not None else 0,
        )
        self.session.add(photo)
        await self.session.flush()
        return photo

    async def set_status(self, pet: Pet, status: PetStatus) -> None:
        pet.status = status
        await self.session.flush()

    async def curated_ids(self, *, shelter_ids: Collection[UUID], volunteer_id: UUID) -> list[UUID]:
        stmt = select(Pet.id).where(
            or_(Pet.shelter_id.in_(shelter_ids), Pet.volunteer_id == volunteer_id)
        )
        return list(await self.session.scalars(stmt))

    async def list_catalog(
        self, filters: PetFilters, params: PageParams, *, today: date
    ) -> tuple[list[CatalogRow], str | None, int]:
        conds = _catalog_conditions(filters, today)
        stmt = apply_cursor(
            select(Pet, _cover()).where(*conds),
            created_at=Pet.created_at,
            id_=Pet.id,
            params=params,
            newest_first=filters.sort == PetSort.NEW,
        )
        rows = (await self.session.execute(stmt)).tuples().all()
        page, next_cursor = cut_page(rows, params=params, key=lambda r: (r[0].created_at, r[0].id))
        total = await self.session.scalar(select(func.count()).select_from(Pet).where(*conds))
        items = [CatalogRow(pet=pet, cover_url=url) for pet, url in page]
        return items, next_cursor, total or 0

    async def count_by_curator(
        self, *, shelter_ids: Collection[UUID], volunteer_ids: Collection[UUID]
    ) -> dict[UUID, CuratorCounts]:
        curator = func.coalesce(Pet.shelter_id, Pet.volunteer_id)
        stmt = (
            select(
                curator,
                func.count().filter(Pet.status.in_(CATALOG_STATUSES)),
                func.count().filter(Pet.status == PetStatus.ADOPTED),
            )
            .where(or_(Pet.shelter_id.in_(shelter_ids), Pet.volunteer_id.in_(volunteer_ids)))
            .group_by(curator)
        )
        rows = (await self.session.execute(stmt)).tuples().all()
        return {cid: CuratorCounts(seeking=s, adopted=a) for cid, s, a in rows}

    async def preview_covers(
        self, *, shelter_ids: Collection[UUID], volunteer_ids: Collection[UUID], per_curator: int
    ) -> dict[UUID, list[str]]:
        """Обложки последних питомцев из каталога — мозаика на карточке участника."""
        curator = func.coalesce(Pet.shelter_id, Pet.volunteer_id)
        has_photo = select(PetPhoto.id).where(PetPhoto.pet_id == Pet.id).exists()
        ranked = (
            select(
                curator.label("curator_id"),
                _cover().label("cover"),
                func.row_number()
                .over(partition_by=curator, order_by=(Pet.created_at.desc(), Pet.id))
                .label("n"),
            )
            .where(
                Pet.status.in_(CATALOG_STATUSES),
                has_photo,
                or_(Pet.shelter_id.in_(shelter_ids), Pet.volunteer_id.in_(volunteer_ids)),
            )
            .subquery()
        )
        stmt = (
            select(ranked.c.curator_id, ranked.c.cover)
            .where(ranked.c.n <= per_curator)
            .order_by(ranked.c.curator_id, ranked.c.n)
        )
        result: dict[UUID, list[str]] = {}
        for cid, cover in (await self.session.execute(stmt)).tuples():
            result.setdefault(cid, []).append(cover)
        return result

    async def favorite_ids(self, user_id: UUID, pet_ids: Collection[UUID]) -> set[UUID]:
        if not pet_ids:
            return set()
        stmt = select(PetFavorite.pet_id).where(
            PetFavorite.user_id == user_id, PetFavorite.pet_id.in_(pet_ids)
        )
        return set(await self.session.scalars(stmt))

    async def set_favorite(self, pet_id: UUID, user_id: UUID, favorite: bool) -> None:
        if favorite:
            stmt = insert(PetFavorite).values(pet_id=pet_id, user_id=user_id)
            await self.session.execute(stmt.on_conflict_do_nothing())
        else:
            await self.session.execute(
                delete(PetFavorite).where(
                    PetFavorite.pet_id == pet_id, PetFavorite.user_id == user_id
                )
            )

    async def favorites_page(
        self, user_id: UUID, params: PageParams
    ) -> tuple[list[CatalogRow], str | None, int]:
        """Избранное — новые сверху; черновики и снятые с публикации не показываем."""
        conds = [PetFavorite.user_id == user_id, Pet.status != PetStatus.DRAFT]
        stmt = apply_cursor(
            select(Pet, _cover(), PetFavorite.created_at)
            .join(PetFavorite, PetFavorite.pet_id == Pet.id)
            .where(*conds),
            created_at=PetFavorite.created_at,
            id_=Pet.id,
            params=params,
        )
        rows = (await self.session.execute(stmt)).tuples().all()
        page, next_cursor = cut_page(rows, params=params, key=lambda r: (r[2], r[0].id))
        total = await self.session.scalar(
            select(func.count())
            .select_from(PetFavorite)
            .join(Pet, Pet.id == PetFavorite.pet_id)
            .where(*conds)
        )
        return [CatalogRow(pet=p, cover_url=url) for p, url, _ in page], next_cursor, total or 0

    # --- кабинет куратора

    async def create(self, **fields: Any) -> Pet:
        pet = Pet(**fields)
        self.session.add(pet)
        await self.session.flush()
        await self.session.refresh(pet)
        return pet

    async def update(self, pet: Pet, fields: dict[str, Any]) -> None:
        for key, value in fields.items():
            setattr(pet, key, value)
        await self.session.flush()
        await self.session.refresh(pet)

    async def delete(self, pet: Pet) -> None:
        await self.session.delete(pet)
        await self.session.flush()

    async def delete_photo(self, photo: PetPhoto) -> None:
        await self.session.delete(photo)
        await self.session.flush()

    async def reorder_photos(self, photos: list[PetPhoto]) -> None:
        for position, photo in enumerate(photos):
            photo.position = position
        await self.session.flush()

    async def managed_page(
        self,
        *,
        shelter_ids: Collection[UUID],
        volunteer_id: UUID,
        status: PetStatus | None,
        params: PageParams,
    ) -> tuple[list[CatalogRow], str | None, int]:
        conds: list[ColumnElement[bool]] = [
            or_(Pet.shelter_id.in_(shelter_ids), Pet.volunteer_id == volunteer_id)
        ]
        if status is not None:
            conds.append(Pet.status == status)
        stmt = apply_cursor(
            select(Pet, _cover()).where(*conds),
            created_at=Pet.created_at,
            id_=Pet.id,
            params=params,
        )
        rows = (await self.session.execute(stmt)).tuples().all()
        page, next_cursor = cut_page(rows, params=params, key=lambda r: (r[0].created_at, r[0].id))
        total = await self.session.scalar(select(func.count()).select_from(Pet).where(*conds))
        return [CatalogRow(pet=p, cover_url=url) for p, url in page], next_cursor, total or 0
