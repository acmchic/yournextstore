"""Persist normalized, catalog-specific print areas for downloaded mockups."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from app.db import Database
from app.rendering.print_area import (
    default_print_area,
    normalize_provider_print_area,
    resolve_print_areas,
)
from app.rendering.print_regions import detect_repeated_print_regions
from app.settings import settings


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
                    fallback = default_print_area(catalog.get("product_type"))
                    area = normalize_provider_print_area(
                        kit,
                        product_type=catalog.get("product_type"),
                        template_width=int(asset["width"]),
                        template_height=int(asset["height"]),
                        fallback=fallback,
                    )
                    detected_regions = detect_repeated_print_regions(
                        Path(settings.asset_root) / asset["local_path"], area
                    )
                    area, regions = resolve_print_areas(
                        area,
                        detected_regions,
                        product_type=catalog.get("product_type"),
                        template_width=int(asset["width"]),
                        template_height=int(asset["height"]),
                        fallback=fallback,
                    )
                    analyzed = {**area, "regions": regions}
                    # A provider guide, a detected repeated region, or the conservative
                    # default all produce bounded geometry usable by both applications.
                    status = "ready"
                    await cursor.execute(
                        """
                        insert into catalog_mockup_metadata
                          (catalog_id, placement, asset_id, print_area_json, template_width,
                           template_height, analysis_version, status, analyzed_at)
                        values (%s,%s,%s,%s,%s,%s,%s,%s,current_timestamp(6))
                        on duplicate key update
                          asset_id=if(analysis_version like 'manual-%%', asset_id, values(asset_id)),
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
                            asset["id"],
                            json.dumps(analyzed),
                            asset["width"],
                            asset["height"],
                            "v4-normalized-safe-regions-42x48",
                            status,
                        ),
                    )
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(analyze())
