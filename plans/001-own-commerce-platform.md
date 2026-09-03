# Own Commerce Platform: FastAPI, MySQL, storefront, and POD mockups

**Status:** Proposed  
**Created:** 2026-08-12  
**Commit:** `a72b6cb`

## Objective

Make the store's FastAPI/MySQL service the only commerce source of truth. A design file is imported once, becomes a product, can be sold on one or more garment catalogs, exposes price/availability/variants, and supplies deterministic on-demand mockup URLs. The Next.js storefront reads this API for product lists, product detail, cart, checkout, orders, sitemap, and structured data. Commerce Kit and hard-coded local product fixtures are removed after parity is reached.

The delivery must preserve the existing canonical image route, including examples such as:

```text
/img/rookie-dad-2024/t-shirt-black-front.webp
/img/rookie-dad-2024/t-shirt-black-women.webp
/img/rookie-dad-2024/t-shirt-black-left-chest.webp
/img/rookie-dad-2024/t-shirt-black-back.webp
```

## Architecture decision

```text
Browser / Googlebot
        |
        v
Next.js storefront (SSR/RSC, metadata, JSON-LD)
        |
        v
FastAPI /v1 ----------------------> MySQL 8.4 (InnoDB)
   |                                    |
   +--> deterministic /img URLs         +--> products, variants, carts, orders
   |         |
   |         +--> local volume in dev / object storage + CDN in production
   |
   +--> background worker polling outbox/render jobs
```

Use one repository but separate deployable services. Start with MySQL, API, storefront, and one worker process. Do not add Redis initially: MySQL transactions, an outbox table, and `SELECT ... FOR UPDATE SKIP LOCKED` are sufficient for import jobs, mockup warming, and order side effects at the expected scale. Add Redis only after measurements show queue or hot-cache contention.

Keep the current sharp compositing mode as the default. Product correctness and artwork clarity take priority over displacement/fold effects. A future renderer version may add effects behind an explicit template/version flag.

## Domain model

Use `BIGINT UNSIGNED` internal primary keys and separate stable public IDs (ULID/UUID string) for URLs/API. Store money as integer minor units plus ISO currency. Use `utf8mb4`, InnoDB, foreign keys, timestamps, and soft archival through statuses rather than deleting commerce records.

### Catalog and mockup tables

| Table | Purpose and essential columns |
| --- | --- |
| `catalogs` | Blank garment/product family: `id`, `slug` (`t-shirt`, `hoodie`, `mug`), `name`, `product_type`, `material`, `brand`, `active`, `sort_order` |
| `catalog_colors` | Colors available in one catalog: `catalog_id`, `slug`, `name`, `hex`, `active`, unique `(catalog_id, slug)` |
| `catalog_sizes` | Sizes: `catalog_id`, `code`, `label`, `sort_order`, `active`, unique `(catalog_id, code)`; mugs may use one default size |
| `catalog_variants` | Purchasable blank combinations: `public_id`, `catalog_id`, `color_id`, `size_id`, `sku`, `base_cost_minor`, `default_price_minor`, `currency`, `stock_policy`, `stock_quantity`, `active` |
| `mockup_templates` | Base image and placement config: `public_id`, `catalog_id`, `color_id`, `style` (`flat`, `men`, `women`), `placement` (`front`, `left_chest`, `back`), `base_source`, `print_area_json`, `renderer_version`, `active` |

Avoid storing color and size arrays in a JSON column. They participate in filtering, validation, SKU generation, and referential integrity, so normalized rows are simpler and safer. Reserve JSON for print geometry and optional metadata.

### Product and merchandising tables

