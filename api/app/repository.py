from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from app.catalog import resolve_design_path
from app.catalog_assignment import stable_variant_id
from app.db import Database
from app.models import PrintArea, ProductSummary, RenderJob
from app.product_media import (
    build_blank_media_url,
    build_catalog_blank_url,
    build_catalog_mockup_url,
    build_media_url,
)
from app.settings import settings
from app.shipping import render_policy


def _decode_json(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _public_catalog_taxonomy(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Expose shared men/women bodies as unisex and keep women-only bodies separate."""
    departments_by_type = {
        type_slug: {row["department"] for row in rows if row["type_slug"] == type_slug}
        for type_slug in {row["type_slug"] for row in rows}
    }
    normalized = [
        {
            **row,
            "department": "unisex" if row["department"] == "men" else row["department"],
        }
        for row in rows
        if not (row["department"] == "women" and "men" in departments_by_type[row["type_slug"]])
    ]
    return list({(row["department"], row["type_slug"]): row for row in normalized}.values())


def _rotate_listing_color(product: dict[str, Any], position: int) -> dict[str, Any]:
    """Pick a stable, varied in-stock color for a product card in a listing."""
    colors = list(
        {
            variant["color"]: variant["color_name"]
            for variant in product.get("variants", [])
            if variant.get("stock") != 0 and variant.get("color")
        }.items()
    )
    if not colors:
        return product
    color_slug, color_name = colors[position % len(colors)]
    return {**product, "default_color": color_slug, "default_color_name": color_name}


def _listing_catalog_at(catalogs: list[dict[str, Any]], position: int) -> str:
    """Cycle through any eligible catalog without coupling collections to catalog names."""
    return catalogs[position % len(catalogs)]["slug"]


def _guideline_percent(value: Any, default: float) -> float:
    """Accept provider guidelines expressed as either 0..1 ratios or percentages."""
    if value is None:
        return default
    parsed = float(value)
    return parsed * 100 if 0 < parsed <= 1 else parsed


class CatalogRepository:
    def __init__(self, database: Database) -> None:
        self._database = database

    async def list_legal_pages(self) -> list[dict[str, Any]]:
        pages = await self._database.fetch_all(
            "select slug, title, content, updated_at from legal_pages where published=true order by title",
            (),
        )
        config = await self._database.fetch_one("select * from checkout_settings where id=1", ())
        return [
            {
                **page,
                "content": render_policy(page["content"], config),
                "updated_at": max(page["updated_at"], config["updated_at"]),
            }
            for page in pages
        ]

    async def get_blank_catalog_asset(
        self, catalog_slug: str, color_slug: str, placement: str
    ) -> dict[str, Any] | None:
        return await self._database.fetch_one(
            """select asset.local_path, asset.width, asset.height,
                      coalesce(color.hex, selected_color.hex) garment_color
               from catalog_assets asset join catalogs catalog on catalog.id=asset.catalog_id
               left join catalog_colors color on color.id=asset.color_id
               left join catalog_colors selected_color on selected_color.catalog_id=catalog.id
                 and selected_color.slug=%s and selected_color.active=true
               where catalog.slug=%s and catalog.active=true and asset.status='active'
                 and (
                   asset.placement=%s
                   -- Databases imported before migration 005 still label gallery-3 as gallery.
                   or (%s='back' and asset.placement='gallery' and lower(asset.local_path) like '%%/gallery-3.%%')
                 )
                 and (color.slug=%s or color.slug is null)
               order by (color.slug is null), asset.id limit 1""",
            (color_slug, catalog_slug, placement, placement, color_slug),
        )

    async def get_product_by_slug(self, slug: str) -> ProductSummary | None:
        row = await self._database.fetch_one(
            """
            select id, slug, name, description, default_artwork_id, default_template_id
            from pod_products
            where slug = %s
            limit 1
            """,
            (slug,),
        )
        return ProductSummary.model_validate(row) if row else None

    async def browse_products(
        self,
        *,
        limit: int,
        offset: int,
        catalog: str | None = None,
        collection: str | None = None,
        query: str | None = None,
    ) -> dict[str, Any]:
        filters = ["p.status = 'active'"]
        params: list[Any] = []
        joins = ["join designs d on d.id=p.design_id"]
        if catalog:
            filters.append(
                """(
                  exists(
                    select 1 from product_catalogs pc_filter
                    join catalogs ca_filter on ca_filter.id=pc_filter.catalog_id and ca_filter.active=true
                    where pc_filter.product_id=p.id and pc_filter.active=true and ca_filter.slug=%s
                  )
                  or not exists(
                    select 1 from product_catalogs pc_any
                    where pc_any.product_id=p.id and pc_any.active=true
                  )
                )"""
            )
            params.append(catalog)
        if collection:
            joins.append("join collection_products cp_filter on cp_filter.product_id=p.id")
            joins.append("join collections co_filter on co_filter.id=cp_filter.collection_id")
            filters.append("co_filter.slug=%s and co_filter.status='active'")
            params.append(collection)
        if query:
            filters.append("(p.title like %s or p.description like %s)")
            value = f"%{query}%"
            params.extend((value, value))
        from_where = f"from products p {' '.join(joins)} where {' and '.join(filters)}"
        count_row = await self._database.fetch_one(
            f"select count(distinct p.id) count {from_where}", tuple(params)
        )
        rows = await self._database.fetch_all(
            f"""
            select distinct p.id, p.public_id, p.slug, p.title, p.description,
              p.seo_title, p.seo_description, p.brand, p.published_at, p.updated_at,
              d.slug design_slug,
              (select min(cv_price.default_price_minor) from product_variants pv_price
               join catalog_variants cv_price on cv_price.id=pv_price.catalog_variant_id
               where pv_price.product_id=p.id and pv_price.active=true and cv_price.active=true) price_minor,
              (select cv_currency.currency from product_variants pv_currency
               join catalog_variants cv_currency on cv_currency.id=pv_currency.catalog_variant_id
               where pv_currency.product_id=p.id and pv_currency.active=true and cv_currency.active=true
               order by cv_currency.default_price_minor limit 1) currency
            {from_where}
            order by p.published_at desc, p.id desc limit %s offset %s
            """,
            (*params, limit, offset),
        )
        data = []
        for row in rows:
            detail = await self.get_product_detail(row["slug"], catalog_slug=catalog)
            if detail:
                data.append(detail)
        return {
            "data": data,
            "meta": {
                "count": int(count_row["count"] if count_row else 0),
                "limit": limit,
                "offset": offset,
            },
        }

    async def browse_shop(
        self,
        *,
        limit: int,
        offset: int,
        department: str | None = None,
        product_type: str | None = None,
        catalog_slug: str | None = None,
        collection: str | None = None,
    ) -> dict[str, Any]:
        catalogs = await self.list_catalogs()
        rule = None
        if collection:
            rule = await self._database.fetch_one(
                "select id, selection_rule from collections where slug=%s and status='active'",
                (collection,),
            )
            if not rule:
                return {"data": [], "meta": {"count": 0, "limit": limit, "offset": offset}}
        eligible = [
            c
            for c in catalogs
            if (not catalog_slug or c["slug"] == catalog_slug)
            if any(
                (not department or t["department"] == department)
                and (not product_type or t["type_slug"] == product_type)
                and (not rule or rule["selection_rule"] != "tees" or t["type_slug"] == "t-shirts")
                and (
                    not rule
                    or rule["selection_rule"] == "manual"
                    or t["department"] in ("unisex", "women", "kids")
                )
                for t in c["taxonomy"]
            )
        ]
        if not eligible:
            return {"data": [], "meta": {"count": 0, "limit": limit, "offset": offset}}

        if rule and rule["selection_rule"] != "manual":
            count = await self._database.fetch_one(
                "select count(*) count from products where status='active'", ()
            )
            rows = await self._database.fetch_all(
                "select slug from products where status='active' order by published_at desc, id desc limit %s offset %s",
                (limit, offset),
            )
            data = []
            for index, row in enumerate(rows):
                position = offset + index
                product = await self.get_product_detail(
                    row["slug"], catalog_slug=_listing_catalog_at(eligible, position)
                )
                if product:
                    data.append(_rotate_listing_color(product, position))
            return {
                "data": data,
                "meta": {"count": int(count["count"]), "limit": limit, "offset": offset},
            }

        placeholders = ",".join(["%s"] * len(eligible))
        params = tuple(c["slug"] for c in eligible)
        where = (
            "from products p "
            "cross join catalogs c "
            f"where p.status='active' and c.slug in ({placeholders}) "
            "and ("
            "exists("
            "select 1 from product_catalogs pc_selected "
            "where pc_selected.product_id=p.id "
            "and pc_selected.catalog_id=c.id "
            "and pc_selected.active=true"
            ") "
            "or not exists("
            "select 1 from product_catalogs pc_any "
            "where pc_any.product_id=p.id and pc_any.active=true"
            ")"
            ")"
        )
        if rule and rule["selection_rule"] == "manual":
            where += " and exists(select 1 from collection_products cp where cp.product_id=p.id and cp.collection_id=%s)"
            params += (rule["id"],)
        count = await self._database.fetch_one(f"select count(*) count {where}", params)
        rows = await self._database.fetch_all(
            f"select p.slug, c.slug catalog {where} order by p.published_at desc, p.id desc, c.sort_order, c.id limit %s offset %s",
            (*params, limit, offset),
        )
        data = []
        for index, row in enumerate(rows):
            product = await self.get_product_detail(row["slug"], catalog_slug=row["catalog"])
            if product:
                data.append(_rotate_listing_color(product, offset + index))
        return {
            "data": data,
            "meta": {"count": int(count["count"]), "limit": limit, "offset": offset},
        }

    async def get_product_detail(
        self, slug: str, catalog_slug: str | None = None
    ) -> dict[str, Any] | None:
        product = await self._database.fetch_one(
            """
            select p.id, p.public_id, p.slug, p.title, p.description, p.status, p.brand,
              'new' product_condition, p.seo_title, p.seo_description, p.created_at, p.updated_at,
              d.slug design_slug, d.alt_text, d.checksum design_checksum
            from products p join designs d on d.id=p.design_id
            where p.slug=%s and p.status='active' limit 1
            """,
            (slug,),
        )
        if not product:
            return None
        assignment_sql = """
            select ca.slug catalog, cc.slug default_color, cc.name default_color_name
            from product_catalogs pc
            join catalogs ca on ca.id=pc.catalog_id and ca.active=true
            left join catalog_colors cc on cc.id=pc.default_color_id and cc.active=true
            where pc.product_id=%s and pc.active=true
        """
        assignment_params: tuple[Any, ...] = (product["id"],)
        if catalog_slug:
            assignment_sql += " and (ca.slug=%s or ca.source_page_slug=%s)"
            assignment_params += (catalog_slug, catalog_slug)
        assignment_sql += " order by ca.sort_order, ca.id limit 1"
        assignment = await self._database.fetch_one(assignment_sql, assignment_params)
        if catalog_slug:
            variants = await self._database.fetch_all(
                """
                select cv.public_id catalog_variant_public_id, cv.sku,
                  cv.default_price_minor price_minor, null compare_at_minor, cv.currency,
                  ca.slug catalog, ca.name catalog_name, ca.provider, cc.slug color,
                  cc.name color_name, cc.hex color_hex, cs.code size, cs.label size_label,
                  if(cv.stock_policy='continue', 9999, cv.stock_quantity) stock
                from catalog_variants cv
                join catalogs ca on ca.id=cv.catalog_id and ca.active=true
                join catalog_colors cc on cc.id=cv.color_id and cc.active=true
                join catalog_sizes cs on cs.id=cv.size_id and cs.active=true
                where (ca.slug=%s or ca.source_page_slug=%s) and cv.active=true
                order by cc.sort_order, cs.sort_order
                """,
                (catalog_slug, catalog_slug),
            )
            variants = [
                {
                    **variant,
                    "id": stable_variant_id(
                        product["public_id"], variant.pop("catalog_variant_public_id")
                    ),
                    "sku": f"{product['slug']}-{variant['catalog']}-{variant['color']}-{variant['size']}".upper(),
                }
                for variant in variants
            ]
        else:
            variants = await self._database.fetch_all(
                """
            select pv.public_id id, pv.sku, cv.default_price_minor price_minor, pv.compare_at_minor, cv.currency,
              ca.slug catalog, ca.name catalog_name, ca.provider, cc.slug color,
              cc.name color_name, cc.hex color_hex,
              cs.code size, cs.label size_label,
              if(cv.stock_policy='continue', 9999, cv.stock_quantity) stock
            from product_variants pv
            join catalog_variants cv on cv.id=pv.catalog_variant_id
            join catalogs ca on ca.id=cv.catalog_id
            join catalog_colors cc on cc.id=cv.color_id
            join catalog_sizes cs on cs.id=cv.size_id
            where pv.product_id=%s and pv.active=true and cv.active=true
            order by ca.sort_order, cc.sort_order, cs.sort_order
            """,
                (product["id"],),
            )
        if catalog_slug and not variants:
            return None
        fallback_variant = variants[0] if variants else None
        default_catalog = (
            assignment["catalog"]
            if assignment
            else (fallback_variant["catalog"] if fallback_variant else catalog_slug)
        )
        default_color = (
            assignment["default_color"]
            if assignment and assignment["default_color"]
            else (fallback_variant["color"] if fallback_variant else None)
        )
        default_color_name = (
            assignment["default_color_name"]
            if assignment and assignment["default_color_name"]
            else (fallback_variant["color_name"] if fallback_variant else None)
        )
        templates = (
            await self._database.fetch_all(
                """
            select ca.slug catalog, cc.slug color, mt.style, mt.placement
            from catalogs ca
            join mockup_templates mt on mt.catalog_id=ca.id and mt.active=true
            join catalog_colors cc on cc.id=mt.color_id
            where ca.active=true and (ca.slug=%s or ca.source_page_slug=%s)
            order by ca.sort_order, cc.sort_order, field(mt.style,'flat','women','men'),
              field(mt.placement,'front','left-chest','back')
            """,
                (catalog_slug, catalog_slug),
            )
            if catalog_slug
            else await self._database.fetch_all(
                """
            select ca.slug catalog, cc.slug color, mt.style, mt.placement
            from product_catalogs pc
            join catalogs ca on ca.id=pc.catalog_id and ca.active=true
            join mockup_templates mt on mt.catalog_id=ca.id and mt.active=true
            join catalog_colors cc on cc.id=mt.color_id
            where pc.product_id=%s and pc.active=true
            order by ca.sort_order, cc.sort_order, field(mt.style,'flat','women','men'),
              field(mt.placement,'front','left-chest','back')
            """,
                (product["id"],),
            )
        )
        media = [
            {
                **template,
                "width": 1500,
                "url": build_media_url(
                    design_slug=product["design_slug"],
                    catalog_slug=template["catalog"],
                    color_slug=template["color"],
                    style=template["style"],
                    placement=template["placement"],
                ),
                "blank_url": build_blank_media_url(
                    catalog_slug=template["catalog"],
                    color_slug=template["color"],
                    style=template["style"],
                    placement=template["placement"],
                ),
            }
            for template in templates
        ]
        dynamic_media_keys = {
            (variant["catalog"], variant["color"], variant["color_name"])
            for variant in variants
            if variant["provider"] == "gearment"
        }
        catalog_ids = {catalog for catalog, _color, _name in dynamic_media_keys}
        # Keep supporting catalogs imported before migration 005 normalized gallery-3 to back.
        back_catalogs = (
            {
                row["catalog"]
                for row in await self._database.fetch_all(
                    f"""select c.slug catalog
                from catalogs c join catalog_assets asset on asset.catalog_id=c.id
                where c.slug in ({",".join(["%s"] * len(catalog_ids))})
                  and asset.status='active'
                  and (
                    asset.placement in ('back','unknown')
                    or (asset.placement='gallery' and lower(asset.local_path) like '%%/gallery-3.%%')
                  )
                """,
                    tuple(catalog_ids),
                )
            }
            if catalog_ids
            else set()
        )
        media.extend(
            {
                "catalog": catalog,
                "color": color,
                "style": "flat",
                "placement": placement,
                "width": 1500,
                "url": build_catalog_mockup_url(
                    product_ref=product["slug"],
                    catalog_slug=catalog,
                    color_slug=color,
                ),
                "blank_url": build_catalog_blank_url(
                    product_ref=product["slug"],
                    catalog_slug=catalog,
                    color_slug=color,
                    placement=placement,
                ),
            }
            for catalog, color, _color_name in sorted(dynamic_media_keys)
            for placement in (
                ("front", "chest", "back") if catalog in back_catalogs else ("front", "chest")
            )
        )
        media.extend(
            {
                "catalog": catalog,
                "color": color,
                "style": "flat",
                "placement": placement,
                "width": 1500,
                "url": build_catalog_blank_url(
                    product_ref=product["slug"],
                    catalog_slug=catalog,
                    color_slug=color,
                    placement=placement,
                ),
                "blank_url": "",
            }
            for catalog, color, _color_name in sorted(dynamic_media_keys)
            for placement in (
                ("front", "chest", "back") if catalog in back_catalogs else ("front", "chest")
            )
        )
        for variant in variants:
            if variant.pop("provider") == "gearment":
                variant["images"] = [
                    build_catalog_mockup_url(
                        product_ref=product["slug"],
                        catalog_slug=variant["catalog"],
                        color_slug=variant["color"],
                        placement=_placement,
                    )
                    for _placement in (
                        ("front", "back") if variant["catalog"] in back_catalogs else ("front",)
                    )
                ]
        return {
            "id": product["public_id"],
            "slug": product["slug"],
            "title": product["title"],
            "description": product["description"],
            "brand": product["brand"],
            "condition": product["product_condition"],
            "created_at": product["created_at"],
            "updated_at": product["updated_at"],
            "seo": {
                "title": product["seo_title"] or product["title"],
                "description": product["seo_description"] or product["description"],
                "canonical": (
                    f"/product/{product['slug']}/{catalog_slug}"
                    if catalog_slug
                    else f"/product/{product['slug']}"
                ),
            },
            "design": {
                "slug": product["design_slug"],
                "alt_text": product["alt_text"] or product["title"],
                "checksum": product["design_checksum"],
            },
            "default_catalog": default_catalog,
            "default_color": default_color,
            "default_color_name": default_color_name,
            "variants": variants,
            "media": media,
        }

    async def get_catalog_render_job(
        self,
        *,
        product_slug: str,
        catalog_slug: str,
        color: str,
        size: str | None,
        placement: str,
    ) -> RenderJob | None:
        variant = await self._database.fetch_one(
            """
            select p.public_id product_id, p.slug product_slug, d.public_id artwork_id,
              d.slug artwork_slug, d.checksum artwork_checksum,
              cv.public_id catalog_variant_public_id, ca.id catalog_id,
              ca.artwork_guideline_json, ca.product_type,
              cc.id color_id, cc.slug color_slug, cc.hex garment_color
            from products p
            join designs d on d.id=p.design_id and d.status='active'
            join catalogs ca on ca.active=true
            join catalog_variants cv on cv.catalog_id=ca.id and cv.active=true
            join catalog_colors cc on cc.id=cv.color_id and cc.active=true
            join catalog_sizes cs on cs.id=cv.size_id and cs.active=true
            where p.slug=%s and p.status='active' and (ca.slug=%s or ca.source_page_slug=%s)
              and (lower(cc.slug)=lower(%s) or lower(cc.name)=lower(%s))
              and (%s is null or lower(cs.code)=lower(%s) or lower(cs.label)=lower(%s))
            order by cs.sort_order limit 1
            """,
            (product_slug, catalog_slug, catalog_slug, color, color, size, size, size),
        )
        if not variant or not variant["garment_color"]:
            return None
        variant["variant_id"] = stable_variant_id(
            variant["product_id"], variant["catalog_variant_public_id"]
        )

        guideline = variant["artwork_guideline_json"] or {}
        if isinstance(guideline, str):
            guideline = json.loads(guideline)
        resolved_placement = (
            "back" if placement == "back" else ("chest" if placement == "chest" else "front")
        )
        asset_placement = "back" if resolved_placement == "back" else "front"
        design_kit = next(
            (
                item
                for item in guideline.get("design_kits", [])
                if str(item.get("locationCode", "")).lower() == resolved_placement
            ),
            None,
        )
        if not design_kit:
            default_area = (
                {
                    "designAreaX": 30,
                    "designAreaY": 16,
                    "designAreaWidth": 40,
                    "designAreaHeight": 28,
                }
                if str(variant.get("product_type") or "").lower()
                in {"hoodie", "hoodies", "sweatshirt"}
                else {
                    "designAreaX": 30,
                    "designAreaY": 25,
                    "designAreaWidth": 40,
                    "designAreaHeight": 40,
                }
            )
        else:
            default_area = {
                "designAreaX": 30,
                "designAreaY": 25,
                "designAreaWidth": 40,
                "designAreaHeight": 40,
            }
        if not design_kit:
            design_kit = {
                **default_area,
            }
        metadata = await self._database.fetch_one(
            "select print_area_json, asset_id, status from catalog_mockup_metadata where catalog_id=%s and placement=%s limit 1",
            (variant["catalog_id"], asset_placement),
        )
        asset = await self._database.fetch_one(
            """
            select local_path, checksum, width, height from catalog_assets
            where id=%s and catalog_id=%s and status='active' limit 1
            """,
            (metadata["asset_id"], variant["catalog_id"])
            if metadata and metadata.get("asset_id")
            else (0, variant["catalog_id"]),
        )
        if not asset:
            asset = await self._database.fetch_one(
                """
                select local_path, checksum, width, height from catalog_assets
                where catalog_id=%s and placement in (%s, 'unknown', 'gallery') and status='active'
                order by case when placement=%s then 0 when placement='unknown' then 1 else 2 end, id limit 1
                """,
                (variant["catalog_id"], asset_placement, asset_placement),
            )
        if not asset and asset_placement == "back":
            asset = await self._database.fetch_one(
                """
                select local_path, checksum, width, height from catalog_assets
                where catalog_id=%s and placement in ('gallery','unknown') and status='active'
                order by case when local_path like '%gallery-3%' then 0 else 1 end, id limit 1
                """,
                (variant["catalog_id"],),
            )
        if not asset or not asset["width"] or not asset["height"]:
            return None
        if resolved_placement == "chest":
            design_kit = {
                "designAreaX": 18,
                "designAreaY": 25,
                "designAreaWidth": 18,
                "designAreaHeight": 18,
            }
        elif metadata and metadata["status"] == "ready":
            analyzed_area = metadata["print_area_json"]
            if isinstance(analyzed_area, str):
                analyzed_area = json.loads(analyzed_area)
            design_kit = {
                "designAreaX": float(analyzed_area.get("x", 0.30)) * 100,
                "designAreaY": float(analyzed_area.get("y", 0.25)) * 100,
                "designAreaWidth": float(analyzed_area.get("width", 0.40)) * 100,
                "designAreaHeight": float(analyzed_area.get("height", 0.40)) * 100,
            }
        left = _guideline_percent(design_kit.get("designAreaX"), 30) * int(asset["width"]) / 100
        top = _guideline_percent(design_kit.get("designAreaY"), 25) * int(asset["height"]) / 100
        width = (
            _guideline_percent(design_kit.get("designAreaWidth"), 40) * int(asset["width"]) / 100
        )
        height = (
            _guideline_percent(design_kit.get("designAreaHeight"), 40) * int(asset["height"]) / 100
        )
        if (
            width < asset["width"] * 0.05
            or height < asset["height"] * 0.05
            or left < 0
            or top < 0
            or left + width > asset["width"]
            or top + height > asset["height"]
        ):
            left = asset["width"] * 0.30
            top = asset["height"] * 0.25
            width = asset["width"] * 0.40
            height = asset["height"] * 0.40
        return RenderJob(
            product_id=variant["product_id"],
            artwork_id=variant["artwork_id"],
            template_id=f"{catalog_slug}-{resolved_placement}",
            variant_id=variant["variant_id"],
            base_source=asset["local_path"],
            artwork_source=f"design/{resolve_design_path(variant['artwork_slug'], settings)}",
            garment_color=variant["garment_color"],
            print_area=PrintArea(
                dst_quad=[
                    (left, top),
                    (left + width, top),
                    (left + width, top + height),
                    (left, top + height),
                ],
                displacement_strength=0,
                shadow_opacity=0,
                highlight_opacity=0,
                surface_mode="none",
            ),
            # Bump this when catalog artwork resolution/fallback logic changes;
            # old blank renders must never survive in the immutable image cache.
            version=f"gearment-v8-catalog:{variant['artwork_checksum']}:{asset['checksum']}:{variant['garment_color']}",
            metadata={
                "catalog": catalog_slug,
                "placement": resolved_placement,
                "template_source": "catalog-asset",
            },
        )

    async def list_catalogs(self) -> list[dict[str, Any]]:
        catalogs = await self._database.fetch_all(
            """
            select c.id internal_id, c.public_id id, c.slug, c.name, c.product_type,
              c.material, c.brand, c.description_override, c.provider_material_json,
              c.provider_size_chart_json, c.size_chart_override_json,
              (select count(*) from products p
               where p.status='active' and (
                 exists(
                   select 1 from product_catalogs pc_selected
                   where pc_selected.product_id=p.id
                     and pc_selected.catalog_id=c.id
                     and pc_selected.active=true
                 )
                 or not exists(
                   select 1 from product_catalogs pc_any
                   where pc_any.product_id=p.id and pc_any.active=true
                 )
               )) product_count
            from catalogs c
            where c.active=true
              and exists(select 1 from catalog_variants cv where cv.catalog_id=c.id and cv.active=true)
              and exists(select 1 from catalog_assets ca where ca.catalog_id=c.id and ca.status='active')
            order by c.sort_order, c.name
            """,
            (),
        )
        if not catalogs:
            return []

        colors = await self._database.fetch_all(
            """
            select cc.catalog_id, cc.slug, cc.name, cc.hex
            from catalog_colors cc join catalogs c on c.id=cc.catalog_id
            where c.active=true and cc.active=true order by cc.sort_order, cc.id
            """,
            (),
        )
        sizes = await self._database.fetch_all(
            """
            select cs.catalog_id, cs.code, cs.label
            from catalog_sizes cs join catalogs c on c.id=cs.catalog_id
            where c.active=true and cs.active=true order by cs.sort_order, cs.id
            """,
            (),
        )
        taxonomy = await self._database.fetch_all(
            """
            select ct.catalog_id, ct.department, ct.type_slug, ct.type_label, ct.sort_order
            from catalog_taxonomy ct join catalogs c on c.id=ct.catalog_id
            where c.active=true order by ct.sort_order, ct.type_label
            """,
            (),
        )

        def grouped(rows: list[dict[str, Any]], catalog_id: int) -> list[dict[str, Any]]:
            return [
                {key: value for key, value in row.items() if key != "catalog_id"}
                for row in rows
                if row["catalog_id"] == catalog_id
            ]

        for catalog in catalogs:
            material_details = _decode_json(catalog.pop("provider_material_json"))
            chart = catalog.pop("size_chart_override_json") or catalog.pop(
                "provider_size_chart_json"
            )
            catalog["size_chart"] = _decode_json(chart)
            catalog["description"] = catalog.pop("description_override")
            catalog["material_details"] = (
                material_details if isinstance(material_details, dict) else None
            )
            internal_id = catalog.pop("internal_id")
            catalog["colors"] = grouped(colors, internal_id)
            catalog["sizes"] = grouped(sizes, internal_id)
            catalog["taxonomy"] = _public_catalog_taxonomy(grouped(taxonomy, internal_id))
        return catalogs

    async def list_collections(self) -> list[dict[str, Any]]:
        return await self._database.fetch_all(
            """
            select public_id id, slug, title, description, image_url, indexable, created_at, updated_at, featured, selection_rule
            from collections where status='active' and (
              (selection_rule!='manual' and exists(select 1 from products where status='active'))
              or exists(select 1 from collection_products cp join products p on p.id=cp.product_id where cp.collection_id=collections.id and p.status='active')
            ) order by sort_order, title
            """,
            (),
        )

    async def get_collection(self, slug: str) -> dict[str, Any] | None:
        collection = await self._database.fetch_one(
            """
            select id internal_id, public_id id, slug, title, description, image_url, indexable,
              seo_title, seo_description, created_at, updated_at
            from collections where slug=%s and status='active' limit 1
            """,
            (slug,),
        )
        if not collection:
            return None
        products = await self.browse_shop(limit=24, offset=0, collection=slug)
        collection["products"] = products["data"]
        collection.pop("internal_id", None)
        return collection

    async def get_cart(self, public_id: str) -> dict[str, Any] | None:
        cart = await self._database.fetch_one(
            "select id internal_id, public_id id, currency, status, created_at, updated_at from carts where public_id=%s and status='active'",
            (public_id,),
        )
        if not cart:
            return None
        items = await self._database.fetch_all(
            """
            select ci.quantity, pv.public_id variant_id, pv.sku, cv.default_price_minor price_minor, cv.currency,
              p.public_id product_id, p.slug product_slug, p.title product_title,
              d.slug design_slug, ca.slug catalog, ca.name catalog_name, ca.provider,
              cc.slug color, cc.name color_name, cs.code size
            from cart_items ci
            join product_variants pv on pv.id=ci.product_variant_id and pv.active=true
            join products p on p.id=pv.product_id and p.status='active'
            join designs d on d.id=p.design_id
            join catalog_variants cv on cv.id=pv.catalog_variant_id and cv.active=true
            join catalogs ca on ca.id=cv.catalog_id
            join catalog_colors cc on cc.id=cv.color_id
            join catalog_sizes cs on cs.id=cv.size_id
            where ci.cart_id=%s order by ci.product_variant_id
            """,
            (cart["internal_id"],),
        )
        cart["items"] = [
            {
                **item,
                "line_total_minor": item["price_minor"] * item["quantity"],
                "image": (
                    build_catalog_mockup_url(
                        product_ref=item["product_slug"],
                        catalog_slug=item["catalog"],
                        color_slug=item["color"],
                    )
                    if item.pop("provider") == "gearment"
                    else build_media_url(
                        design_slug=item["design_slug"],
                        catalog_slug=item["catalog"],
                        color_slug=item["color"],
                        style="flat",
                        placement="front",
                    )
                ),
            }
            for item in items
        ]
        cart["subtotal_minor"] = sum(item["line_total_minor"] for item in cart["items"])
        cart.pop("internal_id", None)
        return cart

    async def upsert_cart_item(
        self, *, public_id: str | None, variant_id: str, quantity: int, mode: str
    ) -> dict[str, Any]:
        resolved_id = public_id or str(uuid.uuid4())
        async with self._database.transaction() as cursor:
            if not public_id:
                await cursor.execute(
                    """
                insert into carts(public_id, currency, status, expires_at)
                values (%s,'USD','active',%s) on duplicate key update updated_at=current_timestamp(6)
                """,
                    (resolved_id, datetime.now(UTC) + timedelta(days=30)),
                )
            await cursor.execute(
                "select id from carts where public_id=%s and status='active' for update",
                (resolved_id,),
            )
            cart = await cursor.fetchone()
            if not cart:
                raise ValueError("Cart is not active")
            await cursor.execute(
                "select id from checkout_attempts where cart_id=%s and status in ('creating','open') limit 1",
                (cart["id"],),
            )
            if await cursor.fetchone():
                raise ValueError(
                    "Checkout is in progress. Return to checkout and choose Edit cart first."
                )
            await cursor.execute(
                """
                select pv.id from product_variants pv join products p on p.id=pv.product_id
                join catalog_variants cv on cv.id=pv.catalog_variant_id
                where pv.public_id=%s and (%s=0 or (pv.active=true and p.status='active' and cv.active=true))
                """,
                (variant_id, quantity),
            )
            variant = await cursor.fetchone()
            if not variant:
                await cursor.execute(
                    """
                    select p.id product_id,p.public_id product_public_id,p.slug product_slug,
                      cv.id catalog_variant_id,cv.public_id catalog_variant_public_id,
                      cv.default_price_minor,cv.currency,ca.id catalog_id,ca.slug catalog_slug,
                      cc.id color_id,cc.slug color_slug,cs.code size_code
                    from products p
                    join catalogs ca on ca.active=true
                    join catalog_variants cv on cv.catalog_id=ca.id and cv.active=true
                    join catalog_colors cc on cc.id=cv.color_id and cc.active=true
                    join catalog_sizes cs on cs.id=cv.size_id and cs.active=true
                    where p.status='active' and concat('pv_',left(sha2(
                      concat(p.public_id,':',cv.public_id),256),32))=%s limit 1
                    """,
                    (variant_id,),
                )
                virtual = await cursor.fetchone()
                if not virtual:
                    raise ValueError("Variant is not available")
                await cursor.execute(
                    """
                    insert into product_catalogs(product_id,catalog_id,default_color_id,active)
                    values (%s,%s,%s,true)
                    on duplicate key update active=true
                    """,
                    (virtual["product_id"], virtual["catalog_id"], virtual["color_id"]),
                )
                sku_hash = hashlib.sha256(variant_id.encode()).hexdigest()[:10].upper()
                sku = (
                    f"{virtual['product_slug']}-{virtual['catalog_slug']}-"
                    f"{virtual['color_slug']}-{virtual['size_code']}-{sku_hash}"
                )[:160].upper()
                await cursor.execute(
                    """
                    insert into product_variants(public_id,product_id,catalog_variant_id,sku,
                      price_minor,currency,active)
                    values (%s,%s,%s,%s,%s,%s,true)
                    on duplicate key update active=true
                    """,
                    (
                        variant_id,
                        virtual["product_id"],
                        virtual["catalog_variant_id"],
                        sku,
                        virtual["default_price_minor"],
                        virtual["currency"],
                    ),
                )
                await cursor.execute(
                    "select id from product_variants where product_id=%s and catalog_variant_id=%s",
                    (virtual["product_id"], virtual["catalog_variant_id"]),
                )
                variant = await cursor.fetchone()
                if not variant:
                    raise RuntimeError("Variant could not be materialized")
            if quantity > 0:
                await cursor.execute(
                    "select cv.id,cv.stock_quantity,cv.stock_policy from product_variants pv join catalog_variants cv on cv.id=pv.catalog_variant_id join catalogs ca on ca.id=cv.catalog_id and ca.active=true where pv.id=%s for update",
                    (variant["id"],),
                )
                stock = await cursor.fetchone()
                await cursor.execute(
                    "select quantity from cart_items where cart_id=%s and product_variant_id=%s",
                    (cart["id"], variant["id"]),
                )
                previous = await cursor.fetchone()
                desired = quantity + (previous["quantity"] if previous and mode == "add" else 0)
                if (
                    not stock
                    or desired > 99
                    or (stock["stock_policy"] != "continue" and stock["stock_quantity"] < desired)
                ):
                    raise ValueError("Requested quantity is unavailable")
            await cursor.execute(
                "update carts set updated_at=current_timestamp(6) where id=%s", (cart["id"],)
            )
            if quantity == 0:
                await cursor.execute(
                    "delete from cart_items where cart_id=%s and product_variant_id=%s",
                    (cart["id"], variant["id"]),
                )
            elif mode == "set":
                await cursor.execute(
                    """
                    insert into cart_items(cart_id, product_variant_id, quantity) values (%s,%s,%s)
                    on duplicate key update quantity=values(quantity)
                    """,
                    (cart["id"], variant["id"], quantity),
                )
            else:
                await cursor.execute(
                    """
                    insert into cart_items(cart_id, product_variant_id, quantity) values (%s,%s,%s)
                    on duplicate key update quantity=least(99, quantity+values(quantity))
                    """,
                    (cart["id"], variant["id"], quantity),
                )
        result = await self.get_cart(resolved_id)
        if not result:
            raise RuntimeError("Cart could not be loaded after update")
        return result

    async def create_order(
        self, *, cart_id: str, email: str, address: dict[str, Any], idempotency_key: str
    ) -> dict[str, Any]:
        request_hash = hashlib.sha256(
            json.dumps(
                {"cart_id": cart_id, "email": email, "address": address}, sort_keys=True
            ).encode()
        ).hexdigest()
        async with self._database.transaction() as cursor:
            await cursor.execute(
                "select request_hash, response_json from idempotency_keys where idempotency_key=%s for update",
                (idempotency_key,),
            )
            existing = await cursor.fetchone()
            if existing:
                if existing["request_hash"] != request_hash:
                    raise ValueError("Idempotency key was already used with another request")
                return json.loads(existing["response_json"])
            await cursor.execute(
                "select id, currency from carts where public_id=%s and status='active' for update",
                (cart_id,),
            )
            cart = await cursor.fetchone()
            if not cart:
                raise ValueError("Cart is empty or inactive")
            await cursor.execute(
                """
                select ci.quantity, pv.public_id variant_id, pv.sku, pv.price_minor,
                  p.slug product_slug, p.title, d.slug design_slug, ca.slug catalog,
                  ca.name catalog_name, ca.provider,
                  cc.slug color, cc.name color_name, cs.code size
                from cart_items ci join product_variants pv on pv.id=ci.product_variant_id and pv.active=true
                join products p on p.id=pv.product_id and p.status='active'
                join designs d on d.id=p.design_id join catalog_variants cv on cv.id=pv.catalog_variant_id
                join catalogs ca on ca.id=cv.catalog_id join catalog_colors cc on cc.id=cv.color_id
                join catalog_sizes cs on cs.id=cv.size_id where ci.cart_id=%s
                """,
                (cart["id"],),
            )
            items = await cursor.fetchall()
            if not items:
                raise ValueError("Cart is empty or inactive")
            subtotal = sum(item["price_minor"] * item["quantity"] for item in items)
            order_public_id = str(uuid.uuid4())
            order_number = f"YNS-{datetime.now(UTC):%y%m%d}-{uuid.uuid4().hex[:6].upper()}"
            await cursor.execute(
                """
                insert into orders(public_id, order_number, cart_id, email, currency,
                  subtotal_minor, total_minor) values (%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    order_public_id,
                    order_number,
                    cart["id"],
                    email,
                    cart["currency"],
                    subtotal,
                    subtotal,
                ),
            )
            order_id = cursor.lastrowid
            for item in items:
                mockup_url = (
                    build_catalog_mockup_url(
                        product_ref=item["product_slug"],
                        catalog_slug=item["catalog"],
                        color_slug=item["color"],
                    )
                    if item["provider"] == "gearment"
                    else build_media_url(
                        design_slug=item["design_slug"],
                        catalog_slug=item["catalog"],
                        color_slug=item["color"],
                        style="flat",
                        placement="front",
                    )
                )
                await cursor.execute(
                    """
                    insert into order_items(order_id, product_variant_public_id, sku, title,
                      catalog_name, color_name, size_code, mockup_url, unit_price_minor,
                      quantity, line_total_minor) values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        order_id,
                        item["variant_id"],
                        item["sku"],
                        item["title"],
                        item["catalog_name"],
                        item["color_name"],
                        item["size"],
                        mockup_url,
                        item["price_minor"],
                        item["quantity"],
                        item["price_minor"] * item["quantity"],
                    ),
                )
            await cursor.execute(
                """
                insert into order_addresses(order_id,address_type,full_name,line1,line2,city,region,
                  postal_code,country_code,phone) values (%s,'shipping',%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    order_id,
                    address["full_name"],
                    address["line1"],
                    address.get("line2"),
                    address["city"],
                    address.get("region"),
                    address["postal_code"],
                    address["country_code"].upper(),
                    address.get("phone"),
                ),
            )
            response = {
                "id": order_public_id,
                "order_number": order_number,
                "currency": cart["currency"],
                "subtotal_minor": subtotal,
                "total_minor": subtotal,
                "payment_status": "pending",
            }
            await cursor.execute(
                "insert into idempotency_keys(idempotency_key,request_hash,resource_type,resource_id,response_json) values (%s,%s,'order',%s,%s)",
                (idempotency_key, request_hash, order_public_id, json.dumps(response)),
            )
            await cursor.execute("update carts set status='converted' where id=%s", (cart["id"],))
            await cursor.execute(
                "insert into outbox_events(event_type,aggregate_type,aggregate_id,payload_json) values ('order.created','order',%s,%s)",
                (order_public_id, json.dumps(response)),
            )
        return response

    async def get_product_by_id(self, product_id: str) -> ProductSummary | None:
        row = await self._database.fetch_one(
            """
            select id, slug, name, description, default_artwork_id, default_template_id
            from pod_products
            where id = %s
            limit 1
            """,
            (product_id,),
        )
        return ProductSummary.model_validate(row) if row else None

    async def find_products_by_slug_ref(self, slug_ref: str) -> list[ProductSummary]:
        rows = await self._database.fetch_all(
            """
            select id, slug, name, description, default_artwork_id, default_template_id
            from pod_products
            where slug = %s or slug like concat(%s, '-%%')
            order by slug = %s desc, length(slug) asc
            limit 80
            """,
            (slug_ref, slug_ref, slug_ref),
        )
        return [ProductSummary.model_validate(row) for row in rows]

    async def get_render_job(
        self,
        *,
        product_id: str,
        artwork_id: str,
        template_id: str,
        variant_id: str | None,
    ) -> RenderJob | None:
        row = await self._database.fetch_one(
            """
            select
              product_id,
              artwork_id,
              template_id,
              variant_id,
              base_source,
              artwork_source,
              mask_source,
              displacement_source,
              shadow_source,
              highlight_source,
              print_area,
              version,
              metadata
            from pod_mockup_render_jobs
            where product_id = %s
              and artwork_id = %s
              and template_id = %s
              and (%s is null or variant_id = %s)
            order by variant_id is null asc
            limit 1
            """,
            (product_id, artwork_id, template_id, variant_id, variant_id),
        )
        if not row:
            return None
        return RenderJob.model_validate(_decode_json_columns(row))


def _decode_json_columns(row: dict[str, Any]) -> dict[str, Any]:
    decoded = dict(row)
    for key in ("print_area", "metadata"):
        value = decoded.get(key)
        if isinstance(value, str):
            decoded[key] = json.loads(value)
        elif value is None and key == "metadata":
            decoded[key] = {}
    return decoded
