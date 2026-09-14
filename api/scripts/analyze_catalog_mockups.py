"""Persist normalized, catalog-specific print areas for downloaded mockups."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from app.db import Database
from app.rendering.print_regions import detect_repeated_print_regions
from app.settings import settings


def percent(value: Any, default: float) -> float:
    if value is None:
        return default
    number = float(value)
    return number * 100 if 0 < number <= 1 else number


def default_area(product_type: str | None) -> dict[str, float]:
    """Keep front artwork above pockets when a provider has no print guide."""
    if (product_type or "").lower() in {"hoodie", "hoodies", "sweatshirt"}:
        return {"x": 0.30, "y": 0.16, "width": 0.40, "height": 0.28}
    return {"x": 0.30, "y": 0.25, "width": 0.40, "height": 0.40}


async def analyze() -> None:
    database = Database(settings)
    try:
        catalogs = await database.fetch_all(
            "select id, product_type, artwork_guideline_json from catalogs where active=true", ()
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
                for placement in ("front", "back"):
                    asset = next((item for item in assets if item["placement"] == placement), None)
                    asset = asset or next(
                        (item for item in assets if item["placement"] == "front"), None
                    )
                    asset = asset or (assets[0] if assets else None)
                    kit = kits.get(placement, {})
                    if not asset or not asset["width"] or not asset["height"]:
                        continue
                    fallback = default_area(catalog.get("product_type"))
                    area = {
                        "x": percent(kit.get("designAreaX"), fallback["x"] * 100) / 100,
                        "y": percent(kit.get("designAreaY"), fallback["y"] * 100) / 100,
                        "width": percent(kit.get("designAreaWidth"), fallback["width"] * 100) / 100,
                        "height": percent(kit.get("designAreaHeight"), fallback["height"] * 100)
                        / 100,
                    }
                    regions = detect_repeated_print_regions(
                        Path(settings.asset_root) / asset["local_path"], area
                    )
                    analyzed = {**area, "regions": regions}
                    status = "ready" if placement in kits or len(regions) > 1 else "needs_review"
                    await cursor.execute(
                        """
                        insert into catalog_mockup_metadata
                          (catalog_id, placement, asset_id, print_area_json, template_width,
                           template_height, analysis_version, status, analyzed_at)
                        values (%s,%s,%s,%s,%s,%s,%s,%s,current_timestamp(6))
                        on duplicate key update asset_id=values(asset_id),
                          print_area_json=values(print_area_json), template_width=values(template_width),
                          template_height=values(template_height), analysis_version=values(analysis_version),
                          status=values(status), error_message=null, analyzed_at=current_timestamp(6)
                        """,
                        (
                            catalog["id"],
                            placement,
                            asset["id"],
                            json.dumps(analyzed),
                            asset["width"],
                            asset["height"],
                            "v2-safe-regions",
                            status,
                        ),
                    )
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(analyze())
