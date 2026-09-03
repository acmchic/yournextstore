from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response
from fastapi.responses import FileResponse, RedirectResponse
from starlette.concurrency import run_in_threadpool

from app.cache import FileCache
from app.catalog import (
    build_catalog_render_job,
    canonical_image_path,
    parse_blank_image_path,
    parse_canonical_image_path,
    parse_placement,
    split_design_and_catalog,
)
from app.db import Database
from app.models import CartItemUpsert, ImageFormat, OrderCreate, ProductSummary
from app.public_ref import build_product_ref, parse_product_ref, product_public_id
from app.rendering.pipeline import render_blank_mockup, render_mockup
from app.repository import CatalogRepository
from app.settings import settings

database = Database(settings)
repository = CatalogRepository(database)
cache = FileCache(settings.cache_dir)


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await database.close()


app = FastAPI(title="POD Mockup API", version="0.1.0", lifespan=lifespan)


def get_repository() -> CatalogRepository:
    return repository


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
async def ready() -> dict[str, str]:
    try:
        await database.fetch_one("select 1 ready", ())
    except Exception as error:
        raise HTTPException(status_code=503, detail="MySQL unavailable") from error
    return {"status": "ready"}


@app.get("/v1/store")
async def get_store() -> dict[str, object]:
    return {
        "name": "Your Next Store",
        "currency": "USD",
        "locale": "en-US",
        "settings": {"enabled_tools": {"blog": False, "contact_form": True}},
    }


@app.get("/v1/catalogs")
async def list_catalogs(repo: Annotated[CatalogRepository, Depends(get_repository)]):
    return {"data": await repo.list_catalogs()}


@app.get("/v1/products")
async def browse_products(
    limit: Annotated[int, Query(ge=1, le=100)] = 24,
    offset: Annotated[int, Query(ge=0)] = 0,
    q: str | None = None,
    catalog: str | None = None,
    collection: str | None = None,
    repo: CatalogRepository = Depends(get_repository),  # noqa: B008
):
    return await repo.browse_products(
        limit=limit, offset=offset, catalog=catalog, collection=collection, query=q
    )


@app.get("/v1/collections")
async def list_collections(repo: Annotated[CatalogRepository, Depends(get_repository)]):
    return {"data": await repo.list_collections()}


@app.get("/v1/collections/{slug}")
async def get_collection(slug: str, repo: Annotated[CatalogRepository, Depends(get_repository)]):
    collection = await repo.get_collection(slug)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection


@app.get("/v1/carts/{cart_id}")
async def get_cart(cart_id: str, repo: Annotated[CatalogRepository, Depends(get_repository)]):
    cart = await repo.get_cart(cart_id)
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    return cart


