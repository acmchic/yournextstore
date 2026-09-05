# Plan 002: Import a curated Gearment catalog into the owned commerce database

> **Executor instructions**: Follow this plan step by step. Run every verification
> command before continuing. Do not expose Gearment credentials, do not import the
> entire provider catalog by default, and stop at any condition listed below.
>
> **Drift check (run first)**:
> `git diff --stat a1e8eb7..HEAD -- api/app api/mysql/init api/tests api/public/mockup .env.example api/.env.example`
> The working tree already contains unrelated storefront edits. Preserve them.

## Status

- **Priority**: P1
- **Effort**: L (multi-day, delivered in four reviewable slices)
- **Risk**: MED
- **Depends on**: `plans/001-own-commerce-platform.md` schema and API foundation
- **Category**: direction / migration
- **Planned at**: commit `a1e8eb7`, 2026-09-03

## Outcome

An operator can preview and then idempotently import selected Gearment v3 catalog
products into MySQL. The authenticated API supplies transactional facts (identity,
variants, colors, sizes, costs, recommended prices, stock, and print locations),
while public Gearment catalog pages enrich those records with category membership,
description, gallery images, size guidelines, shipping tables, and artwork guidelines.
Images are downloaded under `api/public/mockup/{catalog-slug}/`. Re-running the sync
updates source-managed fields without overwriting local merchandising overrides.

The catalog remains separate from customer-facing designs/products. A design can be
attached to one or more imported catalogs through the existing `product_catalogs`
table, and the storefront can resolve a design+catalog offering with the catalog's
real colors, sizes, price, stock, size chart, and mockup templates.

## Verified provider contract

Use Gearment API v3 at the configured base URL. Authentication is server-only:

- `X-Gearment-Client-Key`
- `X-Gearment-Client-Secret`

`GET /api/v3/catalog` is paginated with `paging.page` and `paging.limit`; it supports
`filter.product_ids` and `filter.search_text`. Each catalog record exposes:

- `product_id`, `legacy_product_id`, `product_name`, `product_avatar_url`
- `print_locations[]`: `location_id`, `code`, `name`
- `variants[]`

`GET /api/v3/catalog/variants` exposes `variant_id`, `legacy_variant_id`,
`variant_sku`, `name`, `size`, `size_code`, `color`, `color_code`,
`hex_color_code`, `price`, `recommended_price`, `extra_price`, `net_price`, and
`stock_label`. Money is `{ currency_code, units, nanos }`; convert it exactly to
integer minor units and reject unsupported fractional-minor values.

The public website complements the API:

- Category pages such as `/catalog/category/men-t-shirts` expose department/type
  membership and links to catalog products.
- Product pages such as `/catalog/product/dyed-heavyweight-t-shirt-1717` expose a
  product code, description, displayed sizes/prices, Size Guideline, shipping table,
  Artwork Guideline/template, and product/gallery image URLs.
- The 1717 page observed on 2026-09-03 contains sizes S through 3XL and structured
  Body Length/Chest Width measurements with tolerances.
- `robots.txt` currently allows `/`. The importer must still identify itself,
  throttle requests, cache snapshots, and stop if robots or terms later disallow use.
- The API remains authoritative for IDs, purchasable variants, provider prices, and
  stock. Website values only enrich or raise a drift warning; they never override API facts.

