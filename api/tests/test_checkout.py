import asyncio
import copy
import hashlib
import hmac
import json
import os
import time
import uuid
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.checkout import CheckoutService, validate_paid_session
from app.db import Database
from app.repository import CatalogRepository
from app.settings import settings
from app.shipping import delivery_settings, render_policy, shipping_options

RATES = {
    "standard_first_minor": 500,
    "standard_additional_minor": 300,
    "express_first_minor": 1100,
    "express_additional_minor": 400,
}


@pytest.mark.parametrize(
    "quantity,expected", [(0, []), (1, [500, 1100]), (2, [800, 1500]), (3, [1100, 1900])]
)
def test_shipping_by_total_quantity(quantity, expected):
    assert [option["amount_minor"] for option in shipping_options(RATES, quantity)] == expected


def test_policy_rates_are_resolved_from_current_settings():
    text = (
        "Standard {{standard_first}}, then {{standard_additional}}. "
        "{{processing_time}}; transit {{standard_transit}}."
    )
    config = {
        **RATES,
        "details_json": "{}",
        "processing_min_business_days": 2,
        "processing_max_business_days": 4,
        "standard_transit_min_business_days": 5,
        "standard_transit_max_business_days": 7,
        "express_transit_min_business_days": 2,
        "express_transit_max_business_days": 3,
    }
    assert render_policy(text, config) == (
        "Standard $5.00, then $3.00. 2–4 business days; transit 5–7 business days."
    )
    assert "$6.00" in render_policy(text, {**config, "standard_first_minor": 600})


def test_pdp_delivery_requires_admin_toggle_and_complete_ranges():
    config = {
        "pdp_assurance_enabled": True,
        "processing_min_business_days": 2,
        "processing_max_business_days": 4,
        "standard_transit_min_business_days": 5,
        "standard_transit_max_business_days": 7,
        "express_transit_min_business_days": 2,
        "express_transit_max_business_days": 3,
    }
    assert delivery_settings(config)["enabled"] is True
    assert delivery_settings({**config, "standard_transit_max_business_days": None})[
        "enabled"
    ] is False
    assert delivery_settings({**config, "pdp_assurance_enabled": False})["enabled"] is False


def paid_session(attempt_id="attempt", subtotal=2000, quantity=2):
    shipping = shipping_options(RATES, quantity)[1]["amount_minor"]
    return {
        "id": "cs_test_fixture",
        "metadata": {"attempt_id": attempt_id},
        "status": "complete",
        "payment_status": "paid",
        "currency": "usd",
        "amount_subtotal": subtotal,
        "amount_total": subtotal + shipping,
        "total_details": {"amount_shipping": shipping, "amount_tax": 0, "amount_discount": 0},
        "shipping_cost": {"shipping_rate": {"metadata": {"method": "express"}}},
        "customer_details": {"email": "checkout-test@example.com"},
        "payment_intent": "pi_test_fixture",
        "collected_information": {
            "shipping_details": {
                "name": "Checkout Test",
                "address": {
                    "line1": "1 Test Way",
                    "line2": "Unit 2",
                    "city": "Test City",
                    "state": "CA",
                    "postal_code": "90210",
                    "country": "US",
                },
            }
        },
    }


def test_confirmation_by_session_does_not_require_cart_cookie():
    async def scenario():
        db = AsyncMock()
        db.fetch_one.side_effect = [
            {"id": "attempt-fixture"},
            {
                "order_number": "TB-260926-TEST",
                "payment_status": "paid",
                "total_minor": 3500,
                "currency": "USD",
            },
        ]
        service = CheckoutService(db, settings)
        service.session = AsyncMock(return_value={"id": "cs_test_fixture"})
        service.reconcile = AsyncMock()

        result = await service.confirmation_by_session("cs_test_fixture")

        assert result["payment_status"] == "paid"
        assert result["order_number"] == "TB-260926-TEST"
        assert "stripe_session_id=%s" in db.fetch_one.await_args_list[0].args[0]
        service.reconcile.assert_awaited_once_with({"id": "cs_test_fixture"})

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "field,value", [("currency", "eur"), ("amount_total", 1), ("amount_subtotal", 1)]
)
def test_paid_totals_must_match_snapshot(field, value):
    session = paid_session()
    session[field] = value
    with pytest.raises(ValueError):
        validate_paid_session(session, {"subtotal": 2000, "shipping": shipping_options(RATES, 2)})


