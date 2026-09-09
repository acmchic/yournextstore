# Plan 003 — Premium home, catalog navigation, SEO/Merchant readiness, and admin legal pages

Status: Homepage, navigation, collections and policy CMS implemented; business launch gates pending  
Written against commit: `e5dd75c`  
Owner: storefront + API + admin implementation agent

## Implementation update — 2026-09-08

Latest verification: storefront production build and admin build pass; storefront/admin TypeScript pass; Biome on app/components/lib passes; 35 API tests, 4 adapter/merchant tests, 3 Laravel policy tests (20 assertions) pass. Seven core routes pass regular-user vs Googlebot status/title/canonical/branding checks. Mobile 390px, tablet 768px and desktop 1440px inspected; desktop has no horizontal overflow.

Home now uses Hero → HomeCollections with database-backed New Arrivals/Graphic Tees and a concise brand module. Admin Collections supports automatic/manual selection, featured state, drafts and order. Both collections and departments paginate in SQL. Shared taxonomy navigation sorts/deduplicates type links. Legal edits have transactional activity history and stable URLs. Sitemap includes populated catalog/department routes; robots permits product imagery. Removed nonfunctional Favorites and newsletter form from home.

Prepared a disabled-by-default Google XML feed and common merchant variant mapper. Launch remains blocked by real payment integration (explicitly out of scope), business-approved policies, public HTTPS images and review of existing product/artwork data. Full live feed/checkout parity and Google review cannot be claimed from the local checks. See `docs/project-context.md` for current operating details. Historical bullets below describe earlier progress, superseded by this paragraph where different.

- Header/mobile menu now exposes department/type filters; keyboard focus opens desktop submenus. Footer support links are visible on mobile. Removed outer storefront shadow/frame and duplicate logo H1.
- Department pages filter matching catalogs by `?type=`, preserve design+catalog identity and reject invalid departments/types. Collection lookup uses product slugs.
- Admin `/legal` supports creation, editing, plain-text preview, draft/published state and unpublishing. Slugs are validated and unique. Public `/v1/legal-pages` reads published pages only. Storefront escapes text before HTML rendering; footer and existing sitemap consume published policies.
- Run `php artisan migrate --force --path=database/migrations/2026_09_08_000001_create_legal_pages_table.php` in admin before deploying the API change. Applied locally. No policy content or business promises have been invented or published.
- ProductGroup IDs distinguish catalog bodies; aggregate availability reflects variant stock.
- Verified storefront/admin type checks, scoped storefront Biome, 3 adapter tests, PHP/Python syntax, local policy API and mobile menu. Production build has not completed.
- Still needed: curated collection management/home editorial modules, bounded department pagination (current catalog fan-out loads up to six designs per body), policy revision audit/history, complete feed/variant parity and checkout/payment launch validation, business-approved policy content, full responsive visual QA. Do not describe this plan as complete or Merchant Center approved.

## Objective

Turn the current TeeBravo home page into a deliberate US premium graphic-clothing storefront, make navigation reflect the imported catalog taxonomy (`Men`, `Women`, `Kids`, `Accessories`, with `Home & Living` kept separate or hidden from the clothing primary nav), make collection/category pages crawlable and useful, and make policy pages editable from Laravel admin and consumable by the storefront/API.

The implementation must preserve the existing design-to-catalog model: one design can be offered on multiple catalogs. A catalog is the blank/product body; it is not a collection and must not be presented as a design collection.

## Evidence and current state

- `app/page.tsx` is only `Hero → CatalogShowcase → About → Newsletter`.
- `components/sections/catalog-showcase.tsx` already groups catalog taxonomy by department/type, but selects nine individual catalog samples and places the taxonomy in a desktop sidebar. Its mobile navigation only exposes the first catalog from each department.
- `lib/own-commerce.ts` maps catalogs to the Commerce Kit `category` shape and exposes `catalogBrowse`, but `collectionBrowse` reads the API collections endpoint. The adapter's `legalPageBrowse` and `legalPageGet` currently return empty/null at the end of the file.
- `api/app/repository.py` already returns catalog taxonomy from `catalog_taxonomy` and collections from `collections`; `api/app/main.py` exposes `/v1/catalogs`, `/v1/collections`, and `/v1/collections/{slug}`.
- `api/catalog-import.json` has 40 provider entries with taxonomy departments including `men`, `women`, `kids`, `home-living`, and `accessories`.
- `app/sitemap.ts` emits product, collection, legal, and optional blog URLs; `app/legal/[slug]/page.tsx` expects `commerce.legalPageGet(slug)`.
- `admin/routes/web.php` and `StoreController` have product/catalog/order routes but no legal-page CRUD route. The admin currently uses direct `store` DB access.
- `docs/google-merchant-center-ads-checklist.md` requires consistent title, description, image, price, currency, availability, condition, brand, SKU/MPN/GTIN, variant attributes, crawlable product pages, visible trust pages, and a real purchase path.

