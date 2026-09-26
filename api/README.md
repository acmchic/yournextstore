# POD Mockup API

FastAPI service for on-demand print-on-demand mockup rendering.

This service is intentionally kept inside the storefront repo for now. The frontend theme, mockup contract, cache key format, and product image URLs should evolve together during the validation phase. If the renderer becomes a heavy independent workload later, move this `api/` folder to its own repo without changing the HTTP contract.

## What This Service Does

- Reads product/artwork/mockup-template data from MySQL through stable SQL views.
- Renders artwork onto apparel mockups only when a product image is requested.
- Uses a deterministic file cache so the same image is not rendered twice.
- Supports mask, perspective warp, displacement, shadow, and highlight maps so artwork follows the shirt surface instead of looking like a sticker.

## Local Setup

```bash
cd api
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
cp env.example .env
uvicorn app.main:app --reload --port 8000
```

## Docker Setup

Create `api/.env` from `api/env.example`, then fill your database values.

```bash
cd api
docker-compose up -d --build
curl http://localhost:8000/health
```

The compose stack starts:

- `db`: MySQL 8.4, exposed on `127.0.0.1:${DB_PORT}`.
- `api`: FastAPI renderer, exposed on `http://localhost:8000`.
- `worker`: transactional outbox dispatcher for Telegram alerts and Mailtrap customer receipts after paid orders.

Inside Docker the API connects to MySQL with `DB_HOST=db`. From your Mac, use `127.0.0.1`.

For Telegram alerts and Mailtrap customer order confirmations, see
[Telegram order notifications](../docs/telegram-order-notifications.md) and
[customer order emails](../docs/order-confirmation-email.md).

## Import Existing MySQL Dump

If your dump is SQL:

```bash
cd api
docker-compose exec -T db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < /absolute/path/to/old-database.sql
```

If the dump is already inside this folder, paths are relative to your current directory:

```bash
cd api
docker-compose exec -T db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < mysql/init/ids_2025.sql
```

From the repository root, use the `api/` prefix:

```bash
docker-compose -f api/docker-compose.yml exec -T db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < api/mysql/init/ids_2025.sql
```

If the dump needs root privileges:

```bash
cd api
docker-compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < /absolute/path/to/old-database.sql
```

If the dump is gzipped:

```bash
cd api
gzip -dc /absolute/path/to/old-database.sql.gz | docker-compose exec -T db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```

After import, create or update the views in `sql/views.sql` so they match your existing table names:

```bash
cd api
docker-compose exec -T db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < sql/views.sql
```

## Key Endpoints

```text
GET /health
GET /{slug}/{catalog}_color-{color}.webp
GET /img/{design-slug}/{catalog}-{front|left-chest|back}.webp
GET /v1/products/{slug}
GET /v1/products/{slug}?catalog={catalog-slug}
GET /v1/products/{slug}/catalogs/{catalog-slug}/mockup?Color=Black&Size=S&Placement=front
GET /v1/mockups/render?product_id=...&artwork_id=...&template_id=...&variant_id=...
GET /m/{slug-publicid}?t=...
```

Product images use a fixed front view, WebP, and 1500px width (capped by
`MOCKUP_MAX_WIDTH`), without size or format query parameters. Colors accept the
catalog color slug, for example:

```text
http://localhost:8000/acacac2/classic-t-shirt_color-black.webp
http://localhost:8000/acacac2/classic-t-shirt_color-red.webp
```

The existing `/v1/products/.../mockup` endpoint remains available for back views
and legacy callers. Both endpoints share the disk render cache. Concurrent misses
are coalesced per worker and cache files are published atomically. Mutable product
URLs expire after one hour instead of being marked immutable for a year.
Artwork is composited at delivery resolution; WebP quality defaults to 94.
Existing `MOCKUP_WEBP_QUALITY` environment overrides still apply. Small garment
photos or artwork cannot gain real detail from upscaling; use high-resolution
source assets for the sharpest results.

## Rebuild the Gearment catalog