def test_us_address_and_shipping_method_required():
    session = paid_session()
    session["collected_information"]["shipping_details"]["address"]["country"] = "CA"
    with pytest.raises(ValueError):
        validate_paid_session(session, {"subtotal": 2000, "shipping": shipping_options(RATES, 2)})


def test_hosted_checkout_uses_selected_shipping_rate():
    async def scenario():
        created = AsyncMock(
            return_value={
                "id": "cs_test",
                "status": "open",
                "url": "https://checkout.stripe.com/test",
            }
        )
        client = SimpleNamespace(
            v1=SimpleNamespace(
                checkout=SimpleNamespace(sessions=SimpleNamespace(create_async=created))
            )
        )
        database = SimpleNamespace(execute=AsyncMock())
        service = CheckoutService(database, settings)
        service.stripe = lambda: client
        attempt = {
            "id": "attempt-test",
            "stripe_session_id": None,
            "snapshot_json": json.dumps(
                {
                    "automatic_tax": False,
                    "success_url": "https://teebravo.com/checkout/success?session_id={CHECKOUT_SESSION_ID}",
                    "cancel_url": "https://teebravo.com/checkout",
                    "subtotal": 2000,
                    "items": [
                        {
                            "title": "Test shirt",
                            "catalog_name": "Classic T-shirt",
                            "color_name": "Black",
                            "size_code": "M",
                            "quantity": 2,
                            "price_minor": 1000,
                            "image_url": "https://teebravo.com/img/test.webp",
                        }
                    ],
                    "shipping": shipping_options(RATES, 2),
                    "selected_shipping": "express",
                }
            ),
        }

        await service.session(attempt)

        params, request_options = created.await_args.args
        assert params["payment_method_types"] == ["card"]
        assert params["billing_address_collection"] == "auto"
        assert params["shipping_address_collection"] == {"allowed_countries": ["US"]}
        assert params["line_items"][0]["price_data"]["product_data"]["name"] == (
            "Test shirt — Classic T-shirt"
        )
        assert params["line_items"][0]["price_data"]["product_data"]["description"] == "Black · M"
        assert params["line_items"][0]["price_data"]["product_data"]["images"] == [
            "https://teebravo.com/img/test.webp"
        ]
        assert [
            option["shipping_rate_data"]["fixed_amount"]["amount"]
            for option in params["shipping_options"]
        ] == [1500]
        assert request_options == {"idempotency_key": "attempt-test"}

    asyncio.run(scenario())
    session = paid_session()
    session["shipping_cost"]["shipping_rate"]["metadata"]["method"] = "unknown"
    with pytest.raises(ValueError):
        validate_paid_session(session, {"subtotal": 2000, "shipping": shipping_options(RATES, 2)})


def test_webhook_signature_is_verified_before_retrieval(monkeypatch):
    from app import main

    secret = "whsec_test_fixture"
    monkeypatch.setattr(main, "settings", replace(settings, stripe_webhook_secret=secret))
    session = paid_session()
    retrieve = AsyncMock(return_value=session)
    reconcile = AsyncMock()
    service = SimpleNamespace(
        stripe=lambda: SimpleNamespace(
            v1=SimpleNamespace(
                checkout=SimpleNamespace(sessions=SimpleNamespace(retrieve_async=retrieve))
            )
        ),
        reconcile=reconcile,
    )
    monkeypatch.setattr(main, "checkout", service)
    payload = json.dumps(
        {
            "id": "evt_test_fixture",
            "type": "checkout.session.completed",
            "data": {"object": {"id": session["id"]}},
        }
    ).encode()
    client = TestClient(main.app)
    assert (
        client.post(
            "/v1/stripe/webhook", content=payload, headers={"Stripe-Signature": "invalid"}
        ).status_code
        == 400
    )
    retrieve.assert_not_awaited()
    timestamp = int(time.time())
    signature = hmac.new(
        secret.encode(), str(timestamp).encode() + b"." + payload, hashlib.sha256
    ).hexdigest()
    assert (
        client.post(
            "/v1/stripe/webhook",
            content=payload,
            headers={"Stripe-Signature": f"t={timestamp},v1={signature}"},
        ).status_code
        == 200
    )
    reconcile.assert_awaited_once_with(session, "evt_test_fixture", "checkout.session.completed")


