from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from app.db import Database
from app.models import ProductSummary, RenderJob
from app.product_media import build_blank_media_url, build_media_url


class CatalogRepository:
    def __init__(self, database: Database) -> None:
        self._database = database

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
            joins.append(
                "join product_catalogs pc_filter on pc_filter.product_id=p.id and pc_filter.active=true"
            )
            joins.append("join catalogs ca_filter on ca_filter.id=pc_filter.catalog_id")
            filters.append("ca_filter.slug=%s")
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
              (select min(pv.price_minor) from product_variants pv
               where pv.product_id=p.id and pv.active=true) price_minor,
              (select pv.currency from product_variants pv
               where pv.product_id=p.id and pv.active=true order by pv.price_minor limit 1) currency
            {from_where}
            order by p.published_at desc, p.id desc limit %s offset %s
            """,
            (*params, limit, offset),
        )
        data = []
        for row in rows:
            detail = await self.get_product_detail(row["slug"])
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

    async def get_product_detail(self, slug: str) -> dict[str, Any] | None:
        product = await self._database.fetch_one(
            """
            select p.id, p.public_id, p.slug, p.title, p.description, p.status, p.brand,
              p.product_condition, p.seo_title, p.seo_description, p.created_at, p.updated_at,
              d.slug design_slug, d.alt_text, d.checksum design_checksum
            from products p join designs d on d.id=p.design_id
            where p.slug=%s and p.status='active' limit 1
            """,
            (slug,),
        )
        if not product:
            return None
        variants = await self._database.fetch_all(
            """
            select pv.public_id id, pv.sku, pv.price_minor, pv.compare_at_minor, pv.currency,
              ca.slug catalog, ca.name catalog_name, cc.slug color, cc.name color_name, cc.hex color_hex,
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
        templates = await self._database.fetch_all(
            """
            select ca.slug catalog, cc.slug color, mt.style, mt.placement
            from product_catalogs pc
            join catalogs ca on ca.id=pc.catalog_id
            join mockup_templates mt on mt.catalog_id=ca.id and mt.active=true
            join catalog_colors cc on cc.id=mt.color_id
            where pc.product_id=%s and pc.active=true
            order by ca.sort_order, cc.sort_order, field(mt.style,'flat','women','men'),
              field(mt.placement,'front','left-chest','back')
            """,
            (product["id"],),
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
                "canonical": f"/product/{product['slug']}",
            },
            "design": {
                "slug": product["design_slug"],
                "alt_text": product["alt_text"] or product["title"],
                "checksum": product["design_checksum"],
            },
            "variants": variants,
            "media": media,
        }

    async def list_catalogs(self) -> list[dict[str, Any]]:
        catalogs = await self._database.fetch_all(
            "select public_id id, slug, name, product_type, material, brand from catalogs where active=true order by sort_order",
            (),
        )
        for catalog in catalogs:
            catalog["colors"] = await self._database.fetch_all(
                "select slug, name, hex from catalog_colors where catalog_id=(select id from catalogs where public_id=%s) and active=true order by sort_order",
                (catalog["id"],),
            )
            catalog["sizes"] = await self._database.fetch_all(
                "select code, label from catalog_sizes where catalog_id=(select id from catalogs where public_id=%s) and active=true order by sort_order",
                (catalog["id"],),
            )
        return catalogs

    async def list_collections(self) -> list[dict[str, Any]]:
        return await self._database.fetch_all(
            """
            select public_id id, slug, title, description, image_url, indexable, created_at, updated_at
            from collections where status='active' order by title
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
        products = await self.browse_products(limit=100, offset=0, collection=slug)
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
            select ci.quantity, pv.public_id variant_id, pv.sku, pv.price_minor, pv.currency,
              p.public_id product_id, p.slug product_slug, p.title product_title,
              d.slug design_slug, ca.slug catalog, ca.name catalog_name,
              cc.slug color, cc.name color_name, cs.code size
            from cart_items ci
            join product_variants pv on pv.id=ci.product_variant_id and pv.active=true
            join products p on p.id=pv.product_id and p.status='active'
            join designs d on d.id=p.design_id
            join catalog_variants cv on cv.id=pv.catalog_variant_id and cv.active=true
            join catalogs ca on ca.id=cv.catalog_id
            join catalog_colors cc on cc.id=cv.color_id
            join catalog_sizes cs on cs.id=cv.size_id
            where ci.cart_id=%s order by ci.created_at
            """,
            (cart["internal_id"],),
        )
        cart["items"] = [
            {
                **item,
                "line_total_minor": item["price_minor"] * item["quantity"],
                "image": build_media_url(
                    design_slug=item["design_slug"],
                    catalog_slug=item["catalog"],
                    color_slug=item["color"],
                    style="flat",
                    placement="front",
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
                """
                select pv.id from product_variants pv join products p on p.id=pv.product_id
                join catalog_variants cv on cv.id=pv.catalog_variant_id
                where pv.public_id=%s and pv.active=true and p.status='active' and cv.active=true
                """,
                (variant_id,),
            )
            variant = await cursor.fetchone()
            if not variant:
                raise ValueError("Variant is not available")
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
                  p.title, d.slug design_slug, ca.slug catalog, ca.name catalog_name,
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
                mockup_url = build_media_url(
                    design_slug=item["design_slug"],
                    catalog_slug=item["catalog"],
                    color_slug=item["color"],
                    style="flat",
                    placement="front",
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
