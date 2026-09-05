from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from app.catalog_assignment import assign_product_catalog
from app.db import Database
from app.gearment.client import GearmentClient
from app.gearment.sync import sync_catalog
from app.gearment.web_catalog import fetch_product_page
from app.importer import SUPPORTED_EXTENSIONS, import_design
from app.settings import settings


async def run_import(args: argparse.Namespace) -> None:
    database = Database(settings)
    design_dir = Path(args.design_dir).resolve()
    files = sorted(
        path for path in design_dir.rglob("*") if path.suffix.lower() in SUPPORTED_EXTENSIONS
    )
    results = []
    try:
        for path in files:
            result = await import_design(
                database=database,
                design_root=design_dir,
                design_path=path,
                catalog_slug=args.catalog,
                color_slugs=args.colors.split(","),
                size_codes=args.sizes.split(","),
                publish=args.publish,
                dry_run=args.dry_run,
            )
            results.append(result.__dict__)
    finally:
        await database.close()
    print(json.dumps({"count": len(results), "results": results}, indent=2))


async def run_gearment_sync(args: argparse.Namespace) -> None:
    manifest_path = Path(args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest.get("products") if isinstance(manifest, dict) else None
    if not isinstance(entries, list) or not entries:
        raise ValueError("Gearment manifest must contain a non-empty products[]")
    selected = [
        entry for entry in entries if isinstance(entry, dict) and entry.get("enabled", True)
    ]
    product_ids = [str(entry["product_id"]) for entry in selected]
    client = GearmentClient(
        base_url=settings.gearment_api_base_url,
        client_key=settings.gearment_client_key,
        client_secret=settings.gearment_client_secret,
    )
    api_rows = await asyncio.to_thread(client.list_catalog, product_ids)
    api_by_id = {
        str(row.get("product_id") or row.get("productId")): row
        for row in api_rows
        if isinstance(row, dict)
    }
    database = Database(settings)
    results = []
    try:
        for entry in selected:
            product_id = str(entry["product_id"])
            api_record = api_by_id.get(product_id)
            if not api_record:
                raise ValueError(f"Gearment API did not return requested product: {product_id}")
            website = await asyncio.to_thread(fetch_product_page, str(entry["source_page_url"]))
            result = await sync_catalog(
                database=database,
                api_record=api_record,
                website=website,
                manifest_entry=entry,
                asset_root=settings.asset_root,
                dry_run=not args.apply,
                refresh_assets=args.refresh_assets,
            )
            results.append(result.__dict__)
    finally:
        await database.close()
    print(json.dumps({"count": len(results), "results": results}, indent=2, ensure_ascii=False))


async def run_catalog_assignment(args: argparse.Namespace) -> None:
    database = Database(settings)
    try:
        result = await assign_product_catalog(
            database=database, product_slug=args.product, catalog_slug=args.catalog
        )
    finally:
        await database.close()
    print(json.dumps(result.__dict__, indent=2, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(prog="pod-commerce")
    subparsers = parser.add_subparsers(dest="command", required=True)
    command = subparsers.add_parser("import-products")
    command.add_argument("--design-dir", required=True)
    command.add_argument("--catalog", default="t-shirt")
    command.add_argument("--colors", default="black,white,navy,yam")
    command.add_argument("--sizes", default="S,M,L,XL,2XL")
    command.add_argument("--publish", action="store_true")
    command.add_argument("--dry-run", action="store_true")
    gearment = subparsers.add_parser("sync-gearment-catalog")
    gearment.add_argument("--manifest", default="catalog-import.json")
    gearment.add_argument("--apply", action="store_true")
    gearment.add_argument("--refresh-assets", action="store_true")
    assignment = subparsers.add_parser("assign-product-catalog")
    assignment.add_argument("--product", required=True)
    assignment.add_argument("--catalog", required=True)
    args = parser.parse_args()
    if args.command == "import-products":
        asyncio.run(run_import(args))
    elif args.command == "sync-gearment-catalog":
        asyncio.run(run_gearment_sync(args))
    elif args.command == "assign-product-catalog":
        asyncio.run(run_catalog_assignment(args))


if __name__ == "__main__":
    main()