| Table | Purpose and essential columns |
| --- | --- |
| `designs` | Original artwork: `public_id`, `slug`, `name`, `source_path`, `checksum`, `width`, `height`, `license_status`, `alt_text`, `metadata_json`, `status` |
| `products` | Customer-facing design product: `public_id`, `design_id`, `slug`, `title`, `description`, `status`, `brand`, `condition`, `seo_title`, `seo_description`, `published_at`, timestamps |
| `product_catalogs` | Catalogs offered by a product: `product_id`, `catalog_id`, `active`, `default_color_id`, `price_adjustment_minor` |
| `product_variants` | Sellable design + blank variant: `public_id`, `product_id`, `catalog_variant_id`, `sku`, `price_minor`, `compare_at_minor`, `currency`, `active`; unique `(product_id, catalog_variant_id)` |
| `product_media` | Optional persisted/warmed media: `product_id`, `catalog_id`, `color_id`, `template_id`, `placement`, `style`, `url`, `cache_key`, `status`, dimensions, timestamps |
| `collections` | Curated SEO landing pages: `slug`, `title`, `description`, `status`, SEO fields, `indexable`, timestamps |
| `collection_products` | Explicit membership and ordering: `collection_id`, `product_id`, `sort_order` |

One design normally creates one product. It must not automatically create an indexable one-product collection. That would duplicate the product intent and produce thin pages at scale. If an operational grouping named after the design is required, keep it `indexable = false` or redirect/canonicalize it to the product. Public collections should group multiple designs around real intent such as `new-dad-shirts`, `father-day-gifts`, or `funny-programmer-shirts`.

### Cart, checkout, and order tables

| Table | Purpose and essential columns |
| --- | --- |
| `carts` | `public_id`, optional `customer_id`, `currency`, `status`, expiry and timestamps |
| `cart_items` | `cart_id`, `product_variant_id`, `quantity`; unique per cart/variant. Price is always recalculated from the variant when reading/checkout |
| `orders` | Stable public order number, customer contact, currency, subtotal/shipping/tax/discount/total minor units, payment/fulfillment status, timestamps |
| `order_items` | Immutable snapshots of product/design/catalog/color/size/SKU/title/unit price/quantity/mockup URL at purchase time |
| `order_addresses` | Shipping and billing snapshots; never depend on a mutable customer address |
| `payments` | Provider-neutral attempt/reference/status/amount; never store card data |
| `order_status_history` | Auditable state changes |
| `idempotency_keys` | Deduplicate checkout and payment requests |
| `outbox_events` | Transactional jobs for render warmup, email, fulfillment, feed export, and webhook delivery |
| `webhook_events` | Deduplicate and audit incoming payment/fulfillment callbacks |

Payment provider selection is deliberately deferred. Implement a small provider interface and one adapter only when the provider is chosen. The order database and checkout API remain provider-neutral.

## API contract

Prefix JSON endpoints with `/v1`; keep image URLs outside the versioned namespace because they are public, stable assets.

### Read API

```text
GET /v1/store
GET /v1/catalogs
GET /v1/catalogs/{slug}
GET /v1/products?cursor=&limit=&q=&catalog=&color=&size=&collection=
GET /v1/products/{slug}
GET /v1/collections
GET /v1/collections/{slug}
GET /v1/search/suggestions?q=
GET /v1/sitemap/products?cursor=
```

`GET /v1/products/{slug}` returns the complete initial render payload: product SEO fields, design, catalog options, all active variants, default selection, availability, and media grouped by catalog/color/style/placement. Size changes price/stock but not images; color or catalog changes the displayed media set.

Example media item:

```json
{
  "catalog": "t-shirt",
  "color": "black",
  "style": "women",
  "placement": "front",
  "width": 1500,
  "url": "/img/rookie-dad-2024/t-shirt-black-women.webp"
}
```

Use cursor pagination for the final API. During storefront migration an offset compatibility field may be accepted, but do not expose database offsets as the long-term contract.

### Cart and order API

```text
POST   /v1/carts
GET    /v1/carts/{cart_id}
PUT    /v1/carts/{cart_id}/items/{variant_id}
DELETE /v1/carts/{cart_id}/items/{variant_id}
POST   /v1/checkout/quote
POST   /v1/orders                 (requires Idempotency-Key)
GET    /v1/orders/{order_number}  (signed token or authenticated customer)
POST   /v1/webhooks/{provider}
```

All mutations validate active product/catalog/variant and price inside one transaction. The server ignores client totals. Lock variant rows during final order creation, snapshot order facts, create the payment record and outbox event, then commit.

