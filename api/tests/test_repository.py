from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

from app.repository import CatalogRepository


def test_legacy_gallery_back_query_escapes_python_format_wildcards() -> None:
    database = AsyncMock()
    asyncio.run(CatalogRepository(database).get_blank_catalog_asset("premium-guys-tee", "black", "back"))

    sql, params = database.fetch_one.call_args.args
    formatted = sql % params
    assert "%/gallery-3.%" in formatted