Put the Gearment client key and secret in `api/.env`, review the allowlist in
`api/catalog-import.json`, then run from the repository root:

```bash
bash scripts/import-gearment-catalog.sh
```

The command applies missing schema migrations, resets the selected Gearment catalog
rows by default, then imports the selected API catalogs and variants. Use
`--no-truncate` when an incremental import is required. It enriches catalogs from the
exact public product and category URLs in the manifest, keeps existing local mockups,
and imports only the default US color set: Black, White, Navy, Red, Royal and Sport
Grey. Missing local assets are reported as warnings and are not downloaded; pass
`--refresh-assets` explicitly when provider images must be downloaded or refreshed.
Catalog API and website payloads are cached in `api/catalog-import.cache.json` so
later runs do not need to call Gearment again; pass `--refresh-cache` to refresh that
file.

To remove all imported Gearment catalogs without making any provider request:

```bash
python -m app.cli truncate-gearment-catalogs
```

Use `--provider-id N3600` to truncate only one catalog. Truncation keeps local
mockups so the next import can reuse them; pass `--remove-assets` only when those
files should also be deleted. Rendered cache files are cleared because they contain
the old catalog database references.

To preview without database or catalog asset/cache-file changes inside the API environment:

```bash
python -m app.cli sync-gearment-catalog --manifest catalog-import.json
```

File-based preview URLs map a stable, descriptive design slug through
`public/design/manifest.json`, then resolve the mockup from
`public/mockup/{product-type}/{color}-{front|back}.png`. The canonical placement
is `front`, `left-chest`, or `back`; `left-chest` uses the front mockup and places
the artwork on the wearer's left chest:

```text
/img/rookie-dad-2024/t-shirt-black-front.webp
/img/rookie-dad-2024/t-shirt-black-left-chest.webp
/img/rookie-dad-2024/t-shirt-black-back.webp
/img/rookie-dad-2024/t-shirt-white-women.webp
/img/rookie-dad-2024/t-shirt-white-women-left-chest.webp
```

Model mockups use `-women` or `-men`; front is the default when the URL ends at
that style. Add `-left-chest` to select the chest placement. A style-specific
back image returns 404 until a matching `{color}-back-{style}.png` asset exists.

Catalog renders prioritize artwork fidelity: they preserve aspect ratio and
placement but do not apply fold displacement, generated shadows, or highlights.

The output format is selected by the final extension (`.webp`, `.png`, `.jpg`,
or `.jpeg`). Optional `width` controls output size and defaults to 1500px. Legacy
file-path/query URLs redirect permanently to the canonical URL. File paths are
restricted to `public/design`, and rendered responses use the deterministic cache.

The render endpoint returns `image/webp` by default. Add `format=png` for transparent/debug output or `refresh=true` to force a cache miss.

Home and listing cards use `product_catalogs.default_color_id` as the merchandising
selection. The mapping controls the catalog and color shown first; all active
colors and sizes from that catalog remain available on the product page. Assign a
specific color only when that color exists in the catalog:

```bash
cd api
python -m app.cli assign-product-catalog \
  --product hamburger-helper-glove \
  --catalog classic-t-shirt \
  --color black
```

To create a small rotating showcase for the main departments, run this after
products and catalogs have been imported:

```bash
python -m app.cli seed-product-showcase --per-category 8
```

The seed command assigns the requested number of active products **to each
eligible catalog** tagged as unisex (both men and women), women, kids, or
accessories. The same design can therefore appear on more than one garment
type, such as both a T-shirt and a hoodie. It rotates through Black, White,
Navy, Red, Royal, and Sport Grey, but always checks that the chosen color has
an active variant in that catalog. Re-running it updates the same mappings and
is safe. Use a larger value such as `8` or `12` when the storefront needs a
broader showcase.

Catalog-specific pages can still be opened without a saved assignment. Every
active product without a saved assignment remains visible in listings for every
eligible catalog. Once a product has an assignment, listings prefer that
catalog, while the assignment also decides which catalog/color is the default.

