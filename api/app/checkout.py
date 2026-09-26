"""Hosted Checkout: immutable cart snapshots, stock reservations and atomic fulfillment."""

import json
import uuid
from datetime import UTC, datetime
from urllib.parse import quote, urlencode

from app.product_media import build_media_url
from app.shipping import decode, shipping_options


class CheckoutService:
    def __init__(self, database, config):
        self.db = database
        self.config = config

    def stripe(self):
        import stripe

        if not self.config.stripe_secret_key or not self.config.stripe_webhook_secret:
            raise ValueError("Payments are not available yet. Please try again later.")
        return stripe.StripeClient(self.config.stripe_secret_key, stripe_version="2025-03-31.basil")

    async def settings(self):
        return await self.db.fetch_one("select * from checkout_settings where id=1", ())

    def image_url(self, item):
        if item["provider"] == "gearment":
            path = "/api/catalog-mockup/{}/{}?{}".format(
                quote(item["product_slug"], safe=""),
                quote(item["catalog"], safe=""),
                urlencode(
                    {
                        "Color": item["color"],
                        "Size": item["size_code"],
                        "Placement": "front",
                    }
                ),
            )
        else:
            path = build_media_url(
                design_slug=item["design_slug"],
                catalog_slug=item["catalog"],
                color_slug=item["color"],
                style="flat",
                placement="front",
            )
        return f"{self.config.storefront_public_url}{path}"

    async def prepare(self, cart_public_id, selected_shipping="standard"):
        # Validate config before reserving a cart. Unknown policy facts remain drafts.
        self.stripe()
        if selected_shipping not in ("standard", "express"):
            raise ValueError("Unknown shipping method")
        async with self.db.transaction() as cursor:
            await cursor.execute(
                "select * from carts where public_id=%s and status='active' for update",
                (cart_public_id,),
            )
            cart = await cursor.fetchone()
            if not cart:
                raise ValueError("Your cart is empty or no longer active.")
            await cursor.execute(
                "select * from checkout_attempts where cart_id=%s and status in ('creating','open') limit 1",
                (cart["id"],),
            )
            attempt = await cursor.fetchone()
            if attempt:
                if not attempt["stripe_session_id"] and attempt["status"] == "creating":
                    snapshot = decode(attempt["snapshot_json"])
                    snapshot["selected_shipping"] = selected_shipping
                    attempt["snapshot_json"] = json.dumps(snapshot)
                    await cursor.execute(
                        "update checkout_attempts set snapshot_json=%s where id=%s",
                        (attempt["snapshot_json"], attempt["id"]),
                    )
                return attempt
            await cursor.execute(
                """select ci.quantity, pv.public_id variant_id, pv.sku,
                cv.default_price_minor price_minor, cv.currency, cv.id catalog_variant_id,
                cv.stock_policy, cv.stock_quantity, p.title, p.slug product_slug,
                d.slug design_slug, ca.slug catalog, ca.name catalog_name, ca.provider,
                cc.slug color, cc.name color_name, cs.code size_code
                from cart_items ci join product_variants pv on pv.id=ci.product_variant_id
                join products p on p.id=pv.product_id join designs d on d.id=p.design_id
                join catalog_variants cv on cv.id=pv.catalog_variant_id
                join catalogs ca on ca.id=cv.catalog_id join catalog_colors cc on cc.id=cv.color_id
                join catalog_sizes cs on cs.id=cv.size_id
                where ci.cart_id=%s and pv.active=true and p.status='active' and cv.active=true
                and ca.active=true and cc.active=true and cs.active=true
                order by cv.id, pv.id for update""",
                (cart["id"],),
            )
            items = await cursor.fetchall()
            await cursor.execute(
                "select count(*) count from cart_items where cart_id=%s", (cart["id"],)
            )
            count = (await cursor.fetchone())["count"]
            if not items or len(items) != count or len(items) > 100:
                raise ValueError(
                    "Review your cart: an item is unavailable or there are too many different items."
                )
            for item in items:
                if (
                    item["currency"] != "USD"
                    or not 1 <= item["quantity"] <= 99
                    or item["price_minor"] < 1
                ):
                    raise ValueError("An item cannot be purchased. Please review your cart.")
                item["reserved"] = item["stock_policy"] != "continue"
                item["image_url"] = self.image_url(item)
                if item["reserved"]:
                    await cursor.execute(
                        "update catalog_variants set stock_quantity=stock_quantity-%s where id=%s and stock_quantity>=%s",
                        (item["quantity"], item["catalog_variant_id"], item["quantity"]),
                    )
                    if cursor.rowcount != 1:
                        raise ValueError(
                            "Not enough stock. Please reduce the quantity in your cart."
                        )
            await cursor.execute("select * from checkout_settings where id=1", ())
            rates = await cursor.fetchone()
            if self.config.stripe_secret_key.startswith("sk_live_"):
                await cursor.execute(
                    "select slug from legal_pages where published=true and slug in ('about','shipping-policy','return-policy','privacy-policy','terms-of-service')"
                )
                if len(await cursor.fetchall()) != 5:
                    raise ValueError(
                        "Payments are not available yet. Store policies are being finalized."
                    )
            snapshot = {
                "items": items,
                "shipping": shipping_options(rates, sum(item["quantity"] for item in items)),
                "selected_shipping": selected_shipping,
                "subtotal": sum(item["price_minor"] * item["quantity"] for item in items),
                "automatic_tax": self.config.stripe_automatic_tax,
                "success_url": self.config.checkout_success_url,
                "cancel_url": self.config.checkout_cancel_url,
            }
            if (
                snapshot["subtotal"]
                + max(option["amount_minor"] for option in snapshot["shipping"])
                > 99_999_999
            ):
                raise ValueError("This order exceeds the payment limit. Please reduce your cart.")
            attempt = {
                "id": str(uuid.uuid4()),
                "cart_id": cart["id"],
                "snapshot_json": json.dumps(snapshot),
                "stripe_session_id": None,
            }
            await cursor.execute(
                "insert into checkout_attempts(id,cart_id,snapshot_json) values (%s,%s,%s)",
                (attempt["id"], cart["id"], attempt["snapshot_json"]),
            )
            return attempt

    async def session(self, attempt):
        client = self.stripe()
        if attempt["stripe_session_id"]:
            return await client.v1.checkout.sessions.retrieve_async(
                attempt["stripe_session_id"],
                {"expand": ["shipping_cost.shipping_rate", "payment_intent.latest_charge"]},
            )
        snapshot = decode(attempt["snapshot_json"])
        params = {
            "mode": "payment",
            "payment_method_types": ["card"],
            "billing_address_collection": "auto",
            "shipping_address_collection": {"allowed_countries": ["US"]},
            "success_url": snapshot["success_url"],
            "cancel_url": snapshot["cancel_url"],
            "client_reference_id": attempt["id"],
            "metadata": {"attempt_id": attempt["id"]},
            "automatic_tax": {"enabled": snapshot["automatic_tax"]},
            "line_items": [
                {
                    "quantity": item["quantity"],
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": item["price_minor"],
                        "tax_behavior": "exclusive",
                        "product_data": {
                            "name": f"{item['title']} — {item['catalog_name']}",
                            "description": f"{item['color_name']} · {item['size_code']}",
                            "images": [item["image_url"]],
                        },
                    },
                }
                for item in snapshot["items"]
            ],
            "shipping_options": [
                {
                    "shipping_rate_data": {
                        "type": "fixed_amount",
                        "display_name": option["name"],
                        "fixed_amount": {"amount": option["amount_minor"], "currency": "usd"},
                        "tax_behavior": "exclusive",
                        "metadata": {"method": option["id"]},
                    }
                }
                for option in snapshot["shipping"]
                if option["id"] == snapshot.get("selected_shipping", "standard")
            ],
        }
        session = await client.v1.checkout.sessions.create_async(
            params, {"idempotency_key": attempt["id"]}
        )
        # Do not regress status if a webhook completed while the request was returning.
        await self.db.execute(
            "update checkout_attempts set stripe_session_id=%s,status=if(status='creating','open',status) where id=%s",
            (session["id"], attempt["id"]),
        )
        return session

    async def start(self, cart_id, selected_shipping="standard"):
        attempt = await self.prepare(cart_id, selected_shipping)
        session = await self.session(attempt)
        if session["status"] == "expired":
            await self.reconcile(session)
            return await self.start(cart_id, selected_shipping)
        if session["status"] == "complete":
            await self.reconcile(session)
            raise ValueError("This checkout has completed. Please check your order confirmation.")
        return {"url": session["url"]}

    async def cancel(self, cart_id):
        attempt = await self.db.fetch_one(
            "select a.* from checkout_attempts a join carts c on c.id=a.cart_id where c.public_id=%s and a.status in ('creating','open') limit 1",
            (cart_id,),
        )
        if not attempt:
            return
        session = await self.session(attempt)
        if session["status"] == "open":
            session = await self.stripe().v1.checkout.sessions.expire_async(session["id"])
        await self.reconcile(session)

    async def reconcile(self, session, event_id=None, event_type="reconciliation"):
        attempt_id = (session.get("metadata") or {}).get("attempt_id")
        if not attempt_id:
            return
        async with self.db.transaction() as cursor:
            # Same lock order as cart writes/prepare, including across webhook workers.
            await cursor.execute("select cart_id from checkout_attempts where id=%s", (attempt_id,))
            reference = await cursor.fetchone()
            if not reference:
                raise ValueError("Unknown checkout attempt")
            await cursor.execute(
                "select id from carts where id=%s for update", (reference["cart_id"],)
            )
            await cursor.fetchone()
            await cursor.execute(
                "select * from checkout_attempts where id=%s for update", (attempt_id,)
            )
            attempt = await cursor.fetchone()
            if attempt["stripe_session_id"] and attempt["stripe_session_id"] != session["id"]:
                raise ValueError("Checkout session mismatch")
            if event_id:
                await cursor.execute(
                    "insert ignore into stripe_events(id,event_type) values (%s,%s)",
                    (event_id, event_type),
                )
                if cursor.rowcount == 0:
                    return
            if attempt["status"] in ("paid", "expired"):
                return
            snapshot = decode(attempt["snapshot_json"])
            if session["status"] == "expired":
                for item in snapshot["items"]:
                    if item["reserved"]:
                        await cursor.execute(
                            "update catalog_variants set stock_quantity=stock_quantity+%s where id=%s",
                            (item["quantity"], item["catalog_variant_id"]),
                        )
                await cursor.execute(
                    "update checkout_attempts set status='expired',stripe_session_id=%s where id=%s",
                    (session["id"], attempt_id),
                )
                return
            if session.get("payment_status") != "paid":
                return
            shipping, customer, address = validate_paid_session(session, snapshot)
            order_id = str(uuid.uuid4())
            number = f"TB-{datetime.now(UTC):%y%m%d}-{uuid.uuid4().hex[:10].upper()}"
            await cursor.execute(
                """insert into orders(public_id,order_number,cart_id,email,currency,subtotal_minor,shipping_minor,tax_minor,total_minor,payment_status)
                values (%s,%s,%s,%s,'USD',%s,%s,%s,%s,'paid')""",
                (
                    order_id,
                    number,
                    attempt["cart_id"],
                    customer["email"],
                    snapshot["subtotal"],
                    shipping["amount_minor"],
                    session["total_details"]["amount_tax"],
                    session["amount_total"],
                ),
            )
            internal_id = cursor.lastrowid
            for item in snapshot["items"]:
                await cursor.execute(
                    """insert into order_items(order_id,product_variant_public_id,sku,title,design_slug,catalog_name,color_name,size_code,unit_price_minor,quantity,line_total_minor)
                    values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (
                        internal_id,
                        item["variant_id"],
                        item["sku"],
                        item["title"],
                        item["design_slug"],
                        item["catalog_name"],
                        item["color_name"],
                        item["size_code"],
                        item["price_minor"],
                        item["quantity"],
                        item["price_minor"] * item["quantity"],
                    ),
                )
            await cursor.execute(
                """insert into order_addresses(order_id,address_type,full_name,line1,line2,city,region,postal_code,country_code)
                values (%s,'shipping',%s,%s,%s,%s,%s,%s,'US')""",
                (
                    internal_id,
                    customer["name"],
                    address["line1"],
                    address.get("line2"),
                    address["city"],
                    address["state"],
                    address["postal_code"],
                ),
            )
            await cursor.execute(
                """insert into customers(email,full_name,shipping_address_json) values (%s,%s,%s)
                on duplicate key update full_name=values(full_name),shipping_address_json=values(shipping_address_json)""",
                (customer["email"], customer["name"], json.dumps(address)),
            )
            await cursor.execute(
                "update checkout_attempts set status='paid',order_id=%s,stripe_session_id=%s,shipping_method=%s,payment_intent_id=%s where id=%s",
                (
                    internal_id,
                    session["id"],
                    shipping["id"],
                    session.get("payment_intent"),
                    attempt_id,
                ),
            )
            await cursor.execute(
                "update carts set status='converted' where id=%s", (attempt["cart_id"],)
            )
            await cursor.execute(
                "insert into outbox_events(event_type,aggregate_type,aggregate_id,payload_json) values ('order.paid','order',%s,%s)",
                (
                    order_id,
                    json.dumps(
                        {
                            "order_number": number,
                            "total_minor": session["amount_total"],
                            "currency": "USD",
                            "item_count": sum(item["quantity"] for item in snapshot["items"]),
                            "shipping_method": shipping["id"],
                            "stripe_session_id": session["id"],
                        }
                    ),
                ),
            )
            await cursor.execute(
                "insert into outbox_events(event_type,aggregate_type,aggregate_id,payload_json) values ('order.receipt','order',%s,%s)",
                (
                    order_id,
                    json.dumps(
                        {
                            "email": customer["email"],
                            "order_number": number,
                            "currency": "USD",
                            "subtotal_minor": snapshot["subtotal"],
                            "shipping_minor": shipping["amount_minor"],
                            "shipping_method": shipping["name"],
                            "tax_minor": session["total_details"]["amount_tax"],
                            "total_minor": session["amount_total"],
                            "payment_method": payment_method_label(session),
                            "items": [
                                {
                                    "title": item["title"],
                                    "catalog_name": item["catalog_name"],
                                    "color_name": item["color_name"],
                                    "size_code": item["size_code"],
                                    "quantity": item["quantity"],
                                    "unit_price_minor": item["price_minor"],
                                    "line_total_minor": item["price_minor"] * item["quantity"],
                                    "image_url": item["image_url"],
                                }
                                for item in snapshot["items"]
                            ],
                        }
                    ),
                ),
            )

    async def confirmation(self, cart_id, session_id):
        attempt = await self.db.fetch_one(
            "select a.* from checkout_attempts a join carts c on c.id=a.cart_id where c.public_id=%s and a.stripe_session_id=%s",
            (cart_id, session_id),
        )
        if not attempt:
            raise ValueError("Order confirmation not found")
        await self.reconcile(await self.session(attempt))
        # Only this cart's owner receives a minimal summary, never PII through this endpoint.
        order = await self.db.fetch_one(
            "select o.order_number,o.payment_status,o.total_minor,o.currency from orders o join checkout_attempts a on a.order_id=o.id where a.id=%s",
            (attempt["id"],),
        )
        return order or {"payment_status": "pending"}


def validate_paid_session(session, snapshot):
    details = session.get("total_details") or {}
    shipping = next(
        (
            option
            for option in snapshot["shipping"]
            if option["amount_minor"] == details.get("amount_shipping")
        ),
        None,
    )
    tax = details.get("amount_tax", 0)
    if (
        session.get("currency") != "usd"
        or session.get("amount_subtotal") != snapshot["subtotal"]
        or not shipping
        or tax < 0
        or details.get("amount_discount", 0) != 0
        or session.get("amount_total") != snapshot["subtotal"] + shipping["amount_minor"] + tax
    ):
        raise ValueError("Checkout totals do not match the order snapshot")
    collected = session.get("collected_information") or {}
    recipient = collected.get("shipping_details") or session.get("shipping_details") or {}
    customer = session.get("customer_details") or {}
    address = recipient.get("address") or {}
    name = recipient.get("name")
    if (
        not customer.get("email")
        or not name
        or address.get("country") != "US"
        or not all(address.get(key) for key in ("line1", "city", "state", "postal_code"))
    ):
        raise ValueError("Checkout customer or US shipping address is incomplete")
    # Expanded shipping rate distinguishes methods even if admin sets identical prices.
    rate = (session.get("shipping_cost") or {}).get("shipping_rate")
    if isinstance(rate, dict):
        method = (rate.get("metadata") or {}).get("method")
        shipping = next(
            (
                option
                for option in snapshot["shipping"]
                if option["id"] == method
                and option["amount_minor"] == details.get("amount_shipping")
            ),
            None,
        )
        if not shipping:
            raise ValueError("Unknown shipping method")
        if snapshot.get("selected_shipping") and method != snapshot["selected_shipping"]:
            raise ValueError("Shipping method does not match the order snapshot")
    return shipping, {"email": customer["email"], "name": name}, address


def payment_method_label(session):
    payment_intent = session.get("payment_intent") or {}
    if not isinstance(payment_intent, dict):
        return "Card"
    charge = payment_intent.get("latest_charge") or {}
    if not isinstance(charge, dict):
        return "Card"
    details = charge.get("payment_method_details") or {}
    if not isinstance(details, dict):
        return "Card"
    method = details.get("type") or "card"
    if method == "card":
        card = details.get("card") or {}
        if isinstance(card, dict) and card.get("brand") and card.get("last4"):
            return f"Card · {str(card['brand']).title()} ending in {card['last4']}"
        return "Card"
    return str(method).replace("_", " ").title()
