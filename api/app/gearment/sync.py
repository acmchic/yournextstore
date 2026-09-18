from __future__ import annotations

import hashlib
import html
import json
import re
import shutil
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError

from app.db import Database

DEFAULT_IMPORT_COLOR_CODES = (
    "black",
    "white",
    "navy",
    "red",
    "royal",
    "sport-grey",
)


@dataclass(frozen=True)
class SyncResult:
    product_id: str
    slug: str
    status: str
    colors: int
    sizes: int
    variants: int
    assets: int
    warnings: tuple[str, ...] = ()


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def catalog_display_name(value: str) -> str:
    """Remove provider style/variant numbers from the human-facing name."""
    value = decode_catalog_text(value)
    parts = [part.strip() for part in value.split(" - ") if part.strip()]
    if len(parts) >= 3 and re.search(r"\d", parts[-1]):
        value = " - ".join(parts[1:-1])
    elif len(parts) == 2 and re.fullmatch(r"[A-Za-z]*\d[A-Za-z\d-]*", parts[-1]):
        value = parts[0]
    cleaned = re.sub(r"(?:[\s_-]+\d{3,}[A-Za-z]*)+$", "", value.strip()).strip(" -_")
    return re.sub(r"\s+", " ", cleaned) or value.strip()


def decode_catalog_text(value: str) -> str:
    # Some provider slugs have already lost the &# prefix of &#39;.
    value = urllib.parse.unquote(value)
    for _ in range(3):
        value = html.unescape(value)
    return re.sub(r"(?i)(?:39;|8217;|apos;|rsquo;)", "'", value)


def catalog_identity(source_slug: str, source_name: str) -> tuple[str, str, str | None]:
    source_slug = decode_catalog_text(source_slug)
    source_name = decode_catalog_text(source_name)
    pattern = r"(?:[\s_-]+)([A-Za-z]*\d[A-Za-z\d]*)$"
    name_code = re.search(pattern, source_name.strip())
    slug_code = re.search(pattern, source_slug.strip())
    code = name_code or slug_code
    clean_slug = re.sub(pattern, "", source_slug.strip())
    clean_slug = re.sub(r"['’]s\b", "", clean_slug, flags=re.IGNORECASE)
    slug = slugify(clean_slug)
    if not slug:
        raise ValueError("Catalog slug is empty after normalization")
    return slug, catalog_display_name(source_name), code.group(1).upper() if code else None


def asset_filename(placement: str, index: int, used: dict[str, int]) -> str:
    if placement not in {"front", "back"}:
        return f"{'avatar' if placement == 'avatar' else 'gallery'}-{index + 1}"
    used[placement] = used.get(placement, 0) + 1
    return placement if used[placement] == 1 else f"{placement}-{used[placement]}"


async def relocate_catalog_assets(
    cursor: Any, catalog: dict[str, Any], slug: str, category: str, asset_root: Path
) -> None:
    """Copy before changing DB references; old files remain valid on rollback."""
    await cursor.execute(
        "select id,local_path,placement from catalog_assets where catalog_id=%s order by id",
        (catalog["id"],),
    )
    assets = await cursor.fetchall()
    replacements: dict[str, str] = {}
    for asset in assets:
        old = Path(asset["local_path"])
        parent = Path("mockup") / category / slug
        stem = {"gallery-2": "front", "gallery-3": "back"}.get(old.stem, old.stem)
        new = parent / f"{stem}{old.suffix}"
        if old == new:
            continue
        source = asset_root / old
        target = asset_root / new
        if not source.is_file():
            raise FileNotFoundError(f"Cannot relocate missing catalog asset: {source}")
        # Preserve model templates and auxiliary files alongside imported assets.
        if old.parent != parent and old.parent.as_posix() + "/" not in replacements:
            shutil.copytree(source.parent, target.parent, dirs_exist_ok=True)
            replacements[old.parent.as_posix() + "/"] = parent.as_posix() + "/"
        target.parent.mkdir(parents=True, exist_ok=True)
        if source != target:
            shutil.copy2(source, target)
        placement = {"gallery-2": "front", "gallery-3": "back"}.get(old.stem, asset["placement"])
        await cursor.execute(
            "update catalog_assets set local_path=%s,placement=%s where id=%s",
            (new.as_posix(), placement, asset["id"]),
        )
        # Exact filenames first; then directory prefixes for model/auxiliary files.
        for table, columns in (
            ("mockup_templates", ("base_source",)),
            (
                "catalog_mockup_metadata",
                ("source_path", "garment_mask_path", "displacement_path", "shadow_path", "highlight_path"),
            ),
        ):
            for column in columns:
                await cursor.execute(
                    f"update {table} set {column}=%s where catalog_id=%s and {column}=%s",
                    (new.as_posix(), catalog["id"], old.as_posix()),
                )
    for old, new in replacements.items():
        for table, columns in (
            ("mockup_templates", ("base_source",)),
            (
                "catalog_mockup_metadata",
                ("source_path", "garment_mask_path", "displacement_path", "shadow_path", "highlight_path"),
            ),
        ):
            for column in columns:
                await cursor.execute(
                    f"update {table} set {column}=concat(%s,substring({column},%s)) where catalog_id=%s and left({column},%s)=%s",
                    (new, len(old) + 1, catalog["id"], len(old), old),
                )