The catalog-specific storefront URL is:

```text
/product/hamburger-helper-glove/classic-t-shirt?Size=S&Color=Black
```

Gearment catalog images are rendered on demand. The API resolves the selected
color's hex value from `catalog_colors`, recolors the local front/back garment
asset while retaining its texture, then composites the product design into the
percentage-based print area stored in `artwork_guideline_json`.

Short image URLs:

```text
/m/1-up-k7q
/m/1-usmc-x2a?t=cc1717-white-front&w=900
```

Short aliases are `p_id`/`p`, `a_id`/`a`, `t_id`/`t`, `v_id`/`v`, `w`, `f`, and `r`.
If `a_id` is omitted, the API uses `product:{resolved_product_id}:artwork`.
For public image URLs, use `/m/{slug-publicid}`. Keep 2-5 useful slug words for SEO and append the 3-character public id. The API maps slug + public id back to the product without exposing sequential database ids.

Production should set `MOCKUP_URL_SECRET`. It is used to derive the 3-character public id.

Generate a public ref inside the API container:

```bash
docker-compose exec -T api python -c 'from app.settings import settings; from app.public_ref import build_product_ref; print(build_product_ref(secret=settings.url_signing_secret, product_id="2", slug="1-usmc"))'
```

## MySQL Contract

The API reads from these views:

- `pod_products`
- `pod_mockup_render_jobs`

Create those views on top of your existing tables. See `sql/views.sql` for the expected columns.

## Asset Contract

`pod_mockup_render_jobs` should return these asset paths or URLs:

- `base_source`: clean mockup image, usually JPG/PNG.
- `artwork_source`: artwork PNG/SVG, ideally transparent.
- `mask_source`: grayscale printable-area mask. White means printable.
- `displacement_source`: grayscale cloth height/fold map.
- `shadow_source`: grayscale shirt shadow map. Darker areas darken artwork.
- `highlight_source`: grayscale highlight map. Brighter areas lighten artwork.

Use `local/path.png|https://fallback.example/image.png` when an asset may or may not be synced locally yet. The renderer tries the local file first, then falls back to the remote URL.

`print_area` is JSON:

```json
{
  "dst_quad": [[420, 310], [820, 330], [790, 760], [390, 740]],
  "displacement_strength": 10,
  "shadow_opacity": 0.36,
  "highlight_opacity": 0.18,
  "artwork_fit": "contain"
}
```

The four `dst_quad` points are top-left, top-right, bottom-right, bottom-left in base image coordinates.

## Production Notes

- Put `api/.cache/mockups` on persistent disk for local deploys, or replace `FileCache` with R2/S3.
- Put a CDN in front of rendered URLs.
- Cache key includes product, variant, artwork, template, output width, format, and asset version fields.
- Warm the first 1-3 product images asynchronously when a product page is requested.

To preview or pre-render the images on a shop listing page, run this inside the
API container. It asks `/v1/shop` for the exact page/filter and requests each
card's selected image with concurrency limited to two by default. Rendered files
go into the shared persistent mockup cache, so subsequent public image requests
use the same URL and skip rendering; no duplicate files are needed under
`api/public`.

```bash
docker compose -f api/docker-compose.yml exec -T api \
  python -m app.cli prewarm-shop-images --department unisex --page 1 --dry-run
docker compose -f api/docker-compose.yml exec -T api \
  python -m app.cli prewarm-shop-images --department unisex --page 1
docker compose -f api/docker-compose.yml exec -T api \
  python -m app.cli prewarm-shop-images --department unisex --product-type hoodies --page 1
```

Warm the filtered landing page after deploying the API when its mockup cache is
empty. This prepares the first 24 Unisex hoodie images before customers open the
category; rendered files stay in the persistent shared mockup cache.

Use `--product-type`, `--catalog`, or `--collection` to match filtered shop
pages, `--page` to select a later page, and `--limit` up to 48. The command
prints the selected product/image list before rendering it.
