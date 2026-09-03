from __future__ import annotations

import numpy as np

from app.rendering.pipeline import _apply_displacement, _fit_artwork, _quad_size


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
