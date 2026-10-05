from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.feed.models import PostPhoto
from app.modules.pets.models import Pet, PetPhoto
from app.modules.shelters.models import Shelter
from app.seed import PET_PHOTOS, PETS, POST_PHOTOS, SHELTERS, seed, seed_photos
from helpers import MemoryStorage


async def test_seed_is_idempotent(db_session: AsyncSession) -> None:
    await seed(db_session)
    await seed(db_session)
    assert await db_session.scalar(select(func.count()).select_from(Pet)) == len(PETS)
    assert await db_session.scalar(select(func.count()).select_from(Shelter)) == len(SHELTERS)


async def test_seed_contains_murka_from_mockup(db_session: AsyncSession) -> None:
    await seed(db_session)
    murka = await db_session.scalar(select(Pet).where(Pet.name == "Мурка"))
    assert murka is not None
    assert murka.status == "seeking"
    assert "good_with_kids" in murka.traits


async def test_seed_photos_cover_every_pet(db_session: AsyncSession) -> None:
    storage = MemoryStorage()
    await seed(db_session)
    await seed_photos(db_session, storage, "pet-photos")
    await seed_photos(db_session, storage, "pet-photos")

    without_photo = select(func.count()).where(~exists().where(PetPhoto.pet_id == Pet.id))
    assert await db_session.scalar(without_photo) == 0
    pet_photos = await db_session.scalar(select(func.count()).select_from(PetPhoto))
    assert pet_photos == sum(map(len, PET_PHOTOS.values()))
    post_photos = await db_session.scalar(select(func.count()).select_from(PostPhoto))
    assert post_photos == sum(map(len, POST_PHOTOS.values()))
    # Три WebP на каждый файл, как у воркера
    assert all(ct == "image/webp" for _, ct in storage.objects.values())
