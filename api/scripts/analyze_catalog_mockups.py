"""Persist normalized, catalog-specific print areas for downloaded mockups."""

from __future__ import annotations

import asyncio
import hashlib
import json
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from app.db import Database
from app.rendering.print_area import (
    default_print_area,
    normalize_provider_print_area,
    resolve_print_areas,
)
from app.rendering.print_regions import detect_repeated_print_regions
from app.settings import settings

IMAGE_SUFFIXES = {".jpeg", ".jpg", ".png", ".webp"}


def _image_key(path: str) -> str:
    """Return a short stable key for a non-placement mockup image."""
    return "image-" + hashlib.sha256(path.lower().encode()).hexdigest()[:32]


def _mockup_directories(slug: str) -> list[Path]:
    root = settings.asset_root / "mockup"
    directories = [root / slug]
    if root.is_dir():
        directories.extend(path for path in root.glob(f"*/{slug}") if path.is_dir())
    return list(dict.fromkeys(path for path in directories if path.is_dir()))


def _candidate_images(slug: str, assets: list[dict]) -> list[dict]:
    """Merge registered assets with checked-in mockup images for this catalog."""
    candidates: dict[str, dict] = {}
    for asset in assets:
        source = str(asset.get("local_path") or "")
        if not source or Path(source).name.lower() == "avatar-1.png":
            continue
        if Path(source).suffix.lower() not in IMAGE_SUFFIXES:
            continue
        candidates[source] = {
            "asset_id": asset["id"],
            "placement": asset.get("placement") or "unknown",
            "source_path": source,
            "width": asset.get("width"),
            "height": asset.get("height"),
        }

    for directory in _mockup_directories(slug):
        for path in sorted(directory.iterdir()):
            if not path.is_file() or path.suffix.lower() not in IMAGE_SUFFIXES:
                continue
            if path.name.lower() == "avatar-1.png":
                continue
            source = path.relative_to(settings.asset_root).as_posix()
            candidates.setdefault(
                source,
                {
                    "asset_id": None,
                    "placement": "front" if path.stem.lower() == "front" else ("back" if path.stem.lower() == "back" else _image_key(source)),
                    "source_path": source,
                    "width": None,
                    "height": None,
                },
            )
    used_placements: set[str] = set()
    for candidate in candidates.values():
        placement = str(candidate["placement"] or "").lower()
        if placement not in {"front", "back", "chest"} or placement in used_placements:
            placement = _image_key(candidate["source_path"])
        candidate["placement"] = placement
        used_placements.add(placement)
    return list(candidates.values())


def _image_dimensions(candidate: dict) -> tuple[int, int] | None:
    try:
        width = int(candidate.get("width") or 0)
        height = int(candidate.get("height") or 0)
    except (TypeError, ValueError):
        width = height = 0
    if width > 0 and height > 0:
        return width, height
    try:
        with Image.open(settings.asset_root / candidate["source_path"]) as image:
            return image.size
    except (FileNotFoundError, OSError, UnidentifiedImageError):
        return None


async def analyze() -> None:
    database = Database(settings)
    analyzed_count = 0
    skipped_count = 0
    try:
        catalogs = await database.fetch_all(
            "select id, slug, product_type, artwork_guideline_json from catalogs where active=true", ()
        )
        async with database.transaction() as cursor:
            for catalog in catalogs:
                guideline = catalog["artwork_guideline_json"] or {}
                if isinstance(guideline, str):
                    guideline = json.loads(guideline)
                kits = {
                    str(item.get("locationCode", "")).lower(): item
                    for item in guideline.get("design_kits", [])
                }
                assets = await database.fetch_all(
                    "select id, placement, local_path, width, height from catalog_assets where catalog_id=%s and status='active' order by id",
                    (catalog["id"],),
                )
                for candidate in _candidate_images(str(catalog["slug"]), assets):
                    dimensions = _image_dimensions(candidate)
                    if dimensions is None:
                        skipped_count += 1
                        continue
                    template_width, template_height = dimensions
                    placement = str(candidate["placement"])
                    logical_placement = placement if placement in {"front", "back", "chest"} else "front"
                    kit = kits.get(logical_placement, {})
                    fallback = default_print_area(catalog.get("product_type"))
                    area = normalize_provider_print_area(
                        kit,
                        product_type=catalog.get("product_type"),
                        template_width=template_width,
                        template_height=template_height,
                        fallback=fallback,
                    )
                    detected_regions = detect_repeated_print_regions(
                        Path(settings.asset_root) / candidate["source_path"], area
                    )
                    area, regions = resolve_print_areas(
                        area,
                        detected_regions,
                        product_type=catalog.get("product_type"),
                        template_width=template_width,
                        template_height=template_height,
                        fallback=fallback,
                    )
                    analyzed = {**area, "regions": regions}
                    # A provider guide, a detected repeated region, or the conservative
                    # default all produce bounded geometry usable by both applications.
                    status = "ready"
                    await cursor.execute(
                        """
                        insert into catalog_mockup_metadata
                          (catalog_id, placement, asset_id, source_path, print_area_json, template_width,
                           template_height, analysis_version, status, analyzed_at)
                        values (%s,%s,%s,%s,%s,%s,%s,%s,%s,current_timestamp(6))
                        on duplicate key update
                          asset_id=if(analysis_version like 'manual-%%', asset_id, values(asset_id)),
                          source_path=if(analysis_version like 'manual-%%', source_path, values(source_path)),
                          print_area_json=if(analysis_version like 'manual-%%', print_area_json, values(print_area_json)),
                          template_width=if(analysis_version like 'manual-%%', template_width, values(template_width)),
                          template_height=if(analysis_version like 'manual-%%', template_height, values(template_height)),
                          analysis_version=if(analysis_version like 'manual-%%', analysis_version, values(analysis_version)),
                          status=if(analysis_version like 'manual-%%', status, values(status)),
                          error_message=if(analysis_version like 'manual-%%', error_message, null),
                          analyzed_at=if(analysis_version like 'manual-%%', analyzed_at, current_timestamp(6))
                        """,
                        (
                            catalog["id"],
                            placement,
                            candidate["asset_id"],
                            candidate["source_path"],
                            json.dumps(analyzed),
                            template_width,
                            template_height,
                            "v5-all-mockup-images-safe-regions",
                            status,
                        ),
                    )
                    analyzed_count += 1
    finally:
        await database.close()
    print(f"Analyzed {analyzed_count} mockup images; skipped {skipped_count}.")


if __name__ == "__main__":
    asyncio.run(analyze())
