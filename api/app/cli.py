from __future__ import annotations

import argparse
import asyncio
import json
import shutil
from pathlib import Path
from typing import Any

from app.catalog_assignment import assign_product_catalog, seed_product_showcase
from app.db import Database
from app.gearment.client import GearmentClient
from app.gearment.sync import sync_catalog
from app.gearment.web_catalog import fetch_product_page
from app.importer import SUPPORTED_EXTENSIONS, import_design, register_design_manifests
from app.settings import settings
from scripts.analyze_catalog_mockups import analyze


async def run_import(args: argparse.Namespace) -> None:
    database = Database(settings)
    design_dir = Path(args.design_dir).resolve()
    if not design_dir.is_dir():
        raise ValueError("Image directory does not exist")
    if args.offset < 0 or (args.limit is not None and args.limit < 1):
        raise ValueError("Offset must be nonnegative and limit must be positive")
    manifest_root = settings.asset_root / "design"
    if not design_dir.is_relative_to(manifest_root.resolve()):
        raise ValueError("Image directory must be inside the mounted design storage")
    # ponytail: rescan sorted paths per batch; use a persisted inventory if directory size makes this slow.
    files = sorted(
        path
        for path in design_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )
    selected = files[args.offset : args.offset + args.limit if args.limit else None]
    results = []
    entries = {}
    try:
        for path in selected:
            try:
                result = await import_design(
                    database=database,
                    design_root=design_dir,
                    design_path=path,
                    publish=args.publish,
                    dry_run=args.dry_run,
                    manifest_root=manifest_root,
                    register_manifest=False,
                )
                results.append(result.__dict__)
                if not args.dry_run:
                    entries[result.slug] = result.source_path
            except (ValueError, OSError, TypeError) as error:
                results.append({"source_path": str(path), "status": "error", "error": str(error)})
    finally:
        try:
            if entries:
                register_design_manifests(manifest_root, entries)
        finally:
            await database.close()
    next_offset = args.offset + len(selected)
    print(
        json.dumps(
            {
                "count": len(results),
                "total": len(files),
                "next_offset": next_offset,
                "done": next_offset >= len(files),
                "results": results,
            }
        )
    )


