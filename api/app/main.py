from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
from starlette.concurrency import run_in_threadpool

from app.cache import FileCache
from app.catalog import (
    build_catalog_render_job,
    canonical_image_path,
    parse_blank_image_path,
    parse_canonical_image_path,
    parse_placement,
    resolve_design_path,
    split_design_and_catalog,
)
from app.checkout import CheckoutService
from app.db import Database
from app.models import CartItemUpsert, ImageFormat, OrderCreate, ProductSummary
from app.product_media import parse_catalog_mockup_view
from app.public_ref import build_product_ref, parse_product_ref, product_public_id
from app.rendering.pipeline import render_blank_mockup, render_design_preview, render_mockup
from app.repository import CatalogRepository
from app.settings import settings
from app.shipping import delivery_settings, shipping_options

logger = logging.getLogger(__name__)

database = Database(settings)
repository = CatalogRepository(database)
checkout = CheckoutService(database, settings)
cache = FileCache(settings.cache_dir)
# Bounded striped locks prevent duplicate renders without retaining one lock per URL.
render_locks = [asyncio.Lock() for _ in range(64)]


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
        "name": "TeeBravo",
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


@app.get("/v1/shop")
async def browse_shop(
    repo: Annotated[CatalogRepository, Depends(get_repository)],
    limit: Annotated[int, Query(ge=1, le=48)] = 24,
    offset: Annotated[int, Query(ge=0)] = 0,
    department: str | None = None,
    product_type: str | None = None,
    catalog: str | None = None,
    collection: str | None = None,
):
    return await repo.browse_shop(
        limit=limit,
        offset=offset,
        department=department,
        product_type=product_type,
        catalog_slug=catalog,
        collection=collection,
    )


@app.get("/v1/legal-pages")
async def list_legal_pages(repo: Annotated[CatalogRepository, Depends(get_repository)]):
    return {"data": await repo.list_legal_pages()}


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


@app.get("/v1/shipping")
async def get_shipping(quantity: Annotated[int, Query(ge=0, le=9900)] = 1):
    config = await checkout.settings()
    return {
        "options": shipping_options(config, quantity),
        "rates": {
            key: config[key]
            for key in (
                "standard_first_minor",
                "standard_additional_minor",
                "express_first_minor",
                "express_additional_minor",
            )
        },
        "delivery": delivery_settings(config),
    }


@app.post("/v1/carts/{cart_id}/checkout")
async def start_checkout(
    cart_id: str,
    shipping_method: Annotated[Literal["standard", "express"], Query()] = "standard",
):
    try:
        return await checkout.start(cart_id, shipping_method)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@app.get("/v1/carts/{cart_id}/checkout-review")
async def checkout_review(cart_id: str):
    cart = await repository.get_cart(cart_id)
    if not cart:
        raise HTTPException(404, "Cart not found")
    attempt = await database.fetch_one(
        "select a.snapshot_json from checkout_attempts a join carts c on c.id=a.cart_id where c.public_id=%s and a.status in ('creating','open') limit 1",
        (cart_id,),
    )
    from app.shipping import decode

    if attempt:
        snapshot = decode(attempt["snapshot_json"])
        cart.update(
            {
                "subtotal_minor": snapshot["subtotal"],
                "items": [
                    {**item, "product_title": item["title"], "size": item["size_code"]}
                    for item in snapshot["items"]
                ],
                "shipping_options": snapshot["shipping"],
                "selected_shipping": snapshot.get("selected_shipping", "standard"),
                "locked": True,
            }
        )
    else:
        cart["shipping_options"] = shipping_options(
            await checkout.settings(), sum(item["quantity"] for item in cart["items"])
        )
        cart["locked"] = False
        cart["selected_shipping"] = "standard"
    return cart


@app.post("/v1/carts/{cart_id}/checkout/cancel")
async def cancel_checkout(cart_id: str):
    try:
        await checkout.cancel(cart_id)
        return {"ok": True}
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@app.get("/v1/carts/{cart_id}/confirmation")
async def checkout_confirmation(cart_id: str, session_id: str):
    try:
        return await checkout.confirmation(cart_id, session_id)
    except ValueError as error:
        raise HTTPException(404, str(error)) from error


