import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import httpx
import pytest
from arq import Retry
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import AuthIdentity, AuthProvider
from app.seed import STAFF
from app.workers.notifications import notify_application_status, notify_new_application
from helpers import login

pytestmark = pytest.mark.usefixtures("seeded")


class FakeBot:
    def __init__(self, fail: bool = False) -> None:
        self.sent: list[tuple[str, str]] = []
        self.fail = fail

    async def send_message(self, chat_id: str, text: str) -> None:
        if self.fail:
            raise httpx.ConnectError("telegram is down")
        self.sent.append((chat_id, text))


def _ctx(db_session: AsyncSession, bot: FakeBot | None) -> dict[str, Any]:
    @asynccontextmanager
    async def factory() -> AsyncIterator[AsyncSession]:
        yield db_session  # тестовую сессию не закрываем — её откатит фикстура

    return {"session_factory": factory, "telegram": bot, "job_try": 1}


async def _application(client: httpx.AsyncClient) -> str:
    await login(client, "Асель")
    pet = (await client.get("/api/v1/pets", params={"q": "Мурка"})).json()["items"][0]["id"]
    form = {
        "name": "Асель",
        "phone": "+77012345678",
        "city": "pavlodar",
        "housing": "flat",
        "consent": True,
    }
    r = await client.post(f"/api/v1/pets/{pet}/applications", json=form)
    return str(r.json()["id"])


async def _link_telegram(db: AsyncSession, user_id: Any, chat_id: str) -> None:
    db.add(AuthIdentity(user_id=user_id, provider=AuthProvider.TELEGRAM, provider_user_id=chat_id))
    await db.flush()


async def test_new_application_goes_to_shelter_staff(
    client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    app_id = await _application(client)
    await _link_telegram(db_session, STAFF[0]["id"], "5001")
    bot = FakeBot()
    await notify_new_application(_ctx(db_session, bot), app_id)
    assert bot.sent == [("5001", "Новая заявка на Мурка от Асель. Откройте Paw Rescue Hub.")]


async def test_status_change_goes_to_applicant(
    client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    app_id = await _application(client)
    me = (await client.get("/api/v1/auth/me")).json()
    await _link_telegram(db_session, uuid.UUID(me["id"]), "6001")

    staff = client  # переиспользуем клиент: входим как сотрудник
    await login(staff, "Гульнара")
    await staff.patch(f"/api/v1/applications/{app_id}", json={"status": "approved"})

    bot = FakeBot()
    await notify_application_status(_ctx(db_session, bot), app_id)
    assert bot.sent == [("6001", "Заявку на Мурка одобрили! Куратор свяжется с вами.")]


async def test_telegram_failure_is_retried(
    client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    app_id = await _application(client)
    await _link_telegram(db_session, STAFF[0]["id"], "5001")
    with pytest.raises(Retry):
        await notify_new_application(_ctx(db_session, FakeBot(fail=True)), app_id)


async def test_without_bot_nothing_breaks(
    client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    app_id = await _application(client)
    await notify_new_application(_ctx(db_session, None), app_id)