def catalog_asset_category(taxonomy: list[dict[str, Any]]) -> str:
    departments = {str(row.get("department", "")).lower() for row in taxonomy}
    if {"men", "women"}.issubset(departments):
        return "unisex"
    if "women" in departments:
        return "women"
    if "kids" in departments:
        return "kids"
    if "accessories" in departments:
        return "accessories"
    if "home-living" in departments:
        return "home-living"
    return "other"


def money_to_minor(value: Any) -> tuple[int | None, str | None]:
    if not isinstance(value, dict):
        return None, None
    currency = value.get("currency_code") or value.get("currencyCode")
    units = int(value.get("units") or 0)
    nanos = int(value.get("nanos") or 0)
    # Gearment currently returns both protobuf nanos (750000000) and decimal
    # cents (75) under the same field, depending on the catalog family.
    if -100 < nanos < 100:
        return units * 100 + nanos, str(currency).upper() if currency else None
    if nanos % 10_000_000:
        raise ValueError(f"Money value has sub-cent precision: {units}/{nanos}")
    return units * 100 + nanos // 10_000_000, str(currency).upper() if currency else None


def _variant_value(row: dict[str, Any], snake: str, camel: str) -> Any:
    return row.get(snake) if snake in row else row.get(camel)


def normalize_variant(row: dict[str, Any]) -> dict[str, Any]:
    price, currency = money_to_minor(_variant_value(row, "price", "price"))
    recommended, recommended_currency = money_to_minor(
        _variant_value(row, "recommended_price", "priceRecommend")
    )
    extra, _ = money_to_minor(_variant_value(row, "extra_price", "extraPrice"))
    net, _ = money_to_minor(_variant_value(row, "net_price", "netPrice"))
    color_option = row.get("option1") if isinstance(row.get("option1"), dict) else {}
    size_option = row.get("option2") if isinstance(row.get("option2"), dict) else {}
    return {
        "id": str(_variant_value(row, "variant_id", "variantId") or ""),
        "legacy_id": _variant_value(row, "legacy_variant_id", "legacyVariantId"),
        "sku": str(_variant_value(row, "variant_sku", "sku") or ""),
        "color": str(_variant_value(row, "color", "color") or color_option.get("name") or ""),
        "color_code": str(
            _variant_value(row, "color_code", "colorCode") or color_option.get("code") or ""
        ),
        "hex": str(
            _variant_value(row, "hex_color_code", "hexColorCode") or color_option.get("value") or ""
        ),
        "size": str(_variant_value(row, "size", "size") or size_option.get("name") or ""),
        "size_code": str(
            _variant_value(row, "size_code", "sizeCode") or size_option.get("code") or ""
        ),
        "price_minor": price,
        "recommended_minor": recommended,
        "extra_minor": extra,
        "net_minor": net,
        "currency": currency or recommended_currency or "USD",
        "stock_label": str(_variant_value(row, "stock_label", "stockStatus") or ""),
        "raw": row,
    }


