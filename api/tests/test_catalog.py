from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import pytest

from app.catalog import (
    build_catalog_render_job,
    canonical_image_path,
    parse_canonical_image_path,
    parse_placement,
    split_design_and_catalog,
)
from app.settings import Settings


def test_split_supports_query_catalog_and_path_shorthand() -> None:
    assert split_design_and_catalog("ids/gmc/art.png", "t-shirt-black") == (
        "ids/gmc/art.png",
        "t-shirt-black",
    )
    assert split_design_and_catalog("ids/gmc/art.png/t-shirt-black", None) == (
        "ids/gmc/art.png",
        "t-shirt-black",
    )


def test_rejects_invalid_position_and_path_traversal(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="pos must be"):
        parse_placement("left")

    settings = Settings(asset_root=tmp_path)
    with pytest.raises(ValueError, match="inside"):
        build_catalog_render_job(
            design_path="../../secret.png",
            catalog="t-shirt-black",
            placement="front",
            settings=settings,
        )


def test_builds_back_and_chest_jobs_from_catalog(tmp_path: Path) -> None:
    design = tmp_path / "design" / "set" / "art.png"
    mockup = tmp_path / "mockup" / "t-shirt"
    design.parent.mkdir(parents=True)
    mockup.mkdir(parents=True)
    image = np.full((1000, 800, 4), 255, dtype=np.uint8)
    cv2.imwrite(str(design), image)
    cv2.imwrite(str(mockup / "black-front.png"), image[:, :, :3])
    cv2.imwrite(str(mockup / "black-back.png"), image[:, :, :3])
    settings = Settings(asset_root=tmp_path)

    chest = build_catalog_render_job(
        design_path="set/art.png",
        catalog="t-shirt-black",
        placement="chest",
        settings=settings,
    )
    back = build_catalog_render_job(
        design_path="set/art.png",
        catalog="t-shirt-black",
        placement="back",
        settings=settings,
    )

    assert chest.base_source == "mockup/t-shirt/black-front.png"
    assert chest.print_area.dst_quad[0] == (416, 290)
    assert back.base_source == "mockup/t-shirt/black-back.png"
    assert back.print_area.surface_mode == "none"
    assert back.print_area.displacement_strength == 0
    assert back.print_area.shadow_opacity == 0
    assert back.print_area.highlight_opacity == 0


def test_canonical_image_path_uses_manifest_and_extension_at_end(tmp_path: Path) -> None:
    design_root = tmp_path / "design"
    design_root.mkdir()
    (design_root / "manifest.json").write_text('{"rookie-dad-2024":"ids/gmc/art.png"}')
    settings = Settings(asset_root=tmp_path)

    parsed = parse_canonical_image_path("rookie-dad-2024/t-shirt-black-left-chest.webp", settings)

    assert parsed == ("ids/gmc/art.png", "t-shirt-black", "chest", "flat", "webp")
    assert (
        canonical_image_path(
            design_path="ids/gmc/art.png",
            catalog="t-shirt-black",
            placement="back",
            image_format="png",
            settings=settings,
        )
        == "/img/rookie-dad-2024/t-shirt-black-back.png"
    )


def test_canonical_women_mockup_defaults_to_front(tmp_path: Path) -> None:
    design_root = tmp_path / "design"
    design_root.mkdir()
    (design_root / "manifest.json").write_text('{"rookie-dad-2024":"ids/gmc/art.png"}')
    settings = Settings(asset_root=tmp_path)

    assert parse_canonical_image_path("rookie-dad-2024/t-shirt-white-women.webp", settings) == (
        "ids/gmc/art.png",
        "t-shirt-white",
        "front",
        "women",
        "webp",
    )
    assert parse_canonical_image_path(
        "rookie-dad-2024/t-shirt-white-women-left-chest.webp", settings
    ) == ("ids/gmc/art.png", "t-shirt-white", "chest", "women", "webp")