@app.put("/v1/carts/{cart_id}/items")
async def update_cart(
    cart_id: str,
    body: CartItemUpsert,
    repo: Annotated[CatalogRepository, Depends(get_repository)],
):
    try:
        return await repo.upsert_cart_item(
            public_id=None if cart_id == "new" else cart_id,
            variant_id=body.variant_id,
            quantity=body.quantity,
            mode=body.mode,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/v1/orders", status_code=201)
async def create_order(
    body: OrderCreate,
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=8)],
    repo: Annotated[CatalogRepository, Depends(get_repository)],
):
    try:
        return await repo.create_order(
            cart_id=body.cart_id,
            email=body.email,
            address=body.shipping_address.model_dump(),
            idempotency_key=idempotency_key,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get("/img/blank/{filename}")
async def render_blank_image(
    filename: str,
    width: Annotated[int, Query(ge=120)] = 1500,
):
    try:
        base_source, image_format = parse_blank_image_path(filename, settings)
        image_bytes = await run_in_threadpool(
            render_blank_mockup,
            base_source,
            width=min(width, settings.max_width),
            image_format=image_format,
            settings=settings,
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return Response(
        image_bytes,
        media_type=_media_type(image_format),
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@app.get("/img/{design_and_catalog:path}")
async def render_catalog_image(
    design_and_catalog: str,
    catalog: str | None = None,
    pos: str = "front",
    width: Annotated[int, Query(ge=120)] = 1500,
    format: ImageFormat = "webp",
):
    try:
        is_canonical = catalog is None and Path(design_and_catalog).suffix.lower() in {
            ".jpeg",
            ".jpg",
            ".png",
            ".webp",
        }
        if is_canonical:
            design_path, resolved_catalog, placement, style, resolved_format = (
                parse_canonical_image_path(design_and_catalog, settings)
            )
        else:
            design_path, resolved_catalog = split_design_and_catalog(design_and_catalog, catalog)
            placement = parse_placement(pos)
            style = "flat"
            resolved_format = format
        job = build_catalog_render_job(
            design_path=design_path,
            catalog=resolved_catalog,
            placement=placement,
            style=style,
            settings=settings,
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    if not is_canonical:
        canonical_path = canonical_image_path(
            design_path=design_path,
            catalog=resolved_catalog,
            placement=placement,
            style=style,
            image_format=resolved_format,
            settings=settings,
        )
        if canonical_path:
            location = f"{canonical_path}?width={width}" if width != 1500 else canonical_path
            return RedirectResponse(location, status_code=308)

    safe_width = min(width, settings.max_width)
    cache_key = cache.key_for(job, width=safe_width, image_format=resolved_format)
    cache_path = cache.path_for(cache_key, resolved_format)
    media_type = _media_type(resolved_format)
    if cache_path.exists():
        return FileResponse(
            cache_path,
            media_type=media_type,
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Mockup-Cache": "hit",
            },
        )

    try:
        image_bytes = await run_in_threadpool(
            render_mockup,
            job,
            width=safe_width,
            image_format=resolved_format,
            settings=settings,
        )
    except Exception as error:
        raise HTTPException(status_code=422, detail=f"Could not render mockup: {error}") from error
    cache_path.write_bytes(image_bytes)
    return Response(
        image_bytes,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable", "X-Mockup-Cache": "miss"},
    )


@app.get("/v1/products/{slug}")
async def get_product(slug: str, repo: Annotated[CatalogRepository, Depends(get_repository)]):
    try:
        product = await repo.get_product_detail(slug)
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"MySQL unavailable: {error}") from error
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.get("/v1/mockups/render")
@app.get("/m")
async def render_product_mockup(
    product_id: Annotated[str | None, Query(min_length=1)] = None,
    artwork_id: Annotated[str | None, Query(min_length=1)] = None,
    template_id: Annotated[str | None, Query(min_length=1)] = None,
    variant_id: str | None = None,
    p_id: Annotated[str | None, Query(min_length=1)] = None,
    p: Annotated[str | None, Query(min_length=1)] = None,
    a_id: Annotated[str | None, Query(min_length=1)] = None,
    a: Annotated[str | None, Query(min_length=1)] = None,
    t_id: Annotated[str | None, Query(min_length=1)] = None,
    t: Annotated[str | None, Query(min_length=1)] = None,
    v_id: str | None = None,
    v: str | None = None,
    width: Annotated[int | None, Query(ge=120)] = None,
    w: Annotated[int | None, Query(ge=120)] = None,
    format: ImageFormat | None = None,
    f: ImageFormat | None = None,
    refresh: bool = False,
    r: bool = False,
    repo: CatalogRepository = Depends(get_repository),  # noqa: B008
):
    resolved_template_id = template_id or t_id or t or "cc1717-black-front"
    resolved_variant_id = variant_id or v_id or v
    product = await _resolve_public_product(
        repo=repo,
        product_ref=product_id or p_id or p,
    )
    resolved_product_id = product.id
    resolved_artwork_id = artwork_id or a_id or a or f"product:{resolved_product_id}:artwork"
    resolved_width = width or w or settings.default_width
    resolved_format = format or f or settings.default_format
    resolved_refresh = refresh or r
    safe_width = min(resolved_width, settings.max_width)
    try:
        job = await repo.get_render_job(
            product_id=resolved_product_id,
            artwork_id=resolved_artwork_id,
            template_id=resolved_template_id,
            variant_id=resolved_variant_id,
        )
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"MySQL unavailable: {error}") from error

    if not job:
        raise HTTPException(status_code=404, detail="Mockup render job not found")

    cache_key = cache.key_for(job, width=safe_width, image_format=resolved_format)
    cache_path = cache.path_for(cache_key, resolved_format)
    media_type = _media_type(resolved_format)

    if cache_path.exists() and not resolved_refresh:
        return FileResponse(
            cache_path,
            media_type=media_type,
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Mockup-Cache": "hit",
            },
        )

    try:
        image_bytes = await run_in_threadpool(
            render_mockup,
            job,
            width=safe_width,
            image_format=resolved_format,
            settings=settings,
        )
    except ImportError as error:
        raise HTTPException(
            status_code=503, detail=f"Renderer dependency missing: {error}"
        ) from error
    except Exception as error:
        raise HTTPException(status_code=422, detail=f"Could not render mockup: {error}") from error

    cache_path.write_bytes(image_bytes)
    return Response(
        image_bytes,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable", "X-Mockup-Cache": "miss"},
    )


