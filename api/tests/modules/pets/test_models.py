from datetime import date

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cities import City
from app.modules.pets.models import Pet, PetKind, PetSex, PetStatus
from app.modules.shelters.models import Shelter
from app.modules.users.models import User, UserRole


async def _curators(db: AsyncSession) -> tuple[Shelter, User]:
    shelter = Shelter(name="Тёплый угол", city=City.PAVLODAR)
    volunteer = User(name="Дана", role=UserRole.VOLUNTEER)
    db.add_all([shelter, volunteer])
    await db.flush()
    return shelter, volunteer


def _pet(**curator: object) -> Pet:
    return Pet(
        name="Мурка",
        kind=PetKind.CAT,
        sex=PetSex.FEMALE,
        birth_date=date(2022, 6, 1),
        city=City.PAVLODAR,
        **curator,
    )


async def test_pet_defaults(db_session: AsyncSession) -> None:
    shelter, _ = await _curators(db_session)
    pet = _pet(shelter_id=shelter.id)
    db_session.add(pet)
    await db_session.flush()
    await db_session.refresh(pet)
    assert pet.status == PetStatus.DRAFT
    assert pet.traits == []
    assert pet.sterilized is False


@pytest.mark.parametrize("which", ["both", "none"])
async def test_pet_must_have_exactly_one_curator(db_session: AsyncSession, which: str) -> None:
    shelter, volunteer = await _curators(db_session)
    curator = {"shelter_id": shelter.id, "volunteer_id": volunteer.id} if which == "both" else {}
    db_session.add(_pet(**curator))
    with pytest.raises(IntegrityError, match="ck_pets_one_curator"):
        await db_session.flush()


async def test_search_vector_uses_russian_stemming(db_session: AsyncSession) -> None:
    shelter, _ = await _curators(db_session)
    db_session.add(_pet(shelter_id=shelter.id, story="Её нашли у подъезда в феврале"))
    await db_session.flush()
    # «подъезды» и «подъезда» сводятся к одной основе
    query = func.plainto_tsquery("russian", "подъезды")
    found = await db_session.scalar(select(Pet.name).where(Pet.search.bool_op("@@")(query)))
    assert found == "Мурка"