Sources: [Gearment OpenAPI console](https://developers.gearment.com/api/),
[authentication](https://developers.gearment.com/gearment-api/authentication/), and
[migration/API v3 guide](https://developers.gearment.com/gearment-api/migration-guide/),
[Men T-shirts category](https://gearment.com/catalog/category/men-t-shirts), and
[Comfort Colors 1717 product page](https://gearment.com/catalog/product/dyed-heavyweight-t-shirt-1717).

### Source precedence

| Data | Primary source | Fallback/override |
| --- | --- | --- |
| Provider product/variant IDs and SKU | Gearment API | none |
| Color, size, provider prices, stock | Gearment API | website only validates/reports drift |
| Department and product type | Category-page membership | reviewed manifest override |
| Description | Product page | local description override |
| Size/shipping/artwork guidelines | Product page | local structured override |
| Catalog images | API avatar plus product page gallery | validated local replacement |
| Retail selling price | local merchandising policy | recommended API price as initial default |

## Architecture decision

Do not create a second catalog subsystem. Extend the existing normalized tables in
`api/mysql/init/001_schema.sql`:

```text
Gearment v3 --sync--> catalogs --< catalog_colors
                         |      --< catalog_sizes
                         |      --< catalog_variants
                         |      --< catalog_print_locations
                         |      --< catalog_taxonomy
                         |      --< catalog_assets
                         |
designs --> products --> product_catalogs --> product_variants
                         |
                         +--> mockup_templates --> on-demand rendered product media
```

Keep the provider's blank/avatar image distinct from generated design mockups:

- `catalog_assets`: downloaded source/reference images from Gearment.
- `mockup_templates`: clean bases plus print geometry used by the renderer.
- generated design images: deterministic `/img/{design}/{catalog}-{color}-{view}.webp`.

A Gearment avatar is not automatically a render-ready blank. Only promote it to a
`mockup_template.base_source` after verifying it is clean, sufficiently large, and
has a calibrated printable area.

## Target database changes

Add migration `api/mysql/init/003_gearment_catalog.sql`; do not rewrite previously
applied migrations in an installed database.

### Extend `catalogs`

Add:

- `provider varchar(32) not null default 'manual'`
- `provider_product_id varchar(100) null`
- `provider_legacy_product_id int null`
- `source_page_url varchar(500) null`, `source_page_slug varchar(190) null`
- `provider_description text null`, `description_override text null`
- `provider_size_chart_json json null`, `size_chart_override_json json null`
- `shipping_guideline_json json null`, `artwork_guideline_json json null`
- `website_payload_json json null`, `website_synced_at timestamp(6) null`
- `provider_payload_json json null` (debug/audit snapshot; never used directly by UI)
- `provider_synced_at timestamp(6) null`
- unique `(provider, provider_product_id)` where practical in MySQL; because manual
  rows have no provider ID, use a nullable unique key.

Retain `slug`, `name`, `product_type`, `material`, `brand`, `active`, and
`sort_order` as locally managed merchandising fields. Effective description is
`description_override ?? provider_description`; effective size chart is
`size_chart_override_json ?? provider_size_chart_json`. The sync may set safe defaults
on first insert but must not overwrite local override columns.

### Extend `catalog_colors`

Add `provider_color_code varchar(100) null`; uniqueness is
`(catalog_id, provider_color_code)` for imported colors, while existing
`(catalog_id, slug)` remains. Store Gearment's display name and validated `#RRGGBB`
hex value; preserve a local display-name override if one is added later.

### Extend `catalog_sizes`

Add `provider_size_code varchar(100) null`; keep ordered local `code`, `label`, and
`sort_order`. Size ordering must use a deterministic apparel-aware rank for known
sizes, then stable lexical fallback for unknown provider values.

### Extend `catalog_variants`

Use `public_id` for Gearment `variant_id` only if all existing code accepts it;
otherwise add explicit `provider_variant_id varchar(100)` and keep internal public
IDs provider-neutral. Also add:

- `provider_legacy_variant_id int null`
- `provider_sku varchar(160) null`
- `provider_price_minor`, `recommended_price_minor`, `extra_price_minor`,
  `net_price_minor` as nullable unsigned integers
- `provider_stock_label varchar(80) null`
- `provider_payload_json json null`, `provider_synced_at timestamp(6) null`
- unique `(catalog_id, provider_variant_id)`

`base_cost_minor` should map to `net_price` after confirming with a real account
sample. `default_price_minor` should initially use `recommended_price`, falling back
to a configured margin policy; subsequent local price edits must survive sync.

### Add three small tables

1. `catalog_print_locations`: `catalog_id`, provider location ID, `code`, `name`,
   `active`, unique `(catalog_id, code)`.
2. `catalog_taxonomy`: `catalog_id`, `department enum('men','women','kids','home-living','accessories')`,
   `type_slug`, `type_label`, `source_url`, `sort_order`, unique
   `(catalog_id, department, type_slug)`.
   This permits a unisex catalog to appear under both Men and Women without copying it.
3. `catalog_assets`: `catalog_id`,
   `kind enum('avatar','gallery','size-chart','artwork-template','blank','other')`,
   optional `color_id`, `source_url`, `local_path`, checksum, MIME, width, height,
   byte size, status, and timestamps. Unique `(catalog_id, kind, color_id, source_url)`.

Do not create generic EAV attribute tables, category trees, a provider abstraction
framework, or a separate row for every catalog/category label in the screenshot.

## URL and product model

Keep `products.slug` design-centric, e.g. `hamburger-helper-glove`. The selected
catalog belongs to `product_catalogs`; do not duplicate the artwork or product row.

Recommended public URL:

```text
/product/hamburger-helper-glove/unisex-t-shirt?Size=S&Color=Black
```

This is unambiguous and avoids parsing an underscore inside a design/catalog slug.
If the current single-segment route must remain, support this compatibility form:

```text
/product/hamburger-helper-glove--unisex-t-shirt?Size=S&Color=Black
```

Redirect the requested underscore form to the canonical route rather than making
underscore parsing permanent. The server must resolve catalog, color, and size
before the first HTML response so price, availability, image, JSON-LD, and Merchant
feed data agree. Size changes price/stock/SKU; it should not change the image unless
the catalog explicitly owns size-specific media.

## Scope

**In scope**:

- `api/mysql/init/003_gearment_catalog.sql` (create)
- `api/app/settings.py`
- `api/app/gearment/client.py`, `schemas.py`, `sync.py`, `__init__.py` (create)
- `api/app/gearment/web_catalog.py` (create; public-page parser/enricher)
- `api/app/cli.py`
- `api/tests/test_gearment_client.py`, `test_gearment_sync.py` (create)
- `api/public/mockup/{catalog-slug}/` downloaded assets
- `api/.env.example`, `.env.example`, `api/README.md`
- product/catalog API and storefront route changes only after sync slices pass

**Out of scope**:

- importing the whole Gearment catalog without an allowlist
- downloading or exposing credentials
- generating design mockups during the catalog transaction
- adding Redis/Celery, a generic provider plugin system, or an admin UI
- rewriting unrelated dirty storefront files
- treating the Gearment avatar as a calibrated mockup automatically
- crawling unrelated Gearment pages or guessing API-to-page matches by fuzzy name
- inventing data absent from the API, page, or reviewed override manifest

## Implementation steps

### Slice 1: Freeze the provider contract and add the client

1. Save a redacted API response fixture for one catalog and its variants under
   `api/tests/fixtures/gearment/`; retain IDs/shapes but no credentials or personal
   data. Also save trimmed HTML fixtures for the 1717 product page and one category
   page, containing only catalog content required by parser tests.
2. Add `GEARMENT_CLIENT_KEY`, `GEARMENT_CLIENT_SECRET`, and optional
   `GEARMENT_API_BASE_URL` to `Settings` and examples. Production is the default only
   when explicitly chosen; tests use a fake HTTP server/transport.
3. Implement a stdlib async-safe client (or add one lightweight HTTP dependency only
   if justified) with timeouts, pagination, response validation, request ID capture,
   and bounded exponential backoff for 429/5xx honoring `Retry-After`.
4. Add typed/Pydantic schemas and exact Money-to-minor-unit conversion tests.
5. Implement the website parser separately from its HTTP fetcher. Parse breadcrumb
   and category URL for taxonomy; parse product code, description list, sizes, size
   table (including tolerance/note/unit), shipping table, artwork table/template URL,
   and image URLs. Store structured values, never untrusted HTML rendered by the store.
6. Match API products to pages only through a reviewed `source_page_url`/product-code
   mapping in the manifest. Report API/page size or price disagreement; never merge
   records by similar names.

**Verify**: `PYTHONPATH=api api/.venv/bin/python -m pytest api/tests/test_gearment_client.py -q`
→ pagination, auth-header construction, retry, malformed payload, money, HTML parser,
and API/page drift tests pass; test output contains no credential values.

### Slice 2: Migrate the catalog model and build idempotent sync

1. Add the migration above with foreign keys and indexes.
2. Implement `sync_catalogs(database, selected_product_ids, dry_run)` using one
   transaction per provider product. Upsert by provider IDs/codes, preserve internal
   IDs and local overrides, and mark missing provider variants inactive only after a
   complete successful fetch.
3. Add CLI:

```text
python -m app.cli sync-gearment-catalog --product-id ID [--product-id ID] --dry-run
python -m app.cli sync-gearment-catalog --product-id ID [--product-id ID] --apply
```

Require one or more IDs or an explicit reviewed manifest file. `--all` must not exist
in the first version. Dry-run prints created/updated/unchanged/inactivated counts and
never mutates the DB.

**Verify**: import the same fixture twice; the second apply reports zero creates,
stable internal IDs, zero duplicate rows, and preserved local description/taxonomy/
size-chart overrides and retail price.

### Slice 3: Enrich from public pages and download validated catalog assets

1. Fetch only product/category URLs listed in the reviewed manifest. Use a descriptive
   User-Agent, low concurrency, request delay, timeout, conditional GET, bounded retry,
   and cached source snapshot. Check robots before each sync run.
2. Parse and upsert source-managed description, taxonomy, and size/shipping/artwork
   guideline structures. If selectors disappear, keep prior valid data, mark
   enrichment stale/failed, and report structural drift.
3. For each selected API avatar and page image, download to a temporary file, limit redirects
   and maximum bytes, allow only `https`, validate MIME by decoded content, decode
   dimensions, compute SHA-256, then atomically move to:
   `api/public/mockup/{catalog-slug}/{asset-kind}-{ordinal}.{ext}`.
4. Store a relative POSIX path in `catalog_assets.local_path`; never store an absolute
   developer-machine path. Keep `source_url` for provenance.
5. On unchanged checksum, do not rewrite the file. On failure, retain the previous
   valid asset and report the catalog as partially synced.
6. Add parser-drift, robots-denied, path-traversal, oversized response, non-image body, duplicate checksum,
   interrupted download, and rerun tests.

**Verify**: every applied `catalog_assets.local_path` resolves under
`api/public/mockup`, decodes successfully, and matches its recorded checksum and
dimensions.

### Slice 4: Apply local overrides and expose catalog offerings

1. Add a reviewed manifest such as `api/catalog-overrides.yaml` mapping imported
   Gearment product IDs to exact website product URL, category source URLs, local
   slug, optional taxonomy/description/size-chart overrides, material/brand, enabled
   colors/sizes, markup policy, and default color.
2. Seed the five departments: Men, Women, Kids, Home & Living, Accessories. A catalog
   may have multiple assignments; types such as T-shirts, Hoodies, Tumblers, Posters,
   and Phone Cases are labels within assignments, not hard-coded database enums.
3. Extend `CatalogRepository.list_catalogs` and `get_product_detail` to return catalog
   taxonomy, size chart, available variants, local retail price, stock, and media.
4. Attach one existing design to one imported catalog through `product_catalogs`,
   materialize only enabled `product_variants`, and prove the requested product page
   resolves the exact catalog/color/size combination.
5. Make product page, JSON-LD, cart, checkout, and future Merchant feed read the same
   resolved sellable variant. Preserve the rule that `/checkout` uses plain `<a>`.

**Verify**: initial HTML for one tracer product includes the selected catalog title,
color, size, SKU, USD price, availability, and matching ProductGroup/Offer JSON-LD;
all displayed media return HTTP 200 with an image content type.

## Tests

- Client unit tests: header names (values redacted), pagination termination, 401,
  429 retry, timeout, 5xx, invalid JSON, provider enum variants, Money conversion.
- Sync integration tests: first import, identical rerun, provider price/stock update,
  discontinued variant, partial page failure rollback, local override preservation,
  same color name with stable provider code, unknown size ordering.
- Web enrichment tests: exact API-to-page mapping, 1717 description and size-table
  parsing, category membership, layout drift, API/page discrepancy, conditional
  fetch, throttling, and robots denial.
- Asset tests: safe path, MIME sniffing, byte/dimension caps, atomic replacement,
  checksum dedupe, previous-good-file preservation.
- API/storefront contract tests: catalog selection, missing/inactive combination,
  multi-department catalog, size chart, price/stock agreement, SSR and JSON-LD.

## Verification commands

```text
PYTHONPATH=api api/.venv/bin/python -m pytest api/tests -q
api/.venv/bin/python -m ruff check api
api/.venv/bin/python -m ruff format --check api
bunx tsgo --noEmit
bunx biome check .
bun test
bun run build
```

Run DB integration verification against a disposable database: migrate from empty,
dry-run, apply selected IDs, rerun, query duplicate-provider IDs, and verify assets.
Do not run the repository's `bun run lint` for read-only verification because its
configured command writes changes.

## Done criteria

- [ ] Sync requires an explicit product allowlist and is dry-run by default.
- [ ] Secrets exist only in server environment configuration and never appear in
      logs, fixtures, database payload snapshots, browser bundles, or plan files.
- [ ] A second identical sync creates no rows/files and preserves stable IDs.
- [ ] Website description, taxonomy, size/shipping/artwork guidelines, and images are
      stored with source URL and sync timestamp.
- [ ] Local description, taxonomy, size chart, retail price, and activation overrides
      survive provider resync.
- [ ] Every imported variant retains Gearment product/variant identity, SKU, color,
      size, prices, currency, and stock label without lossy float conversion.
- [ ] Catalog avatars are validated local assets under `api/public/mockup/{slug}/`.
- [ ] Gearment avatars are not silently used as render templates.
- [ ] One design+catalog tracer page resolves valid colors/sizes/prices/images and
      emits matching SSR, JSON-LD, cart, and checkout facts.
- [ ] Full Python and storefront verification commands pass.
- [ ] No unrelated dirty working-tree file was overwritten.

## STOP conditions

Stop and report rather than improvise if:

- the real authenticated payload differs materially from the downloaded OpenAPI;
- the credential variable names in the runtime do not match the two required headers;
  confirm configuration with the operator without printing secret values;
- `price`, `recommended_price`, or `net_price` semantics remain ambiguous after one
  real response—do not guess the retail/base-cost mapping;
- Gearment does not grant permission to persist/serve `product_avatar_url` locally;
- `robots.txt`, terms, or an explicit provider instruction disallows the crawl;
- the public page layout changes so required data cannot be parsed confidently;
- a catalog needs per-color mockups but Gearment only supplies its single avatar;
- applying the migration would conflict with a production schema not represented by
  `api/mysql/init/001_schema.sql`;
- the implementation requires changing unrelated storefront edits already present.

## Maintenance notes

- Resync catalog metadata on demand initially; add a scheduled daily stock/price sync
  only after the manual importer is stable and observable.
- Store provider facts and local overrides separately so future admin editing is safe.
- If Gearment later adds taxonomy, size charts, or per-color images to the API,
  migrate source precedence deliberately rather than overwriting website/local data.
- The renderer cache key must continue to include design checksum, template version,
  catalog/color/template identity, output size, and format.
- Merchant Center publication must wait until the main image is rendered, crawlable,
  accurate for the selected catalog/color, at least 500×500, and consistent with page,
  variant, price, stock, and JSON-LD.
