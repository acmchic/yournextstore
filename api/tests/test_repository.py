from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.repository import CatalogRepository


def test_legacy_gallery_back_query_escapes_python_format_wildcards() -> None:
    database = AsyncMock()
    asyncio.run(CatalogRepository(database).get_blank_catalog_asset("premium-guys-tee", "black", "back"))

    sql, params = database.fetch_one.call_args.args
    formatted = sql % params
    assert "%/gallery-3.%" in formatted


def test_model_media_fallback_skips_registered_templates() -> None:
    database = AsyncMock()
    database.fetch_one.side_effect = [
        {
            "id": 1,
            "public_id": "prd-1",
            "slug": "pugkin",
            "title": "Pugkin",
            "description": "Design",
            "brand": "TeeBravo",
            "product_condition": "new",
            "seo_title": None,
            "seo_description": None,
            "created_at": "2026-09-18",
            "updated_at": "2026-09-18",
            "design_slug": "pugkin",
            "alt_text": None,
            "design_checksum": "checksum",
        },
        {"catalog": "hoodie", "default_color": "black", "default_color_name": "Black"},
    ]
    database.fetch_all.side_effect = [
        [
            {
                "catalog_variant_public_id": "cv-1",
                "sku": "SKU",
                "price_minor": 4299,
                "compare_at_minor": 5675,
                "currency": "USD",
                "catalog": "hoodie",
                "catalog_name": "Hoodie",
                "provider": "manual",
                "color": "black",
                "color_name": "Black",
                "color_hex": "#29292A",
                "size": "M",
                "size_label": "M",
                "stock": 1,
            }
        ],
        [
            {
                "catalog": "hoodie",
                "color": "black",
                "style": style,
                "placement": "front",
                "renderer_version": "ai-model-v1:template",
            }
            for style in ("men", "women")
        ],
        [{"catalog": "hoodie", "department": "men"}],
    ]
    repository = CatalogRepository(database)
    repository.get_catalog_avatar_asset = AsyncMock(return_value=None)

    with patch("app.repository._local_model_mockup_path", return_value=Path("model.png")):
        product = asyncio.run(repository.get_product_detail("pugkin", catalog_slug="hoodie"))

    assert product is not None
    models = [media for media in product["media"] if media["style"] in {"men", "women"}]
    assert len(models) == 2
    assert {(media["style"], media["placement"]) for media in models} == {
        ("men", "front"),
        ("women", "front"),
    }