def _color_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def filter_import_colors(
    variants: list[dict[str, Any]],
    allowed_codes: tuple[str, ...] = DEFAULT_IMPORT_COLOR_CODES,
) -> list[dict[str, Any]]:
    allowed = {_color_key(code) for code in allowed_codes}
    return [
        row
        for row in variants
        if _color_key(row["color_code"]) in allowed or _color_key(row["color"]) in allowed
    ]


def _hex(value: str) -> str | None:
    normalized = value.strip().lstrip("#")
    return f"#{normalized.upper()}" if re.fullmatch(r"[0-9a-fA-F]{6}", normalized) else None


def _size_order(value: str) -> int:
    ranks = {"XXS": 10, "XS": 20, "S": 30, "M": 40, "L": 50, "XL": 60}
    upper = value.upper()
    if upper in ranks:
        return ranks[upper]
    match = re.fullmatch(r"(\d+)X?L", upper)
    return 60 + int(match.group(1)) * 10 if match else 1000


def _asset_extension(content_type: str, url: str) -> str:
    allowed = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}
    if content_type in allowed:
        return allowed[content_type]
    suffix = Path(urllib.parse.urlparse(url).path).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    raise ValueError(f"Unsupported catalog image type: {content_type}")


def asset_placement(
    image_row: dict[str, Any], index: int, design_kits: list[dict[str, Any]]
) -> str:
    tag = str(image_row.get("tag") or image_row.get("type") or "").lower()
    url = str(image_row.get("url") or "").lower()
    if "avatar" in tag or "model" in tag:
        return "avatar"
    for placement in ("front", "back"):
        if placement in tag or placement in url:
            return placement
        kit = next(
            (
                item
                for item in design_kits
                if str(item.get("locationCode", "")).lower() == placement
            ),
            {},
        )
        if (
            str(kit.get("layer1Url") or "").lower() == url
            or str(kit.get("locationModelUrl") or "").lower() == url
        ):
            return placement
    return {0: "avatar", 1: "front", 2: "back"}.get(index, "gallery")


def _local_asset(url: str, target_stem: Path) -> dict[str, Any] | None:
    for extension in (".png", ".jpg", ".webp"):
        target = target_stem.with_suffix(extension)
        if not target.is_file():
            continue
        with Image.open(target) as image:
            width, height = image.size
            detected = Image.MIME.get(image.format or "", "application/octet-stream")
        return {
            "source_url": url,
            "local_path": target.as_posix(),
            "checksum": hashlib.sha256(target.read_bytes()).hexdigest(),
            "mime_type": detected,
            "width": width,
            "height": height,
            "byte_size": target.stat().st_size,
        }
    return None


def download_asset(url: str, target_stem: Path, refresh: bool) -> dict[str, Any]:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https":
        raise ValueError("Catalog assets must use HTTPS")
    if not refresh:
        local = _local_asset(url, target_stem)
        if local:
            return local
        raise FileNotFoundError(
            f"Catalog asset is missing locally: {target_stem}; use --refresh-assets to download it"
        )
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "image/webp,image/png,image/jpeg",
            "User-Agent": "TeeBravo-CatalogSync/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        content_type = response.headers.get_content_type()
        data = response.read(20_000_001)
    if len(data) > 20_000_000:
        raise ValueError("Catalog asset exceeds 20 MB")
    extension = _asset_extension(content_type, url)
    target = target_stem.with_suffix(extension)
    target.parent.mkdir(parents=True, exist_ok=True)
    checksum = hashlib.sha256(data).hexdigest()
    if (
        not refresh
        and target.is_file()
        and hashlib.sha256(target.read_bytes()).hexdigest() == checksum
    ):
        pass
    else:
        temporary = target.with_name(f".{target.name}.{uuid.uuid4().hex}.tmp")
        temporary.write_bytes(data)
        try:
            with Image.open(temporary) as image:
                image.verify()
            temporary.replace(target)
        finally:
            temporary.unlink(missing_ok=True)
    with Image.open(target) as image:
        width, height = image.size
        detected = Image.MIME.get(image.format or "", content_type)
    return {
        "source_url": url,
        "local_path": target.as_posix(),
        "checksum": checksum,
        "mime_type": detected,
        "width": width,
        "height": height,
        "byte_size": len(data),
    }