@pytest.mark.skipif(
    os.getenv("TEST_MYSQL") != "1", reason="Set TEST_MYSQL=1 for isolated local MySQL integration"
)
def test_mysql_cart_reservation_payment_dedup_and_snapshot():
    async def scenario():
        assert settings.mysql_host in ("127.0.0.1", "localhost"), "Integration test is local-only"
        database_name = "teebravo_checkout_test_" + uuid.uuid4().hex[:12]
        admin = Database(settings)
        await admin.execute(f"create database `{database_name}`")
        db = Database(replace(settings, mysql_database=database_name))
        try:
            for filename in ("001_schema.sql", "010_checkout_stripe_shipping.sql"):
                for statement in (
                    (Path(__file__).parents[1] / "mysql/init" / filename).read_text().split(";")
                ):
                    if statement.strip():
                        await db.execute(statement)
            await db.execute("alter table catalogs add column provider varchar(32) default 'test'")
            await db.execute(
                "insert into catalogs(id,public_id,slug,name,product_type) values (1,'catalog','test-tee','Test Tee','t-shirts')"
            )
            await db.execute(
                "insert into catalog_colors(id,catalog_id,slug,name) values (1,1,'black','Black')"
            )
            await db.execute(
                "insert into catalog_sizes(id,catalog_id,code,label) values (1,1,'M','M')"
            )
            await db.execute(
                "insert into catalog_variants(id,public_id,catalog_id,color_id,size_id,sku,default_price_minor,stock_quantity) values (1,'cv-test',1,1,1,'TEST',1000,10)"
            )
            await db.execute(
                "insert into designs(id,public_id,slug,name,source_path,checksum,width,height,status) values (1,'design','test','Test','test.png','test',100,100,'active')"
            )
            await db.execute(
                "insert into products(id,public_id,design_id,slug,title,status) values (1,'product',1,'test','Test','active')"
            )
            await db.execute(
                "insert into product_variants(id,public_id,product_id,catalog_variant_id,sku,price_minor) values (1,'pv-test',1,1,'PV-TEST',900)"
            )
            repo = CatalogRepository(db)
            cart = await repo.upsert_cart_item(
                public_id=None, variant_id="pv-test", quantity=2, mode="add"
            )
            assert (await repo.get_cart(cart["id"]))["subtotal_minor"] == 2000
            service = CheckoutService(
                db,
                replace(
                    settings,
                    stripe_secret_key="sk_test_fixture",
                    stripe_webhook_secret="whsec_fixture",
                ),
            )
            attempts = await asyncio.gather(
                service.prepare(cart["id"], "express"),
                service.prepare(cart["id"], "express"),
            )
            assert attempts[0]["id"] == attempts[1]["id"]
            assert (
                await db.fetch_one("select stock_quantity from catalog_variants where id=1", ())
            )["stock_quantity"] == 8
            with pytest.raises(ValueError, match="Checkout is in progress"):
                await repo.upsert_cart_item(
                    public_id=cart["id"], variant_id="pv-test", quantity=3, mode="set"
                )
            await db.execute("update checkout_settings set express_first_minor=9999 where id=1")
            session = paid_session(attempts[0]["id"])
            invalid = copy.deepcopy(session)
            invalid["amount_total"] = 1
            with pytest.raises(ValueError):
                await service.reconcile(invalid, "evt_bad")
            assert (await db.fetch_one("select count(*) n from stripe_events", ()))["n"] == 0
            await asyncio.gather(
                service.reconcile(session, "evt_paid"), service.reconcile(session, "evt_paid")
            )
            await service.reconcile(session, "evt_paid_second")
            order = await db.fetch_one("select * from orders", ())
            assert order["total_minor"] == 3500 and order["shipping_minor"] == 1500
            assert (await db.fetch_one("select count(*) n from orders", ()))["n"] == 1
            assert (await db.fetch_one("select count(*) n from customers", ()))["n"] == 1
            assert (
                await db.fetch_one("select region,postal_code,line2 from order_addresses", ())
            ) == {"region": "CA", "postal_code": "90210", "line2": "Unit 2"}
            assert await repo.get_cart(cart["id"]) is None
            cart2 = await repo.upsert_cart_item(
                public_id=None, variant_id="pv-test", quantity=3, mode="add"
            )
            attempt2 = await service.prepare(cart2["id"])
            expired = {
                "id": "cs_test_expired",
                "metadata": {"attempt_id": attempt2["id"]},
                "status": "expired",
            }
            await service.reconcile(expired, "evt_expired")
            await service.reconcile(expired, "evt_expired")
            assert (
                await db.fetch_one("select stock_quantity from catalog_variants where id=1", ())
            )["stock_quantity"] == 8
        finally:
            await db.close()
            await admin.execute(f"drop database `{database_name}`")
            await admin.close()

    asyncio.run(scenario())
