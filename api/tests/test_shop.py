import asyncio
from unittest.mock import AsyncMock

from app.repository import CatalogRepository


def catalog(slug, department, kind):
    return {"slug": slug, "taxonomy": [{"department": department, "type_slug": kind}]}


def test_department_pagination_filters_before_loading_details():
    db = AsyncMock()
    db.fetch_one.return_value = {"count": 45}
    db.fetch_all.return_value = [{"slug": "design-two", "catalog": "mens-tee"}]
    repo = CatalogRepository(db)
    repo.list_catalogs = AsyncMock(
        return_value=[
            catalog("mens-tee", "men", "t-shirts"),
            catalog("women-tee", "women", "t-shirts"),
            catalog("mens-hoodie", "men", "hoodies"),
        ]
    )
    repo.get_product_detail = AsyncMock(return_value={"id": "design-two"})
    result = asyncio.run(
        repo.browse_shop(limit=24, offset=24, department="men", product_type="t-shirts")
    )
    assert result["meta"] == {"count": 45, "limit": 24, "offset": 24}
    assert "pc_selected" in db.fetch_all.call_args.args[0]
    assert db.fetch_all.call_args.args[1] == ("mens-tee", 24, 24)
    repo.get_product_detail.assert_awaited_once_with("design-two", catalog_slug="mens-tee")


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