async def sync_catalog(
    *,
    database: Database,
    api_record: dict[str, Any],
    website: dict[str, Any],
    manifest_entry: dict[str, Any],
    asset_root: Path,
    dry_run: bool,
    refresh_assets: bool,
) -> SyncResult:
    provider_id = str(
        api_record.get("product_id") or api_record.get("productId") or website["product_id"]
    )
    if provider_id != website["product_id"]:
        raise ValueError(
            f"API product {provider_id} does not match website {website['product_id']}"
        )
    source_name = str(
        api_record.get("product_name") or api_record.get("productName") or website["name"]
    )
    slug, name, code = catalog_identity(
        str(manifest_entry.get("slug") or website["page_slug"] or source_name), source_name
    )
    raw_variants = api_record.get("variants") or website["raw"].get("variants") or []
    variants = [normalize_variant(row) for row in raw_variants if isinstance(row, dict)]
    for row in variants:
        row["color_code"] = row["color_code"].strip().upper()
        row["size_code"] = row["size_code"].strip().upper()
        row["color"] = re.sub(r"\s+", " ", row["color"].strip())
        row["size"] = row["size"].strip()
    variants = [row for row in variants if row["id"] and row["color_code"] and row["size_code"]]
    variants = filter_import_colors(variants)
    colors = {row["color_code"]: row for row in variants}
    sizes = {row["size_code"]: row for row in variants}
    image_rows = website.get("images") or []
    design_kits = website.get("artwork_guideline", {}).get("design_kits", [])
    asset_category = catalog_asset_category(manifest_entry.get("taxonomy", []))
    avatar = api_record.get("product_avatar_url") or api_record.get("productAvatarUrl")
    if avatar and not any(item.get("url") == avatar for item in image_rows):
        image_rows = [{"url": avatar, "tag": "avatar"}, *image_rows]
    image_rows = list({str(row["url"]): row for row in image_rows}.values())
    warnings: list[str] = []
    if dry_run:
        return SyncResult(
            provider_id, slug, "dry-run", len(colors), len(sizes), len(variants), len(image_rows)
        )

    async with database.transaction() as cursor:
        await cursor.execute(
            "select id,slug from catalogs where provider='gearment' and provider_product_id=%s",
            (provider_id,),
        )
        existing = await cursor.fetchone()
        await cursor.execute("select id from catalogs where slug=%s", (slug,))
        collision = await cursor.fetchone()
        if collision and (not existing or collision["id"] != existing["id"]):
            raise ValueError(f"Normalized catalog slug already belongs to another catalog: {slug}")
        if existing:
            await relocate_catalog_assets(cursor, existing, slug, asset_category, asset_root)
        await cursor.execute(
            """
            insert into catalogs(provider, provider_product_id, provider_legacy_product_id,
              public_id, slug, name, code, product_type, material, brand, source_page_url,
              source_page_slug, provider_description, provider_material_json,
              provider_size_chart_json, artwork_guideline_json, active)
            values ('gearment',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,true)
            on duplicate key update provider_legacy_product_id=values(provider_legacy_product_id),
              slug=values(slug), code=values(code), name=values(name), source_page_url=values(source_page_url),
              source_page_slug=values(source_page_slug),
              provider_description=values(provider_description),
              provider_material_json=values(provider_material_json),
              provider_size_chart_json=values(provider_size_chart_json),
              artwork_guideline_json=values(artwork_guideline_json), active=true
            """,
            (
                provider_id,
                api_record.get("legacy_product_id"),
                f"cat_{uuid.uuid4().hex[:22]}",
                slug,
                name,
                code,
                str(manifest_entry.get("product_type") or "other"),
                manifest_entry.get("material"),
                manifest_entry.get("brand") or website.get("brand"),
                website["source_url"],
                website["page_slug"],
                None,
                json.dumps(website.get("material_details", {"items": []}), ensure_ascii=False),
                json.dumps(website["size_chart"], ensure_ascii=False),
                json.dumps(website["artwork_guideline"], ensure_ascii=False),
            ),
        )
        await cursor.execute(
            "select id from catalogs where provider='gearment' and provider_product_id=%s",
            (provider_id,),
        )
        catalog = await cursor.fetchone()
        catalog_id = catalog["id"]
        color_ids: dict[str, int] = {}
        for sort_order, (code, row) in enumerate(colors.items()):
            await cursor.execute(
                """
                insert into catalog_colors(catalog_id,provider_color_code,slug,name,hex,sort_order,active)
                values (%s,%s,%s,%s,%s,%s,true)
                on duplicate key update slug=values(slug),name=values(name),hex=values(hex),
                  sort_order=values(sort_order),active=true
                """,
                (catalog_id, code, slugify(code), row["color"], _hex(row["hex"]), sort_order),
            )
            await cursor.execute(
                "select id from catalog_colors where catalog_id=%s and provider_color_code=%s",
                (catalog_id, code),
            )
            color_ids[code] = (await cursor.fetchone())["id"]
        size_ids: dict[str, int] = {}
        for code, row in sizes.items():
            await cursor.execute(
                """
                insert into catalog_sizes(catalog_id,provider_size_code,code,label,sort_order,active)
                values (%s,%s,%s,%s,%s,true)
                on duplicate key update code=values(code),label=values(label),sort_order=values(sort_order),active=true
                """,
                (catalog_id, code, row["size"].upper(), row["size"], _size_order(row["size"])),
            )
            await cursor.execute(
                "select id from catalog_sizes where catalog_id=%s and provider_size_code=%s",
                (catalog_id, code),
            )
            size_ids[code] = (await cursor.fetchone())["id"]
        active_variant_ids = [row["id"] for row in variants]
        variant_params: list[tuple[Any, ...]] = []
        for row in variants:
            retail = row["recommended_minor"] or row["price_minor"] or 0
            base_cost = row["net_minor"] or row["price_minor"] or 0
            in_stock = row["stock_label"] not in {
                "2",
                "4",
                "VENDOR_CATALOG_VARIANT_STOCK_LABEL_OUT_OF_STOCK",
                "VENDOR_CATALOG_VARIANT_STOCK_LABEL_DISCONTINUED",
            }
            variant_params.append(
                (
                    f"gcv_{row['id']}",
                    catalog_id,
                    row["id"],
                    row["legacy_id"],
                    row["sku"],
                    color_ids[row["color_code"]],
                    size_ids[row["size_code"]],
                    row["sku"] or row["id"],
                    base_cost,
                    row["price_minor"],
                    row["recommended_minor"],
                    row["extra_minor"],
                    row["net_minor"],
                    retail,
                    row["currency"],
                    1 if in_stock else 0,
                    row["stock_label"],
                )
            )
        if variant_params:
            await cursor.executemany(
                """
                insert into catalog_variants(public_id,catalog_id,provider_variant_id,
                  provider_legacy_variant_id,provider_sku,color_id,size_id,sku,base_cost_minor,
                  provider_price_minor,recommended_price_minor,extra_price_minor,net_price_minor,
                  default_price_minor,currency,stock_policy,stock_quantity,provider_stock_label,
                  active)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'finite',%s,%s,
                  true)
                on duplicate key update provider_sku=values(provider_sku), color_id=values(color_id),
                  size_id=values(size_id), sku=values(sku), base_cost_minor=values(base_cost_minor),
                  provider_price_minor=values(provider_price_minor),
                  recommended_price_minor=values(recommended_price_minor),extra_price_minor=values(extra_price_minor),
                  net_price_minor=values(net_price_minor),currency=values(currency),
                  stock_quantity=values(stock_quantity),provider_stock_label=values(provider_stock_label),
                  active=true
                """,
                variant_params,
            )
        placeholders = ",".join(["%s"] * len(active_variant_ids))
        if active_variant_ids:
            await cursor.execute(
                f"update catalog_variants set active=false where catalog_id=%s and provider_variant_id not in ({placeholders})",
                (catalog_id, *active_variant_ids),
            )
        else:
            await cursor.execute(
                "update catalog_variants set active=false where catalog_id=%s", (catalog_id,)
            )
        color_placeholders = ",".join(["%s"] * len(colors))
        if colors:
            await cursor.execute(
                f"update catalog_colors set active=false where catalog_id=%s and provider_color_code not in ({color_placeholders})",
                (catalog_id, *colors.keys()),
            )
        size_placeholders = ",".join(["%s"] * len(sizes))
        if sizes:
            await cursor.execute(
                f"update catalog_sizes set active=false where catalog_id=%s and provider_size_code not in ({size_placeholders})",
                (catalog_id, *sizes.keys()),
            )
        for location in (
            api_record.get("print_locations") or website["raw"].get("printLocations") or []
        ):
            await cursor.execute(
                """
                insert into catalog_print_locations(catalog_id,provider_location_id,code,name,active)
                values (%s,%s,%s,%s,true)
                on duplicate key update provider_location_id=values(provider_location_id),name=values(name),active=true
                """,
                (
                    catalog_id,
                    location.get("location_id") or location.get("locationId"),
                    location.get("code"),
                    location.get("name"),
                ),
            )
        for taxonomy in manifest_entry.get("taxonomy", []):
            await cursor.execute(
                """
                insert into catalog_taxonomy(catalog_id,department,type_slug,type_label,source_url,sort_order)
                values (%s,%s,%s,%s,%s,%s)
                on duplicate key update type_label=values(type_label),source_url=values(source_url),sort_order=values(sort_order)
                """,
                (
                    catalog_id,
                    taxonomy["department"],
                    taxonomy["type_slug"],
                    taxonomy.get("type_label") or taxonomy["type_slug"].replace("-", " ").title(),
                    taxonomy.get("source_url"),
                    int(taxonomy.get("sort_order", 0)),
                ),
            )

    asset_count = 0
    used_placements: dict[str, int] = {}
    for index, image_row in enumerate(image_rows):
        try:
            placement = asset_placement(image_row, index, design_kits)
            kind = "avatar" if placement == "avatar" else "gallery"
            target_stem = (
                asset_root
                / "mockup"
                / asset_category
                / slug
                / asset_filename(placement, index, used_placements)
            )
            if not refresh_assets and not _local_asset(str(image_row["url"]), target_stem):
                previous = await database.fetch_one(
                    "select local_path from catalog_assets where catalog_id=%s and source_hash=%s order by id limit 1",
                    (catalog_id, hashlib.sha256(str(image_row["url"]).encode()).hexdigest()),
                )
                if previous:
                    source = asset_root / previous["local_path"]
                    if source.is_file():
                        target_stem.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(source, target_stem.with_suffix(source.suffix))
            asset = download_asset(str(image_row["url"]), target_stem, refresh_assets)
            relative_path = Path(asset["local_path"]).relative_to(asset_root).as_posix()
            await database.execute(
                """
                insert into catalog_assets(catalog_id,kind,placement,source_url,source_hash,local_path,checksum,mime_type,width,height,byte_size,status)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'active')
                on duplicate key update local_path=values(local_path),checksum=values(checksum),
                  placement=values(placement),
                  mime_type=values(mime_type),width=values(width),height=values(height),
                  byte_size=values(byte_size),status='active'
                """,
                (
                    catalog_id,
                    kind,
                    placement,
                    asset["source_url"],
                    hashlib.sha256(asset["source_url"].encode()).hexdigest(),
                    relative_path,
                    asset["checksum"],
                    asset["mime_type"],
                    asset["width"],
                    asset["height"],
                    asset["byte_size"],
                ),
            )
            asset_count += 1
        except (OSError, ValueError, urllib.error.URLError, UnidentifiedImageError) as error:
            warnings.append(f"asset {image_row.get('url')}: {error}")
    return SyncResult(
        provider_id,
        slug,
        "synced",
        len(colors),
        len(sizes),
        len(variants),
        asset_count,
        tuple(warnings),
    )
