"""Заявка открывает диалог: системные сообщения — ключи перевода для фронта."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.workers.notifications import notify_application_status, notify_new_application
from helpers import MemoryPubSub, login

pytestmark = pytest.mark.usefixtures("seeded")


def _ctx(db_session: AsyncSession, pubsub: MemoryPubSub) -> dict[str, Any]:
    @asynccontextmanager
    async def factory() -> AsyncIterator[AsyncSession]:
        yield db_session

    return {"session_factory": factory, "telegram": None, "pubsub": pubsub}


async def test_application_appears_in_chat_with_status_panel(
    make_client: Any, db_session: AsyncSession, pubsub: MemoryPubSub
) -> None:
    asel, staff = await make_client(), await make_client()
    await login(asel, "Асель")
    await login(staff, "Гульнара")
    pet = (await asel.get("/api/v1/pets", params={"q": "Мурка"})).json()["items"][0]["id"]
    form = {
        "name": "Асель",
        "phone": "+77012345678",
        "city": "pavlodar",
        "housing": "flat",
        "consent": True,
    }
    app_id = (await asel.post(f"/api/v1/pets/{pet}/applications", json=form)).json()["id"]

    await notify_new_application(_ctx(db_session, pubsub), app_id)
    # После заявки фронт открывает чат тем же идемпотентным вызовом
    conv = (await asel.post("/api/v1/conversations", json={"pet_id": pet})).json()
    assert conv["application"] == {"id": app_id, "status": "sent"}
    assert conv["last_message"]["kind"] == "system"
    assert conv["last_message"]["text"] == "application.sent"
    assert conv["last_message"]["side"] is None

    await staff.patch(f"/api/v1/applications/{app_id}", json={"status": "meeting"})
    await notify_application_status(_ctx(db_session, pubsub), app_id)
    conv = (await asel.get(f"/api/v1/conversations/{conv['id']}")).json()
    assert conv["application"]["status"] == "meeting"
    assert conv["last_message"]["text"] == "application.meeting"
    assert conv["unread_count"] == 2  # системные сообщения тоже новые