@app.post("/v1/stripe/webhook")
async def stripe_webhook(request: Request):
    import stripe

    if not settings.stripe_webhook_secret:
        raise HTTPException(503, "Webhook is not configured")
    try:
        event = stripe.Webhook.construct_event(
            await request.body(),
            request.headers.get("stripe-signature", ""),
            settings.stripe_webhook_secret,
        )
    except (ValueError, stripe.SignatureVerificationError) as error:
        raise HTTPException(400, "Invalid webhook signature") from error
    if event["type"] in (
        "checkout.session.completed",
        "checkout.session.expired",
        "checkout.session.async_payment_succeeded",
    ):
        # Retrieve authoritative current state, including rate metadata, before fulfillment.
        session = await checkout.stripe().v1.checkout.sessions.retrieve_async(
            event["data"]["object"]["id"], {"expand": ["shipping_cost.shipping_rate"]}
        )
        await checkout.reconcile(session, event["id"], event["type"])
    return {"received": True}


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
    raise HTTPException(410, "Use cart checkout. Orders are created after verified payment.")


@app.get("/v1/orders/lookup")
async def lookup_order(
    lookup: Annotated[str, Query(min_length=3, max_length=320)],
    repo: Annotated[CatalogRepository, Depends(get_repository)],
):
    try:
        order = await repo.get_order_for_tracking(lookup)
    except Exception as error:
        logger.exception("Order tracking lookup failed")
        raise HTTPException(status_code=503, detail="Order tracking is temporarily unavailable") from error
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


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


@app.get("/v1/products/{product_slug}/catalogs/{catalog_slug}/mockup")
async def render_catalog_product_mockup(
    product_slug: str,
    catalog_slug: str,
    color: Annotated[str, Query(alias="Color", min_length=1)],
    size: Annotated[str | None, Query(alias="Size")] = None,
    placement: Annotated[str, Query(alias="Placement", pattern="^(front|chest|back)$")] = "front",
    style: Literal["flat", "men", "women"] = "flat",
    width: Annotated[int, Query(ge=120)] = 1500,
    format: ImageFormat = "webp",
    refresh: bool = False,
    repo: CatalogRepository = Depends(get_repository),  # noqa: B008
):
    try:
        job = await repo.get_catalog_render_job(
            product_slug=product_slug,
            catalog_slug=catalog_slug,
            color=color,
            size=size,
            placement=placement,
            style=style,
        )
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"MySQL unavailable: {error}") from error
    if not job:
        raise HTTPException(status_code=404, detail="Product catalog variant or mockup not found")

    safe_width = min(width, settings.max_width)
    cache_key = cache.key_for(job, width=safe_width, image_format=format)
    cache_path = cache.path_for(cache_key, format)
    headers = {"Cache-Control": "public, max-age=3600, must-revalidate"}
    if cache_path.exists() and not refresh:
        return FileResponse(
            cache_path,
            media_type=_media_type(format),
            headers={**headers, "X-Mockup-Cache": "hit"},
        )
    async with render_locks[int(cache_key[:8], 16) % len(render_locks)]:
        if cache_path.exists() and not refresh:
            return FileResponse(
                cache_path,
                media_type=_media_type(format),
                headers={**headers, "X-Mockup-Cache": "hit"},
            )
        try:
            image_bytes = await run_in_threadpool(
                render_mockup,
                job,
                width=safe_width,
                image_format=format,
                settings=settings,
            )
            await run_in_threadpool(_write_cached_image, cache_path, image_bytes)
        except Exception as error:
            raise HTTPException(
                status_code=422, detail=f"Could not render mockup: {error}"
            ) from error
    return Response(
        image_bytes,
        media_type=_media_type(format),
        headers={**headers, "X-Mockup-Cache": "miss"},
    )