## Product and information architecture decision

Use this primary navigation:

```text
Shop
├── Men
│   ├── T-Shirts
│   ├── Hoodies
│   ├── Long Sleeves
│   └── Sweatshirts
├── Women
│   ├── T-Shirts
│   ├── Hoodies
│   ├── Long Sleeves
│   └── Sweatshirts
├── Kids
│   ├── T-Shirts
│   ├── Hoodies
│   └── Sweatshirts
├── Accessories
│   ├── Flags
│   └── Ornaments
└── Collections
    ├── New arrivals
    ├── Graphic tees
    └── Gifts / seasonal edits (only when real products exist)
```

`Home & Living` catalog records can remain available through `/category/...` and sitemap when they have active products, but should not be mixed into the premium clothing hero/navigation unless the product assortment and copy explicitly support it. Do not invent collections that have no products.

Use `/category/{catalog-slug}` for a catalog/body page and `/collection/{collection-slug}` for a merchandising collection. Use a query or path segment to preselect product variants only when the same product page can show the exact advertised variant; every submitted Merchant Center variant must resolve to a stable product URL.

## Implementation phases

### Phase 0 — Data contract and acceptance fixtures

1. Add a read-only API/adapter contract for navigation data. Return departments, type labels, catalog slug/name, active product count, and a stable sort order. Reuse `catalog_taxonomy`; do not infer department from a catalog name in React.
2. Add a small fixture or API test covering at least one catalog in each target department, a catalog with multiple taxonomy rows, an inactive catalog, and a zero-product catalog. Follow existing `api/tests/test_gearment_catalog.py` and `api/tests/test_product_media.py` patterns.
3. Define collection seed data in the database/admin rather than hardcoding product slugs in the homepage. Minimum launch collections: `new-arrivals` (sort by published date), `graphic-tees` (catalog product type in approved clothing types), and one optional editorial collection only when its products are selected by an admin.

Verification: `api/.venv/bin/python -m pytest api/tests -q` and a direct `GET /v1/catalogs`, `GET /v1/collections` check show stable data and no duplicate catalog links.

### Phase 1 — Admin-managed legal/trust pages

1. Add a `legal_pages` schema migration if the current database does not already contain a writable equivalent. Required fields: stable `slug`, public `href`, `label`, `title`, `body`/rich content, `status` (`draft`/`published`), `seo_title`, `seo_description`, `updated_at`, and optional sort order. Use a unique slug and an index on published status.
2. Add Laravel model/query/controller methods and authenticated routes under `admin/routes/web.php` for list, create, edit, publish/unpublish, and update. Keep writes on the existing `store` connection and add activity-log entries for changes, matching `StoreController::audit`.
3. Add Inertia admin pages under `admin/resources/js/pages/legal-pages/`. Include previews, explicit published status, and validation. Seed editable launch pages: Shipping, Returns & Refunds, Privacy, Terms, Contact, FAQ, and About/Business information. Do not publish placeholder claims, fake addresses, or promises the business has not decided.
4. Implement API repository methods and FastAPI routes for published legal pages only. Update `lib/own-commerce.ts` `legalPageBrowse`/`legalPageGet` to call those endpoints and map the exact existing `app/legal/[slug]/page.tsx` shape. A draft must return 404 publicly.
5. Keep legal URLs stable once submitted to Google. Update sitemap only from published pages; add `noindex` only to admin/draft routes, not public policy pages.

Verification: admin feature tests cover create/update/publish/draft visibility; API tests cover published filtering and 404 for drafts; storefront tests verify `/legal/shipping`, `/legal/returns`, and `/legal/privacy` render server-side with the saved content.

