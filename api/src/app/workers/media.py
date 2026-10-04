from typing import Any
from uuid import UUID

from arq import Retry
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import get_settings
from app.core.queue import Queue
from app.modules.media.repository import MediaRepository
from app.modules.media.service import MediaService
from app.modules.pets.dependencies import get_pet_service
from app.workers.notifications import SessionFactory


class _NoQueue:
    async def enqueue(self, job: str, *args: str) -> None:
        return None


async def process_pet_photo(ctx: dict[str, Any], upload_id: str) -> None:
    factory: SessionFactory = ctx["session_factory"]
    queue: Queue = _NoQueue()
    async with factory() as session:
        service = MediaService(
            session,
            MediaRepository(session),
            get_pet_service(session),
            ctx["storage"],
            queue,
            ctx.get("settings") or get_settings(),
        )
        try:
            await service.process(UUID(upload_id))
        except (BotoCoreError, ClientError) as exc:  # хранилище недоступно — повторим
            raise Retry(defer=ctx.get("job_try", 1) * 10) from exc