def load_catalog_cache(path: Path) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    if not path.is_file():
        return {}, {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or payload.get("version") != 1:
        raise ValueError(f"Unsupported catalog cache format: {path}")
    api_rows = payload.get("api_rows", [])
    website_rows = payload.get("website_rows", [])
    if not isinstance(api_rows, list) or not isinstance(website_rows, list):
        raise TypeError(f"Catalog cache must contain api_rows[] and website_rows[]: {path}")
    api_by_id = {
        str(row.get("product_id") or row.get("productId")): row
        for row in api_rows
        if isinstance(row, dict) and (row.get("product_id") or row.get("productId"))
    }
    website_by_id = {
        str(row.get("product_id")): row
        for row in website_rows
        if isinstance(row, dict) and row.get("product_id")
    }
    return api_by_id, website_by_id


def save_catalog_cache(
    path: Path,
    api_by_id: dict[str, dict[str, Any]],
    website_by_id: dict[str, dict[str, Any]],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "version": 1,
                "api_rows": list(api_by_id.values()),
                "website_rows": list(website_by_id.values()),
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )


async def run_gearment_sync(args: argparse.Namespace) -> None:
    manifest_path = Path(args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest.get("products") if isinstance(manifest, dict) else None
    if not isinstance(entries, list) or not entries:
        raise ValueError("Gearment manifest must contain a non-empty products[]")
    selected = [
        entry for entry in entries if isinstance(entry, dict) and entry.get("enabled", True)
    ]
    import_limit = args.limit if args.limit is not None else settings.gearment_import_limit
    if import_limit < 1:
        raise ValueError("--limit must be at least 1")
    selected = selected[:import_limit]
    product_ids = [str(entry["product_id"]) for entry in selected]
    cache_path = (
        Path(args.cache_file).expanduser().resolve()
        if args.cache_file
        else manifest_path.with_name("catalog-import.cache.json")
    )
    api_by_id, website_by_id = ({}, {}) if args.refresh_cache else load_catalog_cache(cache_path)
    missing_api_ids = [product_id for product_id in product_ids if product_id not in api_by_id]
    if missing_api_ids:
        client = GearmentClient(
            base_url=settings.gearment_api_base_url,
            client_key=settings.gearment_client_key,
            client_secret=settings.gearment_client_secret,
        )
        api_rows = await asyncio.to_thread(client.list_catalog, missing_api_ids)
        api_by_id.update(
            {
                str(row.get("product_id") or row.get("productId")): row
                for row in api_rows
                if isinstance(row, dict) and (row.get("product_id") or row.get("productId"))
            }
        )
    database = Database(settings)
    results = []
    failures = []
    try:
        cache_changed = bool(missing_api_ids)
        for entry in selected:
            product_id = str(entry["product_id"])
            cached_website = website_by_id.get(product_id)
            has_current_url = cached_website and cached_website.get("source_url") == entry.get(
                "source_page_url"
            )
            if has_current_url:
                continue
            try:
                website_by_id[product_id] = await asyncio.to_thread(
                    fetch_product_page, str(entry["source_page_url"])
                )
                cache_changed = True
            except Exception as error:  # noqa: BLE001 - keep one catalog failure from aborting the batch
                failures.append(
                    {
                        "product_id": product_id,
                        "url": entry.get("source_page_url"),
                        "error": str(error),
                    }
                )
        if cache_changed and args.apply:
            save_catalog_cache(cache_path, api_by_id, website_by_id)
        ready_entries = [
            entry
            for entry in selected
            if api_by_id.get(str(entry["product_id"]))
            and website_by_id.get(str(entry["product_id"]))
        ]
        if args.apply and args.truncate and not args.no_truncate:
            # Reset only the catalogs in this batch. Local mockups are kept so
            # the following import can reuse them without a provider request.
            await truncate_catalogs(
                database,
                [str(entry["product_id"]) for entry in ready_entries],
            )
        for entry in ready_entries:
            product_id = str(entry["product_id"])
            api_record = api_by_id.get(product_id)
            if not api_record:
                failures.append(
                    {
                        "product_id": product_id,
                        "url": entry.get("source_page_url"),
                        "error": f"Gearment API did not return requested product: {product_id}",
                    }
                )
                continue
            try:
                website = website_by_id.get(product_id)
                if not website:
                    continue
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
            except Exception as error:  # noqa: BLE001 - report provider/database failures per catalog
                failures.append(
                    {
                        "product_id": product_id,
                        "url": entry.get("source_page_url"),
                        "error": str(error),
                    }
                )
                continue
    finally:
        await database.close()
    print(
        json.dumps(
            {
                "count": len(results),
                "failed": len(failures),
                "results": results,
                "failures": failures,
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    if failures:
        raise SystemExit(1)


async def refresh_gearment_size_charts(args: argparse.Namespace) -> None:
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    entries = [entry for entry in manifest.get("products", []) if entry.get("enabled", True)]
    entries = entries[: args.limit or len(entries)]
    database = Database(settings)
    results = []
    try:
        for entry in entries:
            website = await asyncio.to_thread(fetch_product_page, str(entry["source_page_url"]))
            await database.execute(
                "update catalogs set provider_size_chart_json=%s where provider='gearment' and provider_product_id=%s",
                (json.dumps(website["size_chart"], ensure_ascii=False), str(entry["product_id"])),
            )
            results.append(
                {
                    "product_id": entry["product_id"],
                    "rows": len(website["size_chart"].get("rows", [])),
                }
            )
    finally:
        await database.close()
    print(json.dumps({"count": len(results), "results": results}, ensure_ascii=False))


async def truncate_catalogs(
    database: Database,
    provider_ids: list[str],
    *,
    remove_assets: bool = False,
) -> None:
    async with database.transaction() as cursor:
        if provider_ids:
            placeholders = ",".join(["%s"] * len(provider_ids))
            await cursor.execute(
                f"select id, slug from catalogs where provider='gearment' and provider_product_id in ({placeholders})",
                tuple(provider_ids),
            )
        else:
            await cursor.execute("select id, slug from catalogs where provider='gearment'")
        catalog_rows = await cursor.fetchall()
        catalog_ids = [row["id"] for row in catalog_rows]
        if not catalog_ids:
            return
        ids = ",".join(["%s"] * len(catalog_ids))
        variant_ids = []
        await cursor.execute(
            f"select id from catalog_variants where catalog_id in ({ids})", tuple(catalog_ids)
        )
        variant_ids = [row["id"] for row in await cursor.fetchall()]
        if variant_ids:
            variant_placeholders = ",".join(["%s"] * len(variant_ids))
            await cursor.execute(
                f"delete from cart_items where product_variant_id in (select id from product_variants where catalog_variant_id in ({variant_placeholders}))",
                tuple(variant_ids),
            )
            await cursor.execute(
                f"delete from product_variants where catalog_variant_id in ({variant_placeholders})",
                tuple(variant_ids),
            )
        for table, column in (
            ("product_catalogs", "catalog_id"),
            ("catalog_mockup_metadata", "catalog_id"),
            ("catalog_assets", "catalog_id"),
            ("mockup_templates", "catalog_id"),
            ("catalog_print_locations", "catalog_id"),
            ("catalog_taxonomy", "catalog_id"),
            ("catalog_variants", "catalog_id"),
            ("catalog_colors", "catalog_id"),
            ("catalog_sizes", "catalog_id"),
            ("catalogs", "id"),
        ):
            await cursor.execute(
                f"delete from {table} where {column} in ({ids})", tuple(catalog_ids)
            )
        if remove_assets:
            for row in catalog_rows:
                for category in ("unisex", "women", "kids", "accessories", "home-living", "other"):
                    await asyncio.to_thread(
                        shutil.rmtree, settings.asset_root / "mockup" / category / row["slug"], True
                    )
        # Rendered files contain the old template/design combination and must not survive a re-import.
        await asyncio.to_thread(shutil.rmtree, settings.cache_dir, True)
        settings.cache_dir.mkdir(parents=True, exist_ok=True)


async def run_catalog_assignment(args: argparse.Namespace) -> None:
    database = Database(settings)
    try:
        result = await assign_product_catalog(
            database=database,
            product_slug=args.product,
            catalog_slug=args.catalog,
            color_slug=args.color,
        )
    finally:
        await database.close()
    print(json.dumps(result.__dict__, indent=2, ensure_ascii=False))


async def run_product_showcase_seed(args: argparse.Namespace) -> None:
    database = Database(settings)
    try:
        result = await seed_product_showcase(database=database, per_category=args.per_category)
    finally:
        await database.close()
    print(json.dumps(result, indent=2, ensure_ascii=False))


async def run_catalog_truncate(args: argparse.Namespace) -> None:
    database = Database(settings)
    try:
        await truncate_catalogs(database, args.provider_id, remove_assets=args.remove_assets)
    finally:
        await database.close()


def main() -> None:
    parser = argparse.ArgumentParser(prog="pod-commerce")
    subparsers = parser.add_subparsers(dest="command", required=True)
    command = subparsers.add_parser("import-products")
    command.add_argument("--design-dir", required=True)
    command.add_argument("--limit", type=int)
    command.add_argument("--offset", type=int, default=0)
    command.add_argument("--publish", action="store_true")
    command.add_argument("--dry-run", action="store_true")
    gearment = subparsers.add_parser("sync-gearment-catalog")
    gearment.add_argument("--manifest", default="catalog-import.json")
    gearment.add_argument("--apply", action="store_true")
    gearment.add_argument("--refresh-assets", action="store_true")
    gearment.add_argument(
        "--cache-file", default=None, help="Local JSON cache for Gearment API/page data"
    )
    gearment.add_argument(
        "--refresh-cache",
        action="store_true",
        help="Ignore the local JSON cache and fetch fresh catalog data",
    )
    gearment.add_argument("--limit", type=int, default=None)
    gearment.add_argument("--truncate", action="store_true", help=argparse.SUPPRESS)
    gearment.add_argument(
        "--no-truncate", action="store_true", help="Keep existing selected Gearment catalog rows"
    )
    truncate = subparsers.add_parser("truncate-gearment-catalogs")
    truncate.add_argument(
        "--provider-id",
        action="append",
        default=[],
        help="Only truncate this Gearment product ID; repeat for multiple IDs",
    )
    truncate.add_argument(
        "--remove-assets", action="store_true", help="Also delete local mockup files"
    )
    charts = subparsers.add_parser("refresh-gearment-size-charts")
    charts.add_argument("--manifest", default="catalog-import.json")
    charts.add_argument("--limit", type=int, default=None)
    assignment = subparsers.add_parser("assign-product-catalog")
    assignment.add_argument("--product", required=True)
    assignment.add_argument("--catalog", required=True)
    assignment.add_argument(
        "--color",
        default=None,
        help="Default catalog color slug or name; must exist in the catalog",
    )
    showcase = subparsers.add_parser(
        "seed-product-showcase",
        help="Assign active products to each eligible catalog and available colors",
    )
    showcase.add_argument(
        "--per-category",
        type=int,
        default=4,
        help="Number of products to assign to each eligible catalog (default: 4)",
    )
    subparsers.add_parser("analyze-catalog-mockups")
    args = parser.parse_args()
    if args.command == "import-products":
        asyncio.run(run_import(args))
    elif args.command == "sync-gearment-catalog":
        asyncio.run(run_gearment_sync(args))
    elif args.command == "truncate-gearment-catalogs":
        asyncio.run(run_catalog_truncate(args))
    elif args.command == "refresh-gearment-size-charts":
        asyncio.run(refresh_gearment_size_charts(args))
    elif args.command == "assign-product-catalog":
        asyncio.run(run_catalog_assignment(args))
    elif args.command == "seed-product-showcase":
        asyncio.run(run_product_showcase_seed(args))
    elif args.command == "analyze-catalog-mockups":
        asyncio.run(analyze())


if __name__ == "__main__":
    main()
