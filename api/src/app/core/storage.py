"""S3-совместимое хранилище: presigned-загрузки из браузера и файлы для воркера.

boto3 синхронный, поэтому сетевые вызовы уходят в поток. Подпись presigned URL
считается локально, без запросов в хранилище.
"""

import asyncio
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any, Protocol

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import Depends

from app.core.config import Settings, get_settings


@dataclass(frozen=True)
class ObjectInfo:
    size: int
    content_type: str | None


class Storage(Protocol):
    def presign_put(self, bucket: str, key: str, *, content_type: str, expires: int) -> str: ...

    async def head(self, bucket: str, key: str) -> ObjectInfo | None: ...

    async def get(self, bucket: str, key: str) -> bytes: ...

    async def put(self, bucket: str, key: str, data: bytes, *, content_type: str) -> None: ...

    async def copy(self, bucket: str, source_key: str, target_key: str) -> None: ...

    async def delete(self, bucket: str, key: str) -> None: ...

    def public_url(self, bucket: str, key: str) -> str: ...


def _client(settings: Settings, endpoint: str) -> Any:
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key.get_secret_value(),
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


class S3Storage:
    def __init__(self, settings: Settings) -> None:
        self._client = _client(settings, settings.s3_endpoint_url)
        self._signer = _client(settings, settings.s3_public_url)
        self._photos_base = settings.photos_public_url
        self._public = settings.s3_public_url.rstrip("/")

    def presign_put(self, bucket: str, key: str, *, content_type: str, expires: int) -> str:
        url: str = self._signer.generate_presigned_url(
            "put_object",
            Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=expires,
        )
        return url

    async def head(self, bucket: str, key: str) -> ObjectInfo | None:
        try:
            meta = await asyncio.to_thread(self._client.head_object, Bucket=bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
                return None
            raise
        return ObjectInfo(size=int(meta["ContentLength"]), content_type=meta.get("ContentType"))

    async def get(self, bucket: str, key: str) -> bytes:
        obj = await asyncio.to_thread(self._client.get_object, Bucket=bucket, Key=key)
        body: bytes = await asyncio.to_thread(obj["Body"].read)
        return body

    async def put(self, bucket: str, key: str, data: bytes, *, content_type: str) -> None:
        await asyncio.to_thread(
            self._client.put_object,
            Bucket=bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
        )

    async def copy(self, bucket: str, source_key: str, target_key: str) -> None:
        await asyncio.to_thread(
            self._client.copy_object,
            Bucket=bucket,
            Key=target_key,
            CopySource={"Bucket": bucket, "Key": source_key},
        )

    async def delete(self, bucket: str, key: str) -> None:
        await asyncio.to_thread(self._client.delete_object, Bucket=bucket, Key=key)

    def public_url(self, bucket: str, key: str) -> str:
        base = self._photos_base or f"{self._public}/{bucket}"
        return f"{base.rstrip('/')}/{key}"

    async def ensure_buckets(self, *buckets: str) -> None:
        """Для разработки: в проде бакеты и их политики создаются инфраструктурой."""
        for bucket in buckets:
            try:
                await asyncio.to_thread(self._client.head_bucket, Bucket=bucket)
            except ClientError:
                await asyncio.to_thread(self._client.create_bucket, Bucket=bucket)


@lru_cache
def get_storage() -> S3Storage:
    return S3Storage(get_settings())


StorageDep = Annotated[Storage, Depends(get_storage)]