### Error and caching contract

- Return one error envelope: `{ "error": { "code", "message", "fields?", "request_id" } }`.
- Generate OpenAPI from FastAPI and generate/store TypeScript types from that contract; do not manually duplicate DTO shapes.
- Public product/collection reads use `ETag` and short CDN cache with stale-while-revalidate.
- Image paths are immutable by renderer/template version or content hash. Preserve the current one-year immutable cache behavior.
- Product publication or price/stock changes emit an outbox event so Next cache tags and feeds can be invalidated.

## Import command

Add an idempotent CLI under the API package:

```text
python -m app.cli import-products \
  --design-dir public/design/ids/gmc \
  --catalog t-shirt \
  --colors black,white,navy,yam \
  --sizes S,M,L,XL,2XL \
  --sidecar auto \
  --dry-run
```

Then rerun without `--dry-run`; add `--publish` only after reviewing output. Default state is `draft`.

For each PNG/WebP/SVG:

1. Validate that the resolved path stays under the configured design root, file type is allowed, dimensions are sufficient, transparency is readable, and checksum is calculable.
2. Resolve optional adjacent sidecar metadata, for example `rookie-dad-2024.json`, containing title, description, tags, catalog choices, colors, placements, alt text, license status, and collection slugs.
3. Derive a normalized unique slug from filename when the sidecar omits it. Never silently append random SEO suffixes; report collisions.
4. Upsert `designs` by checksum/source, `products` by slug, `product_catalogs`, and all valid `product_variants`. Existing public IDs remain stable.
5. Validate that each requested catalog/color has at least one active matching mockup template. Missing women/back/chest templates are warnings unless explicitly required by sidecar.
6. Generate deterministic media URLs, enqueue only default/color hero renders for warming, and leave the rest on demand.
7. Assign only explicitly supplied thematic collections. Do not infer thousands of collections from filenames.
8. Print and optionally save a machine-readable report: created, updated, unchanged, skipped, warnings, errors, and prospective URLs.

The command must be transactionally safe per design and safe to rerun. A changed artwork checksum increments its render/media version so old immutable URLs are not served with new pixels.

## Storefront migration

Create a typed `lib/store-api/` boundary with server-only request code, generated DTOs, Zod validation at the external boundary, and adapters that return the shapes currently expected by components. `STORE_API_URL` is server-only; browser-visible media uses `NEXT_PUBLIC_MEDIA_URL` or same-origin proxying. Do not expose API credentials to the browser.

Migrate in this order:

1. Store settings and taxonomy: replace `meGetCached`, categories, and collections.
2. Read path: product grid, `/products`, search/suggestions, category/collection routes, `/product/[slug]`, metadata, and product JSON-LD.
3. Product interaction: selected catalog/color/size resolves a real `product_variant.public_id`; gallery switches to matching media without changing image for size alone.
4. Sitemap, robots/llms surfaces, Merchant export, and canonical helpers read the same API DTOs.
5. Cart actions replace `commerce.cartGet/cartUpsert`; keep the cart public ID in the existing HTTP-only cookie.
6. Checkout/order-success use the own quote/order APIs. Every `/checkout` link remains a plain `<a>` per repository constraint.
7. Remove `lib/local-commerce.ts`, `lib/local-commerce-data.ts`, Commerce Kit selection logic, `YNS_API_KEY`, and the `commerce-kit` package only after contract parity and smoke tests pass.

Use Server Components for initial product facts so title, image, price, currency, availability, selected variant, and JSON-LD are in the first HTML. Cache product/category reads with Next cache tags (`product:{id}`, `collection:{id}`, `catalog`) and invalidate through a signed internal webhook from the API. Do not cache cart, checkout, or order reads.

## SEO and Merchant rules

