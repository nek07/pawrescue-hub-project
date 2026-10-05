from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.pets.models import Pet
from app.modules.shelters.models import Shelter
from app.seed import PETS, SHELTERS, seed


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
