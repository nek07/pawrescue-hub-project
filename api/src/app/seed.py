"""Сид-данные из макета «Письмо»: uv run python -m app.seed

Идемпотентно: id детерминированы, повторный запуск ничего не дублирует.
"""

import asyncio
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cities import City
from app.core.db import Base, SessionFactory
from app.modules.auth.models import AuthIdentity, AuthProvider
from app.modules.pets.models import ChipStatus, Pet, PetKind, PetSex, PetStatus
from app.modules.pets.models import PetTrait as T
from app.modules.shelters.models import Shelter, ShelterMember, ShelterRole
from app.modules.users.models import User, UserRole

VERIFIED = datetime(2026, 3, 1, tzinfo=UTC)


def sid(key: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"pawrescue-seed:{key}")


SHELTERS: list[dict[str, Any]] = [
    {
        "id": sid("shelter:teply-ugol"),
        "name": "Тёплый угол",
        "city": City.PAVLODAR,
        "address": "ул. Луговая, 16",
        "visit_hours": "Сб–Вс, 11:00–16:00, по записи",
        "about": (
            "Небольшой частный приют: команда волонтёров заботится о кошках и собаках, "
            "лечит, стерилизует и ищет им семьи."
        ),
        "verified_at": VERIFIED,
    },
    {
        "id": sid("shelter:lapa-pomoshchi"),
        "name": "Лапа помощи",
        "city": City.ASTANA,
        "verified_at": VERIFIED,
    },
    {
        "id": sid("shelter:dom-dlya-hvostikov"),
        "name": "Дом для хвостиков",
        "city": City.ALMATY,
        "verified_at": VERIFIED,
    },
]

VOLUNTEERS: list[dict[str, Any]] = [
    {"id": sid("user:dana"), "name": "Дана", "city": City.PAVLODAR},
    {"id": sid("user:asem"), "name": "Асем", "city": City.PAVLODAR},
    {"id": sid("user:erlan"), "name": "Ерлан", "city": City.ALMATY},
]

# Сотрудник «Тёплого угла» — чтобы принимать заявки локально через dev-login.
STAFF: list[dict[str, Any]] = [
    {"id": sid("user:gulnara"), "name": "Гульнара", "city": City.PAVLODAR},
]

TEPLY, LAPA, HVOSTIKI = (s["id"] for s in SHELTERS)
DANA, ASEM, ERLAN = (v["id"] for v in VOLUNTEERS)

MURKA_STORY = (
    "Мурка жила у подъезда на улице Торайгырова, пока соседи не позвонили волонтёрам. "
    "Первые недели она пряталась и почти не ела, но быстро поняла, что здесь безопасно.\n\n"
    "Сейчас это спокойная и ласковая кошка. Любит сидеть на подоконнике и первой приходит "
    "здороваться по утрам. Ей подойдёт тихий дом, можно с детьми постарше."
)


def _pet(
    name: str,
    kind: PetKind,
    sex: PetSex,
    born: date,
    status: PetStatus,
    *,
    shelter: UUID | None = None,
    volunteer: UUID | None = None,
    city: City = City.PAVLODAR,
    traits: tuple[T, ...] = (),
    **extra: Any,
) -> dict[str, Any]:
    return {
        "id": sid(f"pet:{name}"),
        "name": name,
        "kind": kind,
        "sex": sex,
        "birth_date": born,
        "status": status,
        "shelter_id": shelter,
        "volunteer_id": volunteer,
        "city": city,
        "traits": [str(t) for t in traits],
        **extra,
    }


CAT, DOG = PetKind.CAT, PetKind.DOG
F, M = PetSex.FEMALE, PetSex.MALE
S = PetStatus

