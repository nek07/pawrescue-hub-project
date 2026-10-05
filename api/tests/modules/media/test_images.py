import io

import pytest
from PIL import Image

from app.modules.media.images import InvalidImageError, render_variants
from helpers import jpeg


def _open(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data))


def test_three_webp_sizes() -> None:
    variants = render_variants(jpeg(2400, 1800))
    sizes = {name: _open(blob).size for name, blob in variants.items()}
    assert sizes == {"card": (600, 450), "page": (1600, 1200), "original": (2400, 1800)}
    assert all(_open(blob).format == "WEBP" for blob in variants.values())


def test_small_image_is_not_upscaled() -> None:
    assert _open(render_variants(jpeg(400, 300))["page"]).size == (400, 300)


def test_exif_with_gps_is_stripped() -> None:
    source = jpeg(gps=True)
    assert _open(source).getexif().get(0x8825) is not None
    for blob in render_variants(source).values():
        assert not _open(blob).getexif()


def test_phone_rotation_is_applied_to_pixels() -> None:
    # Снято «боком»: пиксели 2400×1800, но EXIF говорит повернуть на 90°
    variants = render_variants(jpeg(2400, 1800, rotated=True))
    assert _open(variants["original"]).size == (1800, 2400)


@pytest.mark.parametrize("data", [b"not an image", b""])
def test_garbage_is_rejected(data: bytes) -> None:
    with pytest.raises(InvalidImageError):
        render_variants(data)


def test_gif_is_rejected() -> None:
    buffer = io.BytesIO()
    Image.new("RGB", (10, 10)).save(buffer, "GIF")
    with pytest.raises(InvalidImageError):
        render_variants(buffer.getvalue())
