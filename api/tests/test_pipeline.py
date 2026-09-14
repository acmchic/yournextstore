from __future__ import annotations

import cv2
import numpy as np
import pytest

from app.rendering.pipeline import (
    _apply_displacement,
    _connected_light_background_alpha,
    _decode_color,
    _fit_artwork,
    _quad_size,
    _tint_catalog_base,
)
from app.settings import Settings


@pytest.mark.parametrize(
    "color,bgr", [("#000000", (0, 0, 0)), ("#FF0000", (0, 0, 255)), ("#FFFFFF", (255, 255, 255))]
)
def test_translucent_template_preserves_alpha_and_background(tmp_path, color, bgr):
    template = np.array(
        [[[255, 255, 255, 255], [200, 200, 200, 12], [123, 87, 54, 0], [0, 0, 0, 128]]],
        dtype=np.uint8,
    )
    cv2.imwrite(str(tmp_path / "layer.png"), template)
    result = _decode_color("layer.png", Settings(asset_root=tmp_path), garment_color=color)
    alpha = template[:, :, 3:4].astype(np.float32) / 255
    expected = (template[:, :, :3] * alpha + np.array(bgr) * (1 - alpha)).astype(np.uint8)
    np.testing.assert_allclose(result, expected, atol=1)
    np.testing.assert_array_equal(result[0, 0], [255, 255, 255])
    np.testing.assert_array_equal(result[0, 2], bgr)
    if color == "#000000":
        assert result[0, 1].max() <= 10


def test_opaque_rgba_uses_existing_photo_tint(tmp_path):
    image = np.full((40, 40, 3), 255, np.uint8)
    image[5:35, 5:35] = 80
    rgba = np.dstack([image, np.full((40, 40), 255, np.uint8)])
    cv2.imwrite(str(tmp_path / "opaque.png"), rgba)
    actual = _decode_color("opaque.png", Settings(asset_root=tmp_path), garment_color="#25282A")
    np.testing.assert_array_equal(actual, _tint_catalog_base(image, "#25282A"))


def _opaque_artwork(width: int, height: int) -> np.ndarray:
    artwork = np.zeros((height, width, 4), dtype=np.uint8)
    artwork[:, :, :3] = 180
    artwork[:, :, 3] = 255
    return artwork


def test_quad_size_uses_average_opposing_edges() -> None:
    quad = [(10, 10), (110, 10), (130, 210), (0, 210)]

    assert _quad_size(quad) == (115, 201)


def test_contain_preserves_artwork_ratio_and_adds_transparent_padding() -> None:
    artwork = _opaque_artwork(200, 100)

    fitted = _fit_artwork(artwork, [(0, 0), (100, 0), (100, 200), (0, 200)], "contain")

    assert fitted.shape == (200, 100, 4)
    opaque_rows, opaque_columns = np.where(fitted[:, :, 3] > 0)
    assert opaque_columns.min() == 0
    assert opaque_columns.max() == 99
    assert opaque_rows.min() == 75
    assert opaque_rows.max() == 124


def test_connected_white_artwork_background_becomes_transparent() -> None:
    artwork = np.full((40, 60, 3), 255, dtype=np.uint8)
    artwork[10:30, 20:40] = (20, 60, 180)

    alpha = _connected_light_background_alpha(artwork)

    assert alpha[0, 0] == 0
    assert alpha[20, 30] == 255


def test_cover_preserves_artwork_ratio_and_crops_from_center() -> None:
    artwork = _opaque_artwork(200, 100)
    artwork[:, :100, 0] = 40
    artwork[:, 100:, 0] = 220

    fitted = _fit_artwork(artwork, [(0, 0), (100, 0), (100, 200), (0, 200)], "cover")

    assert fitted.shape == (200, 100, 4)
    assert np.all(fitted[:, :, 3] == 255)
    assert fitted[:, 0, 0].mean() < fitted[:, -1, 0].mean()


def test_flat_displacement_map_does_not_move_artwork() -> None:
    artwork = _opaque_artwork(80, 60)
    displacement = np.full((60, 80), 128, dtype=np.uint8)

    displaced = _apply_displacement(artwork, displacement, 12)

    np.testing.assert_array_equal(displaced, artwork)


def test_tint_catalog_base_keeps_background_and_preserves_texture() -> None:
    base = np.full((80, 80, 3), 255, dtype=np.uint8)
    base[20:60, 18:62] = 110
    base[35:60, 18:62] = 150

    tinted = _tint_catalog_base(base, "#25282A")

    np.testing.assert_array_equal(tinted[0, 0], [255, 255, 255])
    assert tinted[25, 30].mean() < tinted[45, 30].mean()
    assert tinted[45, 30, 2] > 0


def test_tint_catalog_base_does_not_blow_out_a_dark_template_for_white() -> None:
    base = np.full((100, 100, 3), 255, dtype=np.uint8)
    base[10:90, 10:90] = 45
    base[30:70, 20:80] = 80
    base[45:55, 20:80] = 115

    tinted = _tint_catalog_base(base, "#FFFFFF")

    garment = tinted[10:90, 10:90]
    blown_out = np.all(garment == 255, axis=2).mean()
    assert blown_out < 0.1
    assert garment.std() > 8


def test_tint_catalog_base_rejects_invalid_hex() -> None:
    with pytest.raises(ValueError, match="Invalid garment color"):
        _tint_catalog_base(np.zeros((2, 2, 3), dtype=np.uint8), "black")