- Keep one canonical product URL: `/product/{design-slug}`. Query parameters such as `?Color=Black&Size=M` may preselect a variant, but canonical stays on the clean product URL unless Merchant feed policy requires a stable variant URL; in that case render the exact variant in initial HTML and keep grouping via `item_group_id`.
- Keep semantic stable image URLs with the real file extension at the end. Return matching `Content-Type`; do not put source design paths into public URLs.
- Only active/indexable products and useful multi-product collections enter sitemap. Filter/search pages and one-design operational collections are `noindex`.
- Generate unique product title, description, alt text, Open Graph image, canonical, Product/ProductGroup + Offer JSON-LD, and Merchant export from the same API record.
- Price, currency, stock, condition, brand, SKU/MPN/GTIN status, color, size, gender/style, and mockup must agree across API, page, JSON-LD, cart, checkout, order snapshot, and feed.
- Default product image must match the default catalog/color. Additional images may show women/men/back/chest, but each must truthfully represent the selected variant.
- Require explicit design licensing status before publish. Reject trademark/copyright ambiguity rather than publishing and fixing later.
- Use configured production origin for canonical, sitemap, feed, and absolute image links; do not hardcode the future domain.

## Docker and deployment

At repository root, define a production-oriented Compose stack:

| Service | Responsibility |
| --- | --- |
| `db` | MySQL 8.4, persistent volume, healthcheck, no public port in production |
| `migrate` | Runs `alembic upgrade head` once and exits successfully before API starts |
| `api` | FastAPI JSON and image endpoints, non-root image, health/readiness checks |
| `worker` | Same API image, polls `outbox_events`/render jobs, separate concurrency setting |
| `storefront` | Next standalone server, non-root image, depends only on healthy API |

Use a bind-mounted design/mockup directory only in local development. Production assets belong in S3-compatible object storage behind a CDN; MySQL stores logical object keys, never host-specific absolute paths. Keep generated cache disposable. Secrets come from deployment secrets/env, not images or committed `.env` files.

Provide separate `compose.yaml` and `compose.dev.yaml` overrides, healthchecks, resource limits, graceful shutdown, structured JSON logs with request IDs, database backups, and migration rollback documentation. Do not run database migrations independently from every API replica.

## Delivery phases

### Phase 0 — Contract and safety baseline

- Add Alembic and a database session/transaction layer while retaining current `aiomysql` reads until repositories migrate.
- Freeze OpenAPI fixtures for product detail, browse, cart, and error envelopes.
- Add API request IDs, structured errors, readiness check that verifies MySQL, and test factories.
- Add a feature flag allowing old storefront reads during migration, but never merge data from two sources in one request.

**Done:** migrations run against an empty MySQL instance; current mockup tests remain green; contract tests fail meaningfully before new endpoints exist.

### Phase 1 — Catalog, product schema, and importer

- Add catalog/design/product/collection migrations and seed catalog colors, sizes, variants, and current mockup templates.
- Replace the temporary `pod_products`/`pod_mockup_render_jobs` SQL-view adapter with repositories over owned tables.
- Implement dry-run/idempotent import and import the existing sample design.
- Add uniqueness, foreign-key, slug collision, invalid path, checksum-change, and rollback tests.

**Done:** a clean database can be migrated, seeded, and populated from the design directory with the same IDs on a second run.

### Phase 2 — Product API and media

- Implement browse/detail/catalog/collection/search/sitemap endpoints.
- Have product detail enumerate only media combinations backed by active mockup templates.
- Version image cache keys by design checksum + template renderer version; warm default images through outbox jobs.
- Add conditional GET, pagination, SQL query/index tests, and browser checks for black/white, flat/women, front/chest/back.

**Done:** one API response contains everything required to server-render a purchasable product, and every returned media URL resolves sharply with correct color/placement.

### Phase 3 — Storefront read cutover

- Add generated API types and the typed fetch boundary.
- Migrate listing, product, search, category, collection, metadata, JSON-LD, and sitemap.
- Test variant selection and gallery mapping; compare initial HTML and UI facts with API facts.
- Remove read-path dependence on Commerce Kit/local fixtures after parity.

**Done:** disabling all Commerce Kit credentials/fixtures does not change the product browse/detail experience or SEO output.

### Phase 4 — Cart