### Phase 2 — Home page information architecture and premium merchandising

1. Replace the single catalog sample grid in `CatalogShowcase` with intentional homepage modules:
   - Hero with one clear value proposition and one primary CTA (`Shop the current edit`).
   - Department rail/cards for Men, Women, Kids, Accessories; each links to a department landing route backed by taxonomy.
   - New Arrivals grid backed by a collection/API query, limited to 4–8 products.
   - Graphic Tees or current editorial collection grid, only when populated.
   - A concise brand/quality section with factual copy about artwork, garment selection, print method, and made-to-order handling.
   - Trust strip linking to Shipping, Returns, Contact, and FAQ; do not claim free shipping, delivery times, or returns until admin content contains those policies.
2. Keep the visual system already present in `hero.tsx`, `catalog-showcase.tsx`, and `about.tsx` (strong type, borders, editorial grid), but improve hierarchy: fewer competing headings, consistent card image ratios, clear product title/price, and mobile-first section spacing. Do not use generic AI-fashion copy or unverified “premium” construction claims.
3. Add explicit empty/error states. If a collection has zero products, hide the module or show an intentional editorial placeholder that is not included in structured product data.
4. Use server-side parallel fetching for independent homepage modules and cache only data whose freshness is acceptable. Follow the existing `use cache`/`cacheLife` conventions and avoid blocking the first HTML on client-only requests.

Verification: screenshot desktop/tablet/mobile, inspect initial HTML with a Googlebot user-agent, and confirm the home page contains no links to empty collections, no duplicate product cards, and no misleading product claims.

### Phase 3 — Department sidebar, mega menu, and category landing pages

1. Extract the taxonomy grouping logic from `components/sections/catalog-showcase.tsx` into a shared server-safe helper. It must normalize department labels and type ordering from API data, deduplicate catalogs, exclude inactive/zero-product items from public navigation, and keep `home-living` outside the clothing primary menu unless explicitly enabled.
2. Build a responsive `Shop` menu/mega menu used by `app/navbar.tsx`: desktop grouped columns, mobile accordion, keyboard/focus support, visible active state, and links to canonical department/type routes. Avoid exposing 40 provider catalog names as the top-level customer experience.
3. Add department landing routes (for example `/shop/men`, `/shop/women`, `/shop/kids`, `/shop/accessories`) backed by a server API query, with unique title, description, breadcrumb JSON-LD, product grid, and links to supported catalog/type pages. Decide and document whether these routes are indexable; index only pages with enough active products and useful unique content.
4. Keep `/category/{catalog}` for catalog-specific landing pages. Improve title, description, canonical, pagination, product count, and breadcrumb handling. A catalog page must not imply that the catalog itself is a design collection.
5. Add canonical and pagination rules: noindex/filter query variants unless intentionally curated; preserve product/category URLs used by feeds; never canonicalize a variant feed URL to a different product.

Verification: route tests for every department, accessibility keyboard pass for menu, no 404 links from the navigation, and sitemap output contains only indexable populated routes.

### Phase 4 — Merchant Center and SEO data alignment