@app.get("/m/{product_ref}")
async def render_product_mockup_by_ref(
    product_ref: str,
    artwork_id: Annotated[str | None, Query(min_length=1)] = None,
    template_id: Annotated[str | None, Query(min_length=1)] = None,
    variant_id: str | None = None,
    a_id: Annotated[str | None, Query(min_length=1)] = None,
    a: Annotated[str | None, Query(min_length=1)] = None,
    t_id: Annotated[str | None, Query(min_length=1)] = None,
    t: Annotated[str | None, Query(min_length=1)] = None,
    v_id: str | None = None,
    v: str | None = None,
    width: Annotated[int | None, Query(ge=120)] = None,
    w: Annotated[int | None, Query(ge=120)] = None,
    format: ImageFormat | None = None,
    f: ImageFormat | None = None,
    refresh: bool = False,
    r: bool = False,
    repo: CatalogRepository = Depends(get_repository),  # noqa: B008
):
    return await render_product_mockup(
        product_id=product_ref,
        artwork_id=artwork_id,
        template_id=template_id,
        variant_id=variant_id,
        a_id=a_id,
        a=a,
        t_id=t_id,
        t=t,
        v_id=v_id,
        v=v,
        width=width,
        w=w,
        format=format,
        f=f,
        refresh=refresh,
        r=r,
        repo=repo,
    )


async def _resolve_public_product(
    *,
    repo: CatalogRepository,
    product_ref: str | None,
) -> ProductSummary:
    parsed = parse_product_ref(product_ref)
    if not parsed.slug_ref:
        raise HTTPException(status_code=422, detail="/m/{slug-publicid} is required")

    try:
        candidates = await repo.find_products_by_slug_ref(parsed.slug_ref)
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"MySQL unavailable: {error}") from error

    if not candidates:
        raise HTTPException(status_code=404, detail="Product not found")

    for product in candidates:
        expected_public_id = product_public_id(
            secret=settings.url_signing_secret,
            product_id=product.id,
            slug=product.slug,
        )
        if parsed.public_id == expected_public_id:
            return product

    raise HTTPException(status_code=404, detail="Product not found")


@app.get("/v1/mockups/ref/{slug}")
async def get_public_mockup_ref(
    slug: str,
    template_id: str | None = None,
    t: str | None = None,
    variant_id: str | None = None,
    v: str | None = None,
    x_mockup_admin_key: Annotated[str | None, Header(alias="X-Mockup-Admin-Key")] = None,
    repo: CatalogRepository = Depends(get_repository),  # noqa: B008
):
    if not settings.signing_admin_key or x_mockup_admin_key != settings.signing_admin_key:
        raise HTTPException(status_code=404, detail="Not found")
    product = await repo.get_product_by_slug(slug)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    resolved_template_id = template_id or t or product.default_template_id or "cc1717-black-front"
    product_ref = build_product_ref(
        secret=settings.url_signing_secret,
        product_id=product.id,
        slug=product.slug,
    )
    return {
        "path": f"/m/{product_ref}",
        "url": f"/m/{product_ref}?t={resolved_template_id}",
        "product_ref": product_ref,
        "template_id": resolved_template_id,
    }


def _media_type(image_format: ImageFormat) -> str:
    if image_format == "webp":
        return "image/webp"
    if image_format == "jpeg":
        return "image/jpeg"
    return "image/png"
