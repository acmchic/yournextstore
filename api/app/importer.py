from __future__ import annotations

import hashlib
import json
import re
import unicodedata
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image

from app.db import Database

SUPPORTED_EXTENSIONS = {".png", ".webp", ".jpg", ".jpeg"}


@dataclass(frozen=True)
class ImportResult:
    slug: str
    status: str
    product_id: str | None
    warnings: tuple[str, ...] = ()


def slugify(value: str) -> str:
    stem = Path(value).stem
    normalized = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def load_sidecar(design_path: Path) -> dict[str, Any]:
    sidecar = design_path.with_suffix(".json")
    if not sidecar.is_file():
        return {}
    value = json.loads(sidecar.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise TypeError(f"Sidecar must contain an object: {sidecar}")
    return value


def register_design_manifest(*, design_root: Path, design_path: Path, slug: str) -> Path:
    design_directory = next(
        (
            path
            for path in (design_root.resolve(), *design_root.resolve().parents)
            if path.name == "design"
        ),
        None,
    )
    if design_directory is None:
        raise ValueError("Design directory must be inside a directory named 'design'")

    manifest_path = design_directory / "manifest.json"
    manifest = (
        json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.is_file() else {}
    )
    if not isinstance(manifest, dict):
        raise TypeError("design/manifest.json must contain an object")
    manifest[slug] = design_path.resolve().relative_to(design_directory).as_posix()
    manifest_path.write_text(
        f"{json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False)}\n",
        encoding="utf-8",
    )
    return manifest_path


async def import_design(
    *,
    database: Database,
    design_root: Path,
    design_path: Path,
    catalog_slug: str,
    color_slugs: list[str],
    size_codes: list[str],
    publish: bool,
    dry_run: bool,
) -> ImportResult:
    root = design_root.resolve()
    source = design_path.resolve()
    if not source.is_relative_to(root):
        raise ValueError("Design path must stay inside the configured design directory")
    if source.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported design type: {source.suffix}")
    if not source.is_file():
        raise FileNotFoundError(source)

    metadata = load_sidecar(source)
    slug = str(metadata.get("slug") or slugify(source.name))
    if not slug:
        raise ValueError(f"Could not derive a slug for {source.name}")
    title = str(metadata.get("title") or slug.replace("-", " ").title())
    description = str(
        metadata.get("description")
        or f"Original {title} design printed on a made-to-order {catalog_slug}."
    )
    alt_text = str(metadata.get("alt_text") or f"{title} {catalog_slug} design")
    license_status = str(metadata.get("license_status") or "owned")
    checksum = hashlib.sha256(source.read_bytes()).hexdigest()
    with Image.open(source) as image:
        width, height = image.size
    relative_source = source.relative_to(root).as_posix()
    public_design_id = f"des_{uuid.uuid4().hex[:22]}"
    public_product_id = f"prd_{uuid.uuid4().hex[:22]}"
    status = "active" if publish else "draft"
    warnings: list[str] = []

    if dry_run:
        return ImportResult(slug=slug, status="dry-run", product_id=None)

    async with database.transaction() as cursor:
        await cursor.execute(
            "select id, public_id from catalogs where slug=%s and active=true", (catalog_slug,)
        )
        catalog = await cursor.fetchone()
        if not catalog:
            raise ValueError(f"Active catalog not found: {catalog_slug}")

        await cursor.execute(
            "select id, public_id, checksum from designs where slug=%s for update", (slug,)
        )
        existing_design = await cursor.fetchone()
        if existing_design:
            design_id = existing_design["id"]
            await cursor.execute(
                """
                update designs set name=%s, source_path=%s, checksum=%s, width=%s, height=%s,
                  license_status=%s, alt_text=%s, metadata_json=%s, status=%s
                where id=%s
                """,
                (
                    title,
                    relative_source,
                    checksum,
                    width,
                    height,
                    license_status,
                    alt_text,
                    json.dumps(metadata),
                    status,
                    design_id,
                ),
            )
            result_status = "unchanged" if existing_design["checksum"] == checksum else "updated"
        else:
            await cursor.execute(
                """
                insert into designs(public_id, slug, name, source_path, checksum, width, height,
                  license_status, alt_text, metadata_json, status)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    public_design_id,
                    slug,
                    title,
                    relative_source,
                    checksum,
                    width,
                    height,
                    license_status,
                    alt_text,
                    json.dumps(metadata),
                    status,
                ),
            )
            design_id = cursor.lastrowid
            result_status = "created"

        await cursor.execute("select id, public_id from products where slug=%s for update", (slug,))
        product = await cursor.fetchone()
        if product:
            product_id = product["id"]
            product_public_id = product["public_id"]
            await cursor.execute(
                """
                update products set design_id=%s, title=%s, description=%s, status=%s,
                  seo_title=%s, seo_description=%s,
                  published_at=if(%s='active', coalesce(published_at, current_timestamp(6)), null)
                where id=%s
                """,
                (
                    design_id,
                    title,
                    description,
                    status,
                    title,
                    description[:500],
                    status,
                    product_id,
                ),
            )
        else:
            product_public_id = public_product_id
            await cursor.execute(
                """
                insert into products(public_id, design_id, slug, title, description, status, brand,
                  seo_title, seo_description, published_at)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,if(%s='active',current_timestamp(6),null))
                """,
                (
                    product_public_id,
                    design_id,
                    slug,
                    title,
                    description,
                    status,
                    str(metadata.get("brand") or "Own Brand"),
                    title,
                    description[:500],
                    status,
                ),
            )
            product_id = cursor.lastrowid

        placeholders_colors = ",".join(["%s"] * len(color_slugs))
        placeholders_sizes = ",".join(["%s"] * len(size_codes))
        await cursor.execute(
            """
            insert into product_catalogs(product_id, catalog_id, default_color_id, active)
            select %s, ca.id, min(cc.id), true from catalogs ca
            join catalog_colors cc on cc.catalog_id=ca.id
            where ca.id=%s group by ca.id
            on duplicate key update active=true, default_color_id=values(default_color_id)
            """,
            (product_id, catalog["id"]),
        )
        await cursor.execute(
            f"""
            select cv.id, cv.public_id, cv.sku, cv.default_price_minor, cv.currency,
                   cc.slug color_slug, cs.code size_code
            from catalog_variants cv
            join catalog_colors cc on cc.id=cv.color_id
            join catalog_sizes cs on cs.id=cv.size_id
            where cv.catalog_id=%s and cv.active=true
              and cc.slug in ({placeholders_colors}) and cs.code in ({placeholders_sizes})
            """,
            (catalog["id"], *color_slugs, *size_codes),
        )
        variants = await cursor.fetchall()
        expected = len(color_slugs) * len(size_codes)
        if len(variants) != expected:
            warnings.append(f"Expected {expected} variants but found {len(variants)}")
        for variant in variants:
            variant_public_id = (
                f"{product_public_id}_{variant['color_slug']}_{variant['size_code'].lower()}"
            )
            sku = f"{slug}-{catalog_slug}-{variant['color_slug']}-{variant['size_code']}".upper()
            await cursor.execute(
                """
                insert into product_variants(public_id, product_id, catalog_variant_id, sku,
                  price_minor, currency, active)
                values (%s,%s,%s,%s,%s,%s,true)
                on duplicate key update sku=values(sku), price_minor=values(price_minor),
                  currency=values(currency), active=true
                """,
                (
                    variant_public_id,
                    product_id,
                    variant["id"],
                    sku,
                    int(metadata.get("price_minor") or variant["default_price_minor"]),
                    variant["currency"],
                ),
            )

        for collection_slug in metadata.get("collections", []):
            await cursor.execute(
                """
                insert ignore into collection_products(collection_id, product_id)
                select id, %s from collections where slug=%s and status='active'
                """,
                (product_id, collection_slug),
            )

        await cursor.execute(
            "insert into outbox_events(event_type, aggregate_type, aggregate_id, payload_json) values ('product.changed','product',%s,%s)",
            (product_public_id, json.dumps({"slug": slug})),
        )

    register_design_manifest(design_root=root, design_path=source, slug=slug)

    return ImportResult(
        slug=slug,
        status=result_status,
        product_id=product_public_id,
        warnings=tuple(warnings),
    )
