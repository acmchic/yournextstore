from __future__ import annotations

import hashlib
import json
import re
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError

from app.db import Database


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


def download_asset(url: str, target_stem: Path, refresh: bool) -> dict[str, Any]:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https":
        raise ValueError("Catalog assets must use HTTPS")
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "image/webp,image/png,image/jpeg",
            "User-Agent": "YourNextStore-CatalogSync/1.0",
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
    name = str(api_record.get("product_name") or api_record.get("productName") or website["name"])
    slug = str(manifest_entry.get("slug") or slugify(website["page_slug"] or name))
    raw_variants = api_record.get("variants") or website["raw"].get("variants") or []
    variants = [normalize_variant(row) for row in raw_variants if isinstance(row, dict)]
    variants = [row for row in variants if row["id"] and row["color_code"] and row["size_code"]]
    colors = {row["color_code"]: row for row in variants}
    sizes = {row["size_code"]: row for row in variants}
    image_rows = website.get("images") or []
    avatar = api_record.get("product_avatar_url") or api_record.get("productAvatarUrl")
    if avatar and not any(item.get("url") == avatar for item in image_rows):
        image_rows = [{"url": avatar, "tag": "avatar"}, *image_rows]
    warnings: list[str] = []
    if dry_run:
        return SyncResult(
            provider_id, slug, "dry-run", len(colors), len(sizes), len(variants), len(image_rows)
        )

    async with database.transaction() as cursor:
        await cursor.execute(
            """
            insert into catalogs(provider, provider_product_id, provider_legacy_product_id,
              public_id, slug, name, product_type, material, brand, source_page_url,
              source_page_slug, provider_description, provider_size_chart_json,
              shipping_guideline_json, artwork_guideline_json, provider_payload_json,
              website_payload_json, provider_synced_at, website_synced_at, active)
            values ('gearment',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
              current_timestamp(6),current_timestamp(6),true)
            on duplicate key update provider_legacy_product_id=values(provider_legacy_product_id),
              name=values(name), source_page_url=values(source_page_url),
              source_page_slug=values(source_page_slug),
              provider_description=values(provider_description),
              provider_size_chart_json=values(provider_size_chart_json),
              shipping_guideline_json=values(shipping_guideline_json),
              artwork_guideline_json=values(artwork_guideline_json),
              provider_payload_json=values(provider_payload_json),
              website_payload_json=values(website_payload_json),
              provider_synced_at=current_timestamp(6), website_synced_at=current_timestamp(6), active=true
            """,
            (
                provider_id,
                api_record.get("legacy_product_id"),
                f"cat_{uuid.uuid4().hex[:22]}",
                slug,
                name,
                str(manifest_entry.get("product_type") or "other"),
                manifest_entry.get("material"),
                manifest_entry.get("brand") or website.get("brand"),
                website["source_url"],
                website["page_slug"],
                website["description"],
                json.dumps(website["size_chart"], ensure_ascii=False),
                json.dumps(website["shipping_guideline"], ensure_ascii=False),
                json.dumps(website["artwork_guideline"], ensure_ascii=False),
                json.dumps(api_record, ensure_ascii=False),
                json.dumps(website["raw"], ensure_ascii=False),
            ),
        )
        await cursor.execute(
            "select id from catalogs where provider='gearment' and provider_product_id=%s",
            (provider_id,),
        )
        catalog = await cursor.fetchone()
        catalog_id = catalog["id"]
        color_ids: dict[str, int] = {}
        for code, row in colors.items():
            await cursor.execute(
                """
                insert into catalog_colors(catalog_id,provider_color_code,slug,name,hex,active)
                values (%s,%s,%s,%s,%s,true)
                on duplicate key update slug=values(slug),name=values(name),hex=values(hex),active=true
                """,
                (catalog_id, code, slugify(code), row["color"], _hex(row["hex"])),
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
        active_variant_ids: list[str] = []
        for row in variants:
            active_variant_ids.append(row["id"])
            retail = row["recommended_minor"] or row["price_minor"] or 0
            base_cost = row["net_minor"] or row["price_minor"] or 0
            in_stock = row["stock_label"] not in {
                "2",
                "4",
                "VENDOR_CATALOG_VARIANT_STOCK_LABEL_OUT_OF_STOCK",
                "VENDOR_CATALOG_VARIANT_STOCK_LABEL_DISCONTINUED",
            }
            await cursor.execute(
                """
                insert into catalog_variants(public_id,catalog_id,provider_variant_id,
                  provider_legacy_variant_id,provider_sku,color_id,size_id,sku,base_cost_minor,
                  provider_price_minor,recommended_price_minor,extra_price_minor,net_price_minor,
                  default_price_minor,currency,stock_policy,stock_quantity,provider_stock_label,
                  provider_payload_json,provider_synced_at,active)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'finite',%s,%s,%s,
                  current_timestamp(6),true)
                on duplicate key update provider_sku=values(provider_sku), color_id=values(color_id),
                  size_id=values(size_id), sku=values(sku), base_cost_minor=values(base_cost_minor),
                  provider_price_minor=values(provider_price_minor),
                  recommended_price_minor=values(recommended_price_minor),
                  extra_price_minor=values(extra_price_minor),net_price_minor=values(net_price_minor),
                  currency=values(currency),stock_quantity=values(stock_quantity),
                  provider_stock_label=values(provider_stock_label),
                  provider_payload_json=values(provider_payload_json),
                  provider_synced_at=current_timestamp(6),active=true
                """,
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
                    json.dumps(row["raw"], ensure_ascii=False),
                ),
            )
        placeholders = ",".join(["%s"] * len(active_variant_ids))
        if active_variant_ids:
            await cursor.execute(
                f"update catalog_variants set active=false where catalog_id=%s and provider_variant_id not in ({placeholders})",
                (catalog_id, *active_variant_ids),
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
    for index, image_row in enumerate(image_rows):
        try:
            kind = "avatar" if image_row.get("tag") == "avatar" or index == 0 else "gallery"
            asset = download_asset(
                str(image_row["url"]),
                asset_root / "mockup" / slug / f"{kind}-{index + 1}",
                refresh_assets,
            )
            relative_path = Path(asset["local_path"]).relative_to(asset_root).as_posix()
            await database.execute(
                """
                insert into catalog_assets(catalog_id,kind,source_url,source_hash,local_path,checksum,mime_type,width,height,byte_size,status)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'active')
                on duplicate key update local_path=values(local_path),checksum=values(checksum),
                  mime_type=values(mime_type),width=values(width),height=values(height),
                  byte_size=values(byte_size),status='active'
                """,
                (
                    catalog_id,
                    kind,
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
