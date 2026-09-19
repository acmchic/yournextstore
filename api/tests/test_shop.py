import asyncio
from unittest.mock import AsyncMock

from app.repository import (
    CatalogRepository,
    _listing_catalog_at,
    _public_catalog_taxonomy,
    _rotate_listing_color,
)


def catalog(slug, department, kind):
    return {"slug": slug, "taxonomy": [{"department": department, "type_slug": kind}]}


def test_public_taxonomy_separates_unisex_from_women_only_catalogs():
    shared = [
        {"department": "men", "type_slug": "t-shirts", "type_label": "T-shirts"},
        {"department": "women", "type_slug": "t-shirts", "type_label": "T-shirts"},
    ]
    women_only = [{"department": "women", "type_slug": "t-shirts", "type_label": "T-shirts"}]

    assert [row["department"] for row in _public_catalog_taxonomy(shared)] == ["unisex"]
    assert [row["department"] for row in _public_catalog_taxonomy(women_only)] == ["women"]


def test_listing_colors_rotate_across_available_variants():
    product = {
        "variants": [
            {"color": "navy", "color_name": "Navy", "stock": 10},
            {"color": "red", "color_name": "Red", "stock": 10},
            {"color": "white", "color_name": "White", "stock": 10},
        ]
    }

    assert _rotate_listing_color(product, 0)["default_color"] == "navy"
    assert _rotate_listing_color(product, 1)["default_color"] == "red"
    assert _rotate_listing_color(product, 2)["default_color"] == "white"
    assert _rotate_listing_color(product, 3)["default_color"] == "navy"


def test_listing_catalogs_rotate_without_named_catalog_rules():
    catalogs = [{"slug": "tee"}, {"slug": "hoodie"}, {"slug": "sweatshirt"}]

    assert [_listing_catalog_at(catalogs, index) for index in range(5)] == [
        "tee",
        "hoodie",
        "sweatshirt",
        "tee",
        "hoodie",
    ]


def test_department_pagination_filters_before_loading_details():
    db = AsyncMock()
    db.fetch_one.return_value = {"count": 45}
    db.fetch_all.return_value = [{"slug": "design-two"}]
    repo = CatalogRepository(db)
    repo.list_catalogs = AsyncMock(
        return_value=[
            catalog("unisex-tee", "unisex", "t-shirts"),
            catalog("women-tee", "women", "t-shirts"),
            catalog("mens-hoodie", "men", "hoodies"),
        ]
    )
    repo.get_product_detail = AsyncMock(return_value={"id": "design-two"})
    result = asyncio.run(
        repo.browse_shop(limit=24, offset=24, department="unisex", product_type="t-shirts")
    )
    assert result["meta"] == {"count": 45, "limit": 24, "offset": 24}
    assert "pc_selected" in db.fetch_all.call_args.args[0]
    assert db.fetch_all.call_args.args[1] == ("unisex-tee", 24, 24)
    repo.get_product_detail.assert_awaited_once_with("design-two", catalog_slug="unisex-tee")


def test_shop_listing_returns_each_design_once_and_rotates_catalogs():
    db = AsyncMock()
    db.fetch_one.return_value = {"count": 3}
    db.fetch_all.return_value = [
        {"slug": "design-one"},
        {"slug": "design-two"},
        {"slug": "design-three"},
    ]
    repo = CatalogRepository(db)
    repo.list_catalogs = AsyncMock(
        return_value=[
            catalog("tee", "unisex", "t-shirts"),
            catalog("hoodie", "unisex", "hoodies"),
            catalog("sweatshirt", "unisex", "sweatshirts"),
        ]
    )
    repo.get_product_detail = AsyncMock(side_effect=lambda slug, catalog_slug: {"id": slug, "catalog": catalog_slug})

    result = asyncio.run(repo.browse_shop(limit=24, offset=0, department="unisex"))

    assert [item["id"] for item in result["data"]] == ["design-one", "design-two", "design-three"]
    assert "cross join catalogs" not in db.fetch_all.call_args.args[0]
    assert "select p.slug" in db.fetch_all.call_args.args[0]
    assert repo.get_product_detail.await_args_list[0].kwargs == {"catalog_slug": "tee"}
    assert repo.get_product_detail.await_args_list[1].kwargs == {"catalog_slug": "hoodie"}
    assert repo.get_product_detail.await_args_list[2].kwargs == {"catalog_slug": "sweatshirt"}


def test_catalog_filter_selects_one_body_within_department():
    db = AsyncMock()
    db.fetch_one.return_value = {"count": 12}
    db.fetch_all.return_value = []
    repo = CatalogRepository(db)
    repo.list_catalogs = AsyncMock(
        return_value=[
            catalog("ladies-t-shirt", "women", "t-shirts"),
            catalog("women-v-neck-t-shirt", "women", "t-shirts"),
        ]
    )

    asyncio.run(
        repo.browse_shop(
            limit=24,
            offset=0,
            department="women",
            product_type="t-shirts",
            catalog_slug="women-v-neck-t-shirt",
        )
    )

    assert db.fetch_all.call_args.args[1] == ("women-v-neck-t-shirt", 24, 0)


def test_unknown_department_returns_empty_without_product_queries():
    db = AsyncMock()
    repo = CatalogRepository(db)
    repo.list_catalogs = AsyncMock(return_value=[catalog("tee", "men", "t-shirts")])
    result = asyncio.run(repo.browse_shop(limit=24, offset=0, department="invalid"))
    assert result["data"] == []
    db.fetch_all.assert_not_awaited()


def test_public_policies_query_excludes_drafts():
    db = AsyncMock()
    db.fetch_all.return_value = []
    asyncio.run(CatalogRepository(db).list_legal_pages())
    assert "where published=true" in db.fetch_all.call_args.args[0]
    assert db.fetch_all.call_args.args[1] == ()


def test_draft_collection_cannot_expose_products():
    db = AsyncMock()
    db.fetch_one.return_value = None
    repo = CatalogRepository(db)
    repo.list_catalogs = AsyncMock(return_value=[catalog("tee", "men", "t-shirts")])
    result = asyncio.run(repo.browse_shop(limit=24, offset=0, collection="draft"))
    assert result["data"] == []
    assert "status='active'" in db.fetch_one.call_args.args[0]
    db.fetch_all.assert_not_awaited()
