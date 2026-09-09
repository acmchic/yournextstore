from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any

from app.db import Database

SHOWCASE_COLOR_CODES = (
    "black",
    "white",
    "navy",
    "red",
    "royal",
    "sport-grey",
)
SHOWCASE_GROUPS = ("unisex", "women", "kids", "accessories")


@dataclass(frozen=True)
class CatalogAssignmentResult:
    product: str
    catalog: str
    color: str
    color_name: str
    variants: int


def stable_variant_id(product_public_id: str, catalog_variant_public_id: str) -> str:
    digest = hashlib.sha256(f"{product_public_id}:{catalog_variant_public_id}".encode()).hexdigest()
    return f"pv_{digest[:32]}"


def _color_key(value: str) -> str:
    return "-".join(value.strip().lower().replace("_", "-").split())


def choose_showcase_color(
    colors: list[dict[str, Any]], start_index: int = 0
) -> dict[str, Any] | None:
    """Choose a popular US color that is actually available in this catalog."""
    if not colors:
        return None
    by_key = {
        _color_key(str(value)): row
        for row in colors
        for value in (row.get("slug"), row.get("name"))
        if value
    }
    ordered = [
        SHOWCASE_COLOR_CODES[(start_index + offset) % len(SHOWCASE_COLOR_CODES)]
        for offset in range(len(SHOWCASE_COLOR_CODES))
    ]
    return next(
        (by_key[key] for key in ordered if key in by_key), colors[start_index % len(colors)]
    )


async def _assign_product_catalog_cursor(
    cursor: Any,
    *,
    product_slug: str,
    catalog_slug: str,
    color_slug: str | None,
) -> CatalogAssignmentResult:
    await cursor.execute(
        "select id, public_id from products where slug=%s and status='active' for update",
        (product_slug,),
    )
    product = await cursor.fetchone()
    if not product:
        raise ValueError(f"Active product not found: {product_slug}")

    await cursor.execute(
        "select id, slug from catalogs where slug=%s and active=true for update", (catalog_slug,)
    )
    catalog = await cursor.fetchone()
    if not catalog:
        raise ValueError(f"Active catalog not found: {catalog_slug}")

    if color_slug:
        await cursor.execute(
            """
            select id, slug, name from catalog_colors
            where catalog_id=%s and active=true
              and (lower(slug)=lower(%s) or lower(name)=lower(%s))
            limit 1
            """,
            (catalog["id"], color_slug, color_slug),
        )
    else:
        await cursor.execute(
            """
            select id, slug, name from catalog_colors
            where catalog_id=%s and active=true
            order by (lower(slug)='black') desc, sort_order, id limit 1
            """,
            (catalog["id"],),
        )
    default_color = await cursor.fetchone()
    if not default_color:
        requested = f" '{color_slug}'" if color_slug else ""
        raise ValueError(f"Catalog {catalog_slug} has no active color{requested}")

    await cursor.execute(
        """
        insert into product_catalogs(product_id,catalog_id,default_color_id,active)
        values (%s,%s,%s,true)
        on duplicate key update default_color_id=values(default_color_id),active=true
        """,
        (product["id"], catalog["id"], default_color["id"]),
    )
    await cursor.execute(
        """
        select cv.id,cv.public_id,cv.default_price_minor,cv.currency,cv.sku,
          cc.slug color_slug,cs.code size_code,pc.price_adjustment_minor
        from catalog_variants cv
        join catalog_colors cc on cc.id=cv.color_id and cc.active=true
        join catalog_sizes cs on cs.id=cv.size_id and cs.active=true
        join product_catalogs pc on pc.product_id=%s and pc.catalog_id=cv.catalog_id
        where cv.catalog_id=%s and cv.active=true
        """,
        (product["id"], catalog["id"]),
    )
    variants = await cursor.fetchall()
    if not variants:
        raise ValueError(f"Catalog {catalog_slug} has no active variants")

    variant_params = []
    for variant in variants:
        public_id = stable_variant_id(product["public_id"], variant["public_id"])
        sku_hash = hashlib.sha256(public_id.encode()).hexdigest()[:10].upper()
        sku = f"{product_slug}-{catalog_slug}-{variant['color_slug']}-{variant['size_code']}-{sku_hash}"[
            :160
        ].upper()
        price = max(0, int(variant["default_price_minor"]) + int(variant["price_adjustment_minor"]))
        variant_params.append(
            (public_id, product["id"], variant["id"], sku, price, variant["currency"])
        )
    await cursor.executemany(
        """
        insert into product_variants(public_id,product_id,catalog_variant_id,sku,
          price_minor,currency,active)
        values (%s,%s,%s,%s,%s,%s,true)
        on duplicate key update sku=values(sku),price_minor=values(price_minor),
          currency=values(currency),active=true
        """,
        variant_params,
    )
    return CatalogAssignmentResult(
        product_slug,
        catalog["slug"],
        default_color["slug"],
        default_color["name"],
        len(variants),
    )