@app.get("/catalog-preview/print-areas")
async def get_catalog_preview_print_areas(
    slugs: Annotated[str, Query(min_length=1, max_length=5000)],
    repo: CatalogRepository = Depends(get_repository),  # noqa: B008
):
    """Expose the renderer's canonical front regions for Admin thumbnails."""
    catalog_slugs = list(
        dict.fromkeys(slug.strip().lower() for slug in slugs.split(",") if slug.strip())
    )
    if not catalog_slugs or len(catalog_slugs) > 50:
        raise HTTPException(status_code=422, detail="Provide between 1 and 50 catalog slugs")
    try:
        return {"data": await repo.get_catalog_preview_print_areas(catalog_slugs)}
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"MySQL unavailable: {error}") from error


@app.get("/v1/products/{slug}")
async def get_product(
    slug: str,
    catalog: str | None = None,
    repo: CatalogRepository = Depends(get_repository),  # noqa: B008
):
    try:
        product = await repo.get_product_detail(slug, catalog_slug=catalog)
    except Exception as error:
        logger.exception("Product lookup failed for slug=%s catalog=%s", slug, catalog)
        raise HTTPException(status_code=503, detail="MySQL temporarily unavailable") from error
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.get("/v1/products/{product_slug}/design-preview")
async def get_product_design_preview(
    product_slug: str,
    repo: CatalogRepository = Depends(get_repository),  # noqa: B008
):
    asset = await repo.get_product_design_asset(product_slug)
    if not asset:
        raise HTTPException(status_code=404, detail="Product design not found")
    cache_path = settings.cache_dir / f"design-preview-{asset['checksum']}-1200.webp"
    if not cache_path.exists():
        image_bytes = await run_in_threadpool(
            render_design_preview,
            f"design/{resolve_design_path(asset['slug'], settings)}",
            width=min(1200, settings.max_width),
            image_format="webp",
            settings=settings,
        )
        await run_in_threadpool(_write_cached_image, cache_path, image_bytes)
    return FileResponse(
        cache_path,
        media_type="image/webp",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@app.get("/v1/catalogs/{catalog_slug}/avatar")
async def get_catalog_avatar(
    catalog_slug: str,
    repo: CatalogRepository = Depends(get_repository),  # noqa: B008
):
    asset = await repo.get_catalog_avatar_asset(catalog_slug)
    if not asset:
        raise HTTPException(status_code=404, detail="Catalog avatar not found")
    return FileResponse(
        settings.asset_root / asset["local_path"],
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


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


def _write_cached_image(path: Path, data: bytes) -> None:
    with NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        temporary_path = Path(temporary.name)
        try:
            temporary.write(data)
            temporary.close()
            temporary_path.replace(path)
        finally:
            temporary_path.unlink(missing_ok=True)


@app.get("/{product_slug}/{catalog_slug}/{color}.webp")
@app.get("/{product_slug}/{catalog_slug}/{color}/{view}.webp")
@app.get("/{product_slug}/{catalog_slug}_color-{color}.webp", include_in_schema=False)
async def render_simple_product_image(
    product_slug: str,
    catalog_slug: str,
    color: str,
    view: str | None = None,
    placement: str = "front",
    style: Literal["flat", "men", "women"] = "flat",
    blank: bool = False,
    repo: CatalogRepository = Depends(get_repository),  # noqa: B008
):
    if view is not None:
        try:
            style, placement, blank = parse_catalog_mockup_view(view)
        except ValueError as error:
            raise HTTPException(status_code=404, detail="Mockup view not found") from error
    resolved_placement = "back" if placement.lower() == "back" else "front"
    if blank:
        asset = await repo.get_blank_catalog_asset(catalog_slug, color, resolved_placement)
        if not asset:
            raise HTTPException(status_code=404, detail="Blank mockup asset not found")
        data = await run_in_threadpool(
            render_blank_mockup,
            asset["local_path"],
            width=min(1500, settings.max_width),
            image_format="webp",
            settings=settings,
            garment_color=asset.get("garment_color"),
        )
        return Response(
            content=data,
            media_type="image/webp",
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )
    return await render_catalog_product_mockup(
        product_slug=product_slug,
        catalog_slug=catalog_slug,
        color=color,
        size=None,
        placement="chest" if placement.lower() == "chest" else resolved_placement,
        style=style,
        width=min(1500, settings.max_width),
        format="webp",
        refresh=False,
        repo=repo,
    )
