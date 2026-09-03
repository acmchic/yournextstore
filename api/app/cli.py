from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from app.db import Database
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
    args = parser.parse_args()
    if args.command == "import-products":
        asyncio.run(run_import(args))


if __name__ == "__main__":
    main()
