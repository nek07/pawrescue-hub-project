from typing import Annotated

from fastapi import Depends

from app.core.db import DbSession
from app.modules.pets.repository import PetRepository
from app.modules.pets.service import PetService
from app.modules.shelters.repository import ShelterRepository
from app.modules.shelters.service import ShelterService
from app.modules.users.repository import UserRepository
from app.modules.users.service import UserService


def get_pet_service(session: DbSession) -> PetService:
    return PetService(
        PetRepository(session),
        ShelterService(ShelterRepository(session)),
        UserService(UserRepository(session)),
    )


PetServiceDep = Annotated[PetService, Depends(get_pet_service)]
