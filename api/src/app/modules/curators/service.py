"""Приюты и волонтёры одним списком.

Отдельный модуль, чтобы не связывать shelters и pets в обе стороны:
pets знает про приюты (имя куратора), а этот модуль — про всех троих.
"""

from uuid import UUID

from app.core.pagination import Page
from app.modules.curators.schemas import (
    CuratingOut,
    CuratingShelterOut,
    CuratorCardOut,
    CuratorFilters,
    CuratorType,
    ShelterProfileOut,
)
from app.modules.pets.schemas import CuratorCounts
from app.modules.pets.service import PetService
from app.modules.shelters.models import Shelter
from app.modules.shelters.service import ShelterService
from app.modules.users.models import User, UserRole
from app.modules.users.service import UserService

# Участников десятки, а не тысячи: отдаём одной страницей в формате Page,
# чтобы фронт обрабатывал списки одинаково. Курсор появится, когда понадобится.
MAX_CURATORS = 100
PREVIEW_COVERS = 3

NO_PETS = CuratorCounts(seeking=0, adopted=0)


class CuratorService:
    def __init__(self, shelters: ShelterService, users: UserService, pets: PetService) -> None:
        self.shelters, self.users, self.pets = shelters, users, pets

    async def list_curators(
        self, f: CuratorFilters, viewer_id: UUID | None = None
    ) -> Page[CuratorCardOut]:
        shelters: list[Shelter] = []
        volunteers: list[User] = []
        if f.type in (None, CuratorType.SHELTER):
            shelters = await self.shelters.list_verified(city=f.city, q=f.q, limit=MAX_CURATORS)
        if f.type in (None, CuratorType.VOLUNTEER):
            volunteers = await self.users.list_verified_volunteers(
                city=f.city, q=f.q, limit=MAX_CURATORS
            )
        shelter_ids, volunteer_ids = [s.id for s in shelters], [v.id for v in volunteers]
        counts = await self.pets.count_by_curator(
            shelter_ids=shelter_ids, volunteer_ids=volunteer_ids
        )
        covers = await self.pets.preview_covers(
            shelter_ids=shelter_ids, volunteer_ids=volunteer_ids, per_curator=PREVIEW_COVERS
        )

        items = [
            CuratorCardOut(
                type="shelter",
                id=s.id,
                name=s.name,
                city=s.city,
                avatar_url=s.avatar_url,
                verified=True,
                seeking_count=counts.get(s.id, NO_PETS).seeking,
                adopted_count=counts.get(s.id, NO_PETS).adopted,
                on_platform_since=s.created_at.year,
                preview_covers=covers.get(s.id, []),
            )
            for s in shelters
        ] + [
            CuratorCardOut(
                type="volunteer",
                id=v.id,
                name=v.name,
                city=v.city,
                avatar_url=v.avatar_url,
                verified=True,
                seeking_count=counts.get(v.id, NO_PETS).seeking,
                adopted_count=counts.get(v.id, NO_PETS).adopted,
                on_platform_since=v.created_at.year,
                preview_covers=covers.get(v.id, []),
            )
            for v in volunteers
        ]
        if viewer_id is not None:
            subscribed = await self.shelters.subscribed_ids(viewer_id)
            for item in items:
                item.subscribed = item.type == "shelter" and item.id in subscribed
        # Сначала те, у кого больше питомцев ищут дом.
        items.sort(key=lambda c: (-c.seeking_count, c.name))
        items = items[:MAX_CURATORS]
        return Page(items=items, next_cursor=None, total=len(items))

    async def my_subscriptions(self, user_id: UUID) -> Page[CuratorCardOut]:
        ids = await self.shelters.subscribed_ids(user_id)
        shelters = list((await self.shelters.get_shelters(ids)).values())
        counts = await self.pets.count_by_curator(shelter_ids=ids, volunteer_ids=[])
        covers = await self.pets.preview_covers(
            shelter_ids=ids, volunteer_ids=[], per_curator=PREVIEW_COVERS
        )
        items = [
            CuratorCardOut(
                type="shelter",
                id=s.id,
                name=s.name,
                city=s.city,
                avatar_url=s.avatar_url,
                verified=s.verified_at is not None,
                seeking_count=counts.get(s.id, NO_PETS).seeking,
                adopted_count=counts.get(s.id, NO_PETS).adopted,
                on_platform_since=s.created_at.year,
                preview_covers=covers.get(s.id, []),
                subscribed=True,
            )
            for s in sorted(shelters, key=lambda s: s.name)
        ]
        return Page(items=items, next_cursor=None, total=len(items))

    async def shelter_profile(
        self, shelter_id: UUID, viewer_id: UUID | None = None
    ) -> ShelterProfileOut:
        shelter = await self.shelters.get_shelter(shelter_id)
        counts = await self.pets.count_by_curator(shelter_ids=[shelter.id], volunteer_ids=[])
        stats = counts.get(shelter.id, NO_PETS)
        subscribers = (await self.shelters.subscriber_counts([shelter.id])).get(shelter.id, 0)
        subscribed = viewer_id is not None and shelter.id in await self.shelters.subscribed_ids(
            viewer_id
        )
        return ShelterProfileOut(
            id=shelter.id,
            name=shelter.name,
            city=shelter.city,
            address=shelter.address,
            about=shelter.about,
            visit_hours=shelter.visit_hours,
            avatar_url=shelter.avatar_url,
            cover_url=shelter.cover_url,
            verified=True,
            on_platform_since=shelter.created_at.year,
            seeking_count=stats.seeking,
            adopted_count=stats.adopted,
            subscribers_count=subscribers,
            subscribed=subscribed,
        )

    async def curating(self, user: User) -> CuratingOut:
        ids = await self.shelters.member_shelter_ids(user.id)
        shelters = await self.shelters.get_shelters(ids)
        return CuratingOut(
            shelters=[
                CuratingShelterOut(id=s.id, name=s.name, city=s.city)
                for s in sorted(shelters.values(), key=lambda s: s.name)
                if s.verified_at is not None  # анкеты публикуют только проверенные приюты
            ],
            volunteer=user.role == UserRole.VOLUNTEER and user.verified_at is not None,
        )
