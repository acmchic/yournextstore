from __future__ import annotations

import hashlib
from dataclasses import dataclass

from app.db import Database


@dataclass(frozen=True)
class CatalogAssignmentResult:
    product: str
    catalog: str
    variants: int


def stable_variant_id(product_public_id: str, catalog_variant_public_id: str) -> str:
    digest = hashlib.sha256(f"{product_public_id}:{catalog_variant_public_id}".encode()).hexdigest()
    return f"pv_{digest[:32]}"


async def assign_product_catalog(
    *, database: Database, product_slug: str, catalog_slug: str
) -> CatalogAssignmentResult:
    async with database.transaction() as cursor:
        await cursor.execute(
            "select id, public_id from products where slug=%s and status='active' for update",
            (product_slug,),
        )
        product = await cursor.fetchone()
        if not product:
            raise ValueError(f"Active product not found: {product_slug}")
        await cursor.execute(
            "select id from catalogs where slug=%s and active=true for update", (catalog_slug,)
        )
        catalog = await cursor.fetchone()
        if not catalog:
            raise ValueError(f"Active catalog not found: {catalog_slug}")
        await cursor.execute(
            """
            select id from catalog_colors where catalog_id=%s and active=true
            order by (lower(slug)='black') desc, sort_order, id limit 1
            """,
            (catalog["id"],),
        )
        default_color = await cursor.fetchone()
        await cursor.execute(
            """
            insert into product_catalogs(product_id,catalog_id,default_color_id,active)
            values (%s,%s,%s,true)
            on duplicate key update default_color_id=values(default_color_id),active=true
            """,
            (product["id"], catalog["id"], default_color["id"] if default_color else None),
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
        for variant in variants:
            public_id = stable_variant_id(product["public_id"], variant["public_id"])
            sku_hash = hashlib.sha256(public_id.encode()).hexdigest()[:10].upper()
            sku = f"{product_slug}-{catalog_slug}-{variant['color_slug']}-{variant['size_code']}-{sku_hash}"[
                :160
            ].upper()
            price = max(
                0, int(variant["default_price_minor"]) + int(variant["price_adjustment_minor"])
            )
            await cursor.execute(
                """
                insert into product_variants(public_id,product_id,catalog_variant_id,sku,
                  price_minor,currency,active)
                values (%s,%s,%s,%s,%s,%s,true)
                on duplicate key update sku=values(sku),price_minor=values(price_minor),
                  currency=values(currency),active=true
                """,
                (public_id, product["id"], variant["id"], sku, price, variant["currency"]),
            )
    return CatalogAssignmentResult(product_slug, catalog_slug, len(variants))
