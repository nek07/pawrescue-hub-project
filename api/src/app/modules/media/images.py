"""Перекодирование фото в WebP трёх размеров.

Заодно убираем EXIF: в нём бывает GPS — точный адрес дома волонтёра.
"""

import io

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_PIXELS = 40_000_000  # ~ 8000 × 5000; больше — почти наверняка «бомба»
ACCEPTED_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})
# Длинная сторона в пикселях; None — исходный размер.
VARIANTS: dict[str, int | None] = {"card": 600, "page": 1600, "original": None}


class InvalidImageError(ValueError):
    pass


def render_variants(data: bytes) -> dict[str, bytes]:
    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.format not in ACCEPTED_FORMATS:
                raise InvalidImageError(f"format {source.format}")
            if source.width * source.height > MAX_PIXELS:
                raise InvalidImageError("too many pixels")
            image = ImageOps.exif_transpose(source)  # поворот с телефона применяем к пикселям
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
        raise InvalidImageError(str(exc)) from exc

    result: dict[str, bytes] = {}
    for name, side in VARIANTS.items():
        variant = image.copy()
        if side is not None:
            variant.thumbnail((side, side), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        # exif не передаём — в WebP его не будет
        variant.save(buffer, "WEBP", quality=90 if side is None else 82, method=4)
        result[name] = buffer.getvalue()
    return result
