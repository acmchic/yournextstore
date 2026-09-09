from __future__ import annotations

import json

import pytest
from PIL import Image

from app.gearment.sync import (
    DEFAULT_IMPORT_COLOR_CODES,
    catalog_asset_category,
    catalog_display_name,
    download_asset,
    filter_import_colors,
    money_to_minor,
    normalize_variant,
)


def test_catalog_display_name_removes_provider_number() -> None:
    assert catalog_display_name("Jersey Long Sleeve Tee 3501") == "Jersey Long Sleeve Tee"
    assert catalog_display_name("jersey-long-sleeve-tee-3501") == "jersey-long-sleeve-tee"
    assert (
        catalog_display_name("BELLA + CANVAS - Youth Unisex Jersey Tee - 3001Y")
        == "Youth Unisex Jersey Tee"
    )


def test_catalog_asset_category_groups_departments() -> None:
    assert catalog_asset_category([{"department": "men"}, {"department": "women"}]) == "unisex"
    assert catalog_asset_category([{"department": "kids"}]) == "kids"


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


def test_filters_variants_to_default_us_colors() -> None:
    variants = [
        {"color_code": "BLACK", "color": "Black"},
        {"color_code": "sport-grey", "color": "Sport Grey"},
        {"color_code": "MAROON", "color": "Maroon"},
    ]
    filtered = filter_import_colors(variants)

    assert DEFAULT_IMPORT_COLOR_CODES == (
        "black",
        "white",
        "navy",
        "red",
        "royal",
        "sport-grey",
    )
    assert [row["color_code"] for row in filtered] == ["BLACK", "sport-grey"]


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
    assert parsed["material_details"] == {"items": ["Ring-spun cotton", "Relaxed fit"]}
    assert parsed["size_chart"]["rows"][1] == ["Body Length", "26"]
    assert parsed["artwork_guideline"]["design_kits"][0]["designAreaX"] == 33


def test_parses_markdown_size_guideline_and_singular_key() -> None:
    page = remix_page(
        {
            "productId": "G5000",
            "name": "Gildan - Heavy Cotton T-Shirt - 5000",
            "sizeGuideline": "| Size chart | S | M |\n| --- | --- | --- |\n| Body Length | 28 | 29 |",
        }
    )
    parsed = parse_product_page(page, "https://gearment.com/catalog/product/classic-t-shirt")
    assert parsed["size_chart"]["rows"] == [
        ["Size chart", "S", "M"],
        ["Body Length", "28", "29"],
    ]


def test_reuses_local_catalog_asset_without_downloading(tmp_path, monkeypatch) -> None:
    target_stem = tmp_path / "mockup" / "front-1"
    target = target_stem.with_suffix(".png")
    target.parent.mkdir()
    Image.new("RGB", (4, 3), "white").save(target)

    def fail_download(*_args, **_kwargs):
        raise AssertionError("the existing local asset should be reused")

    monkeypatch.setattr("app.gearment.sync.urllib.request.urlopen", fail_download)
    asset = download_asset("https://example.com/front.png", target_stem, refresh=False)

    assert asset["local_path"] == target.as_posix()
    assert asset["width"] == 4
    assert asset["height"] == 3


def test_does_not_download_missing_asset_by_default(tmp_path) -> None:
    with pytest.raises(FileNotFoundError, match="--refresh-assets"):
        download_asset("https://example.com/missing.png", tmp_path / "front-1", refresh=False)


def test_taxonomy_from_category_url() -> None:
    assert taxonomy_from_category_url("https://gearment.com/catalog/category/men-t-shirts") == (
        "men",
        "t-shirts",
    )
    assert taxonomy_from_category_url("https://gearment.com/catalog/category/home-living-mugs") == (
        "home-living",
        "mugs",
    )