1. Define one normalized product/variant export model shared by product JSON-LD, future Google feed endpoints, sitemap links, and the landing page. It must include stable `id`, `item_group_id` (product public ID), variant SKU, title, description, image, canonical variant URL, price/currency, availability, condition, brand, color, size, gender/age group where applicable, and product type/category.
2. Fix current variant URL behavior before feed launch. For every submitted color/size variant, produce a URL that preselects that exact variant and ensure the initial server HTML, visible price, visible availability, selected image, and JSON-LD match that URL. Google requires apparel variants in the US to have `item_group_id`, color, and size; Google’s variant structured data uses `ProductGroup`, `productGroupID`, `variesBy`, and `hasVariant` ([Merchant Center apparel specification](https://support.google.com/merchants/answer/14779112?hl=en), [Product variant structured data](https://developers.google.com/search/docs/appearance/structured-data/product-variants?hl=en)).
3. Extend `lib/json-ld.tsx` with organization-level merchant return/shipping policy markup once admin policies are published, and ensure product brand is TeeBravo while provider blank brand remains a catalog attribute where appropriate.
4. Add/verify Google feed routes under `/api/feed/` using the same normalized model. Include only products with a real purchasable variant, valid image, price, currency, availability, stable landing URL, and policy/trust pages. Do not invent GTIN; use SKU/MPN only where valid.
5. Make crawl behavior stable across regular users and Googlebot: same currency (USD), language (en-US), price, availability, product image, and add-to-cart state. Product facts must be in initial HTML and JSON-LD, not only after client hydration. Google’s landing-page rules explicitly require the submitted data to match title, description, image, price, currency, availability, and buy action for crawlers and users ([landing page requirements](https://support.google.com/merchants/answer/4752265?hl=en)).
6. Add a pre-submit audit script/test that fetches each feed URL and product URL with normal and Googlebot user agents, validates status/canonical/JSON-LD, compares feed values to page values, checks image status and dimensions, and reports missing policy links.

Verification gates: `tsgo --noEmit`, `bun run lint`, `bun test`, API pytest, feed schema validation, Google Rich Results/Schema validator checks, and a crawl smoke test over all submitted URLs.

### Phase 5 — Content and launch QA

1. Create a content matrix for each department, collection, catalog type, and legal page: title, meta description, H1, intro text, image alt text, canonical, indexability, and owner.
2. Review all product/design titles and descriptions for US English, trademark/copyright safety, accurate garment type, and no unsupported quality or fulfillment claims.
3. Run responsive screenshots at mobile, tablet, desktop; verify menu, product grid, image loading, focus order, contrast, and no layout shift.
4. Run a production-like crawl with Googlebot and verify: robots allows public product/category/legal pages, disallows cart/checkout/search/API as intended, sitemap uses `https://teebravo.com`, and no old starter branding appears.
5. Submit only after checkout has a real conventional payment path and shipping/returns/tax terms are visible, because the current checkout is a preview and cannot yet satisfy Merchant Center submission requirements.

## Files in scope

`app/page.tsx`, `app/navbar.tsx`, `app/sitemap.ts`, `app/robots.ts`, `app/legal/[slug]/page.tsx`, `components/sections/catalog-showcase.tsx`, new shared navigation/department components, `lib/own-commerce.ts`, `lib/json-ld.tsx`, `api/app/main.py`, `api/app/repository.py`, API schema/migrations/tests, `admin/routes/web.php`, `admin/app/Http/Controllers/Store/StoreController.php` or a dedicated legal controller, `admin/resources/js/pages/legal-pages/`, and relevant test/fixture files.

## Explicitly out of scope

Do not redesign checkout/payment integration inside the homepage work; do not change provider catalog pricing or stock without a separate data migration; do not delete existing catalog records; do not create fake reviews, shipping times, return promises, certifications, GTINs, or business identity; do not submit non-apparel home/living items to the clothing feed category.

## Dependency order

```text
0 data contract/fixtures
├── 1 admin legal pages → 4 policy/schema/feed alignment
└── 2 homepage merchandising
    └── 3 taxonomy navigation/category routes
        └── 4 SEO + Merchant feed alignment
            └── 5 launch QA and submission
```

## Risks and escape hatches

- If the API’s collection schema cannot express automatic “new arrivals” or department filters, stop and add the smallest repository query/migration first; do not hardcode product IDs into the homepage.
- If existing `/legal/[slug]` expects a different `href` convention, preserve current public URLs and add a compatibility mapper rather than changing all links at once.
- If a catalog has no usable mockup/image or no active variants, exclude it from public navigation and feed exports and report it to admin; do not make the page look populated with unrelated images.
- If payment, shipping, returns, or business identity information is not finalized, keep those pages as drafts and block Merchant Center submission in the launch checklist.

## Definition of done

- Homepage has a clear TeeBravo value proposition, curated populated collections, and department entry points.
- Desktop and mobile navigation are generated from catalog taxonomy and expose Men/Women/Kids/Accessories without listing every provider catalog at the top level.
- Admin can create, edit, preview, publish, and unpublish legal/trust pages; storefront and sitemap consume only published pages.
- Every indexable product/category/collection page has stable title, description, canonical, breadcrumbs, crawlable product facts, and no misleading empty state.
- Feed, JSON-LD, visible page, cart, and checkout use the same variant price, USD currency, availability, SKU, image, color, and size source.
- Googlebot and normal users receive the same key product facts; a variant feed URL preselects the matching variant.
- All verification gates in Phases 0–5 pass, and no public placeholder or unverified business claim remains.
