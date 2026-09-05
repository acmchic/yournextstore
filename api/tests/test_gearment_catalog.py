from __future__ import annotations

import json

import pytest

from app.gearment.sync import money_to_minor, normalize_variant
from app.gearment.web_catalog import parse_product_page, taxonomy_from_category_url


def remix_page(data: dict) -> str:
    context = {
        "state": {
            "loaderData": {"routes/($lang).catalog.product.$id": {"response": {"data": data}}}
        }
    }
    return f"<html><script>window.__remixContext = {json.dumps(context)};</script></html>"


def test_money_to_minor_is_exact() -> None:
    assert money_to_minor({"currency_code": "USD", "units": "13", "nanos": 750_000_000}) == (
        1375,
        "USD",
    )
    assert money_to_minor({"currency_code": "USD", "units": "6", "nanos": 75}) == (
        675,
        "USD",
    )
    with pytest.raises(ValueError, match="sub-cent"):
        money_to_minor({"currency_code": "USD", "units": 1, "nanos": 1_000_000})


def test_normalizes_website_variant_shape() -> None:
    row = normalize_variant(
        {
            "variantId": "GM1",
            "sku": "CG1717-BLK-S",
            "price": {"currencyCode": "USD", "units": "13", "nanos": 0},
            "priceRecommend": {"currencyCode": "USD", "units": "15", "nanos": 0},
            "option1": {"name": "Black", "code": "black", "value": "25282a"},
            "option2": {"name": "S", "code": "s"},
            "stockStatus": 1,
        }
    )
    assert row["id"] == "GM1"
    assert row["color_code"] == "black"
    assert row["size"] == "S"
    assert row["recommended_minor"] == 1500


def test_parses_structured_product_page() -> None:
    page = remix_page(
        {
            "productId": "CG1717",
            "shortUrl": "dyed-heavyweight-t-shirt-1717",
            "name": "Comfort Colors - 1717",
            "description": "<span>Ring-spun cotton<br>Relaxed fit</span>",
            "sizeGuidelines": "<table><tr><td>Size chart</td><td>S</td></tr><tr><td>Body Length</td><td>26</td></tr></table>",
            "shippingPolicies": [{"name": "US Domestic"}],
            "fileGuidelines": "<table><tr><td>Front</td><td>4200 x 4800 px</td></tr></table>",
            "designKits": [{"locationCode": "front", "designAreaX": 33}],
            "images": [{"url": "https://example.com/front.png", "tag": "front"}],
        }
    )
    parsed = parse_product_page(
        page, "https://gearment.com/catalog/product/dyed-heavyweight-t-shirt-1717"
    )
    assert parsed["product_id"] == "CG1717"
    assert parsed["description"] == "Ring-spun cotton\nRelaxed fit"
    assert parsed["size_chart"]["rows"][1] == ["Body Length", "26"]
    assert parsed["artwork_guideline"]["design_kits"][0]["designAreaX"] == 33


def test_taxonomy_from_category_url() -> None:
    assert taxonomy_from_category_url("https://gearment.com/catalog/category/men-t-shirts") == (
        "men",
        "t-shirts",
    )
    assert taxonomy_from_category_url("https://gearment.com/catalog/category/home-living-mugs") == (
        "home-living",
        "mugs",
    )