PETS: list[dict[str, Any]] = [
    # «Тёплый угол», Павлодар
    _pet(
        "Мурка", CAT, F, date(2022, 6, 1), S.SEEKING, shelter=TEPLY,
        traits=(T.AFFECTIONATE, T.GOOD_WITH_KIDS, T.CALM, T.NO_DOGS, T.APARTMENT_OK),
        weight_kg=Decimal("3.8"), sterilized=True, vaccinated_at=date(2026, 8, 14),
        chip=ChipStatus.PLANNED, litter_trained=True,
        story_title="Её нашли у подъезда в феврале", story=MURKA_STORY,
    ),
    _pet("Айна", CAT, F, date(2024, 5, 1), S.SEEKING, shelter=TEPLY, traits=(T.GOOD_WITH_KIDS,)),
    _pet("Граф", CAT, M, date(2023, 4, 1), S.TREATMENT, shelter=TEPLY, traits=(T.CALM,)),
    _pet("Тыква", CAT, F, date(2025, 4, 1), S.SEEKING, shelter=TEPLY, traits=(T.PLAYFUL,)),
    _pet("Майя", CAT, F, date(2022, 3, 1), S.SEEKING, shelter=TEPLY, traits=(T.QUIET,)),
    _pet("Лорд", DOG, M, date(2020, 5, 1), S.SEEKING, shelter=TEPLY, traits=(T.WELL_MANNERED,)),
    _pet(
        "Ветер", DOG, M, date(2024, 6, 1), S.NEEDS_FOSTER, shelter=TEPLY,
        traits=(T.AFTER_TREATMENT, T.NO_DOGS),
    ),
    _pet("Малыш", DOG, M, date(2026, 3, 1), S.SEEKING, shelter=TEPLY, traits=(T.PLAYFUL,)),
    _pet("Тоша", DOG, M, date(2023, 1, 1), S.ADOPTED, shelter=TEPLY),
    # Волонтёры, Павлодар
    _pet(
        "Персик", CAT, M, date(2024, 4, 1), S.SEEKING, volunteer=DANA,
        vaccinated_at=date(2026, 7, 1),
    ),
    _pet("Бусинка", CAT, F, date(2025, 2, 1), S.ADOPTED, volunteer=DANA),
    _pet("Снежок", CAT, M, date(2021, 5, 1), S.NEEDS_FOSTER, volunteer=ASEM, sterilized=True),
    _pet("Барсик", CAT, M, date(2023, 6, 1), S.SEEKING, volunteer=ASEM, traits=(T.LOVES_PEOPLE,)),
    # Астана и Алматы
    _pet(
        "Сабыр", DOG, M, date(2023, 7, 1), S.SEEKING, shelter=LAPA, city=City.ASTANA,
        traits=(T.CALM,),
    ),
    _pet("Жулдыз", DOG, F, date(2022, 2, 1), S.ADOPTED, shelter=LAPA, city=City.ASTANA),
    _pet("Буран", DOG, M, date(2022, 9, 1), S.SEEKING, shelter=HVOSTIKI, city=City.ALMATY),
    _pet("Кнопка", CAT, F, date(2025, 5, 1), S.SEEKING, volunteer=ERLAN, city=City.ALMATY),
]  # fmt: skip


# Порядок «Сначала новые» как на макете каталога; остальные — после.
CATALOG_ORDER = [
    "Мурка", "Айна", "Граф", "Тыква", "Майя", "Персик",
    "Снежок", "Барсик", "Лорд", "Ветер", "Малыш",
]  # fmt: skip
PUBLISHED = datetime(2026, 10, 1, tzinfo=UTC)


def _created_at(name: str, index: int) -> datetime:
    rank = CATALOG_ORDER.index(name) if name in CATALOG_ORDER else len(CATALOG_ORDER) + index
    return PUBLISHED - timedelta(hours=rank)


async def _upsert(session: AsyncSession, model: type[Base], rows: list[dict[str, Any]]) -> None:
    # Колонки у строк разные — вставляем по одной, чтобы пропуски брали default'ы.
    for row in rows:
        await session.execute(insert(model).values(**row).on_conflict_do_nothing())


async def seed(session: AsyncSession) -> None:
    volunteers = [{**v, "role": UserRole.VOLUNTEER, "verified_at": VERIFIED} for v in VOLUNTEERS]
    await _upsert(session, User, volunteers)
    await _upsert(session, User, [{**s, "role": UserRole.USER} for s in STAFF])
    await _upsert(session, Shelter, SHELTERS)
    await _upsert(
        session,
        ShelterMember,
        [{"shelter_id": TEPLY, "user_id": s["id"], "role": ShelterRole.ADMIN} for s in STAFF],
    )
    # POST /auth/dev-login {"name": "Дана", "role": "volunteer"} входит в сид-аккаунт.
    identities = [(v, UserRole.VOLUNTEER) for v in VOLUNTEERS] + [(s, UserRole.USER) for s in STAFF]
    await _upsert(
        session,
        AuthIdentity,
        [
            {
                "id": sid(f"identity:dev:{u['name']}"),
                "user_id": u["id"],
                "provider": AuthProvider.DEV,
                "provider_user_id": f"{role}:{u['name']}",
            }
            for u, role in identities
        ],
    )
    pets = [{**p, "created_at": _created_at(p["name"], i)} for i, p in enumerate(PETS)]
    await _upsert(session, Pet, pets)
    await session.commit()


async def main() -> None:
    async with SessionFactory() as session:
        await seed(session)
    print(f"Seeded: {len(SHELTERS)} shelters, {len(VOLUNTEERS)} volunteers, {len(PETS)} pets")


if __name__ == "__main__":
    asyncio.run(main())