- Add cart migrations/repositories/endpoints with expiry, quantities, validation, and transaction tests.
- Replace cart server actions while preserving HTTP-only cookie behavior.
- Cover price changes, inactive variants, quantity limits, concurrent updates, and stale carts.

**Done:** browse -> detail -> select variant -> add/update/remove -> cart works using only FastAPI/MySQL.

### Phase 5 — Checkout and orders

- Add order/payment/address/history/idempotency/webhook/outbox schema and provider interface.
- Implement quote and order creation before connecting the selected payment provider.
- Add exact monetary reconciliation, webhook replay/deduplication, order lookup authorization, and immutable snapshots.
- Replace the preview checkout only after a conventional payment path, full costs, shipping/returns information, and success/failure flows are complete.

**Done:** repeat checkout requests cannot create duplicate orders/charges; product-to-order smoke path is complete and Merchant-ready.

### Phase 6 — Production hardening and removal

- Complete root Docker stack, backup/restore drill, object storage/CDN, logs/metrics/alerts, rate limits, CORS/host policy, and secrets.
- Load-test product browse, product detail, cache hit/miss rendering, cart writes, and order creation independently.
- Remove Commerce Kit/local fallback code, dependency, and obsolete env variables.
- Run SEO/Merchant consistency audit and submit only after checkout and policies are live.

**Done:** clean deploy from empty infrastructure succeeds, rollback is documented, and no runtime import/reference to Commerce Kit remains.

## Performance targets

Measure before optimizing. Initial service-level targets at p95 under expected launch load:

- Cached product/catalog JSON: under 200 ms at API edge.
- Cached mockup image: under 150 ms server time, primarily CDN-bound.
- Uncached 1500 px mockup: under 1.5 s; request coalescing prevents duplicate renders for the same cache key.
- Cart mutation: under 300 ms excluding network edge.
- Order transaction: under 700 ms excluding payment provider latency.

Add indexes for active/status + publication ordering, product slug, design checksum, variant SKU, collection membership, cart public ID/status, order number, idempotency key, webhook provider/event ID, and outbox status/available time. Confirm choices with `EXPLAIN ANALYZE` using production-like row counts instead of adding speculative indexes.

## Verification gates

Run after each applicable phase:

```text
PYTHONPATH=api api/.venv/bin/python -m pytest api/tests -q
api/.venv/bin/python -m ruff check api
api/.venv/bin/python -m ruff format --check api
bunx tsc --noEmit
bunx biome check .
bun test
bun run build
docker compose config
docker compose up --build
```

Smoke-test from a clean database:

```text
migrate -> seed catalogs -> import --dry-run -> import -> import again
-> browse -> product detail -> every returned image URL
-> select catalog/color/size -> add cart -> update cart
-> quote -> create order twice with same idempotency key
-> payment webhook replay -> order success
```

Also verify mobile/desktop product rendering, first-response HTML, JSON-LD validation, sitemap contents, correct image MIME/extension, immutable cache behavior, and no browser console errors.

## Risks and stop conditions

- Do not publish a design with unknown licensing, invalid artwork path, or missing required default mockup.
- Do not delete the old commerce integration until product, SEO, cart, and order contract parity tests pass.
- Do not enable checkout until payment provider, shipping/tax rules, returns policy, privacy/terms, and total-cost display are agreed and implemented.
- Do not auto-create indexable collections per design; require a meaningful collection brief and enough products/content.
- Do not deploy local filesystem assets across multiple production replicas; configure shared object storage first.
- Do not serve a new design/template under an old immutable image URL; bump content/template version.
- If import volume or render traffic invalidates MySQL polling targets, benchmark first, then introduce Redis/managed queue without changing the public API.

## First implementation slice

Start with Phases 0–2 for one catalog (`t-shirt`), four colors (`black`, `white`, `navy`, `yam`), five sizes, and the current `rookie-dad-2024` design. This is the tracer bullet: it proves schema, importer, prices, variants, styles, placements, caching, and product API before changing the storefront. Then cut over the single product page in Phase 3 before migrating lists/cart. This keeps every step observable and reversible.