async def assign_product_catalog(
    *, database: Database, product_slug: str, catalog_slug: str, color_slug: str | None = None
) -> CatalogAssignmentResult:
    async with database.transaction() as cursor:
        return await _assign_product_catalog_cursor(
            cursor,
            product_slug=product_slug,
            catalog_slug=catalog_slug,
            color_slug=color_slug,
        )


def _catalog_matches_group(departments: set[str], group: str) -> bool:
    is_unisex = {"men", "women"}.issubset(departments)
    if group == "unisex":
        return is_unisex
    if group == "women" and is_unisex:
        return False
    return group in departments


async def seed_product_showcase(*, database: Database, per_category: int = 4) -> dict[str, Any]:
    """Assign products to each eligible catalog, using available showcase colors."""
    if per_category < 1:
        raise ValueError("--per-category must be at least 1")

    catalog_rows = await database.fetch_all(
        """
        select c.id, c.slug, ct.department
        from catalogs c
        join catalog_taxonomy ct on ct.catalog_id=c.id
        where c.active=true
          and exists(select 1 from catalog_variants cv where cv.catalog_id=c.id and cv.active=true)
          and exists(select 1 from catalog_assets asset where asset.catalog_id=c.id and asset.status='active')
        order by c.sort_order, c.id
        """,
        (),
    )
    catalogs: dict[int, dict[str, Any]] = {}
    for row in catalog_rows:
        catalog = catalogs.setdefault(
            row["id"], {"id": row["id"], "slug": row["slug"], "departments": set()}
        )
        catalog["departments"].add(row["department"])

    colors = await database.fetch_all(
        """
        select cc.catalog_id, cc.slug, cc.name
        from catalog_colors cc
        where cc.active=true
          and exists(
            select 1 from catalog_variants cv
            where cv.catalog_id=cc.catalog_id and cv.color_id=cc.id and cv.active=true
          )
        order by cc.catalog_id, cc.sort_order, cc.id
        """,
        (),
    )
    colors_by_catalog: dict[int, list[dict[str, Any]]] = {}
    for color in colors:
        colors_by_catalog.setdefault(color["catalog_id"], []).append(color)

    products = await database.fetch_all(
        """
        select p.id, p.slug
        from products p join designs d on d.id=p.design_id
        where p.status='active' and d.status='active'
        order by p.published_at desc, p.id desc
        """,
        (),
    )
    available_catalogs = list(catalogs.values())
    assignments: list[CatalogAssignmentResult] = []
    counts = {group: 0 for group in SHOWCASE_GROUPS}

    async with database.transaction() as cursor:
        for group in SHOWCASE_GROUPS:
            group_catalogs = [
                catalog
                for catalog in available_catalogs
                if _catalog_matches_group(catalog["departments"], group)
                and colors_by_catalog.get(catalog["id"])
            ]
            if not group_catalogs or not products:
                continue
            for catalog_index, catalog in enumerate(group_catalogs):
                start = (catalog_index * per_category) % len(products)
                catalog_products = [
                    products[(start + offset) % len(products)]
                    for offset in range(min(per_category, len(products)))
                ]
                for product_index, product in enumerate(catalog_products):
                    color = choose_showcase_color(
                        colors_by_catalog[catalog["id"]], product_index + catalog_index
                    )
                    if not color:
                        continue
                    result = await _assign_product_catalog_cursor(
                        cursor,
                        product_slug=product["slug"],
                        catalog_slug=catalog["slug"],
                        color_slug=color["slug"],
                    )
                    assignments.append(result)
                    counts[group] += 1

    return {
        "count": len(assignments),
        "categories": counts,
        "results": [assignment.__dict__ for assignment in assignments],
    }
