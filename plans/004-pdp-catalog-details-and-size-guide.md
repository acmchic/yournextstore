# Plan 004 — Balanced PDP and catalog-backed size guide/details

Status: Ready for Luna max implementation and parent review.
Planned against e5dd75c plus the existing dirty working tree, 2026-09-08.

## Objective and scope

Improve the actual TeeBravo PDP at `/product/1-up-f951/sponge-fleece-hoodie-3719?Size=S&Color=Navy`. Root Next.js uses ownCommerce → FastAPI → MySQL; Laravel admin writes the same store DB. One design appears on multiple catalogs: guide/care/fit belongs to the selected catalog, never globally to the design. Preserve selection, price, stock enforcement, cart, image rendering and SEO facts.

User explicitly requests implementation by gpt-5.6-luna with max reasoning after this plan. Preserve all existing uncommitted work, do not reset, commit, push or touch unrelated surfaces. Inspect current files before editing; the working tree is the real baseline.

## Observed code

- `app/product/[slug]/add-to-cart-button.tsx`: renders SKU/stock block, VariantSelector, PrintPlacementSelector and QuantitySelector consecutively. Remove the visible SKU and low-stock/in-stock messaging block only. Keep out-of-stock add-to-cart disabling and accessible purchase state, quantities and backend validation.
- `app/product/[slug]/variant-selector.tsx`: URL options use exact Size and Color labels. Preserve matching `Size=S&Color=Navy`, other query params and variant state.
- `app/product/[slug]/page.tsx` and `[catalog]/page.tsx`: shared PDP, calls `productGetByCatalog` for selected body. Keep server-rendered title/price/metadata. Add catalog presentation data via a typed helper, not an unsafe SDK cast.
- `api/mysql/init/003_gearment_catalog.sql`: catalogs already have provider_description, description_override, provider_size_chart_json, size_chart_override_json and shipping_guideline_json.
- `api/app/gearment/web_catalog.py` builds size_chart object with `rows` via HTML table extraction. Inspect actual JSON shape before mapping; sanitize any provider HTML. Never inject raw imported HTML.
- `api/app/gearment/sync.py` stores provider description/chart. Preserve manual overrides during imports.
- `admin/app/Http/Controllers/Store/StoreController.php`: catalogForm select does not expose chart; saveCatalog validates description_override/material only. Extend this existing form and audit transaction.
- `components/ui/drawer.tsx` uses Vaul already installed at 1.1.2; `components/ui/sheet.tsx` uses Radix. Prefer existing primitives. Vaul supports bottom/right directions. Official refs: https://github.com/emilkowalski/vaul/blob/main/src/index.tsx and https://ui.shadcn.com/docs/components/base/drawer (new Base UI variant is a different stack; do not migrate the whole app just to call it latest).
- Policies are `legal_pages` published boolean, slug/title/content; admin `/legal`, public `/v1/legal-pages`. Reuse published policies, never invent return/refund windows/free shipping or publish drafts.

## Implementation sequence

### 1. Verify catalog data and define public contract

Read docs/project-context.md, docs/google-merchant-center-ads-checklist.md, relevant Next local docs and frontend-design skill. No available next-devtools init was found; use local Next docs. Inspect selected hoodie size_chart JSON with read-only DB/API; never source `.env` or print secrets. Normalize override-first/provider-second charts into `{title?, unit?, columns: string[], rows: string[][], note?}` with bounds and safe text. Preserve provided units, do not guess inches/cm or convert unspecified units. Distinguish malformed override from absence, validate in admin. If provider chart lacks measurements, show unavailable rather than fabricated rows.

Add catalog-specific presentation endpoint (e.g. GET /v1/catalogs/{slug}/details) and typed adapter helper. Response includes description, material, chart, fit text, care text, and published policy link/detail summaries. Match catalog slug and source alias consistently with product detail; inactive/missing catalog returns 404. Do not leak provider URLs, internal DB IDs or raw HTML into UI. Keep this separate from expensive render data.

### 2. Catalog CMS

Reuse existing size_chart_override_json, description_override. Add nullable fit/care fields and return/refund/shipping policy references if absent, through a new additive Laravel store migration; follow existing 2026_09_08 migrations. Policy references must resolve to published pages publicly; store references to drafts may exist for preparation but never render draft text/links.

Extend catalog edit form with labeled Product details, Size & fit, Product care, size-chart editor/validated JSON plus preview and explicit empty/reset-to-provider behavior. Add policy selectors populated from legal_pages. Prefer full policy text or separately authored catalog summary, not crude substring HTML. Return/refund can reference the same policy. Do not auto-populate promises from unrelated catalog. Keep provider fields read-only and overrides stable through importer sync. Audit new fields using existing StoreController audit.

Apply only this additive migration to local DB when required, using tool escalation if sandbox blocks. No destructive data operations.

### 3. PDP composition and spacing

Retain two-column image/purchase composition. Use coherent 24–32px spacing between selector groups, 10–12px label-to-control spacing, generous 28–32px divider offsets; responsive 20–24px mobile spacing. Specifically fix Color and Quantity looking attached to the previous control. Prefer explicit group wrappers/gap to blanket margins that affect nested swatches.

Place “Size guide” alongside Size label. Use US size labels from catalog (do not copy FR/EUR from reference). Remove SKU + “Only 1 left in stock” presentation. Product details, Size & fit, Product care, Shipping/Returns & refunds become restrained uppercase rows with thin dividers, accessible accordion/disclosure and optional See details policy links. Render only factual available content; do not present empty sections as completed policies. Keep useful product details server-rendered/crawlable even if visual disclosure is collapsed.

### 4. Responsive guide and interaction components

Build a reusable client responsive panel with Vaul bottom drawer on mobile (<768px) and right slide-over desktop (Vaul right or existing Radix Sheet). Mobile has drag handle, scrollable table, safe-area bottom padding, max height 85–90svh. Desktop width about 480–600px, full height, explicit close. Both: opaque background, modal overlay, title/description, Escape/outside close, focus trap/restoration, no scroll bleed. Avoid hydration mismatch with SSR-safe media hook and do not duplicate dialog semantics. Opening/closing must not change Size/Color query or reset cart quantity. Table horizontal scroll must not break swipe dismissal; use handle-only drag if necessary.

Add pointer cursor for actionable buttons (excluding disabled), visible keyboard focus and restrained hover/press transitions 150–220ms. Shared Button primitive plus native PDP controls; scope global rules carefully. Use transform/color/opacity, no layout animation. Respect prefers-reduced-motion. Do not add Motion merely for simple transitions: existing Vaul/Radix + CSS suffice; if dependency change is needed, verify official current compatibility and explain choice.

### 5. Verification and review

Tests: chart normalization (provider/override/empty/malformed/units), selected-catalog isolation, inactive 404, unpublished policy exclusion, admin save/validation, preserved import override. Model API tests on tests/test_shop.py; admin isolated SQLite tests like LegalPagesTest (never production DB in tests).

Commands (run in correct directory):
- root `bunx tsgo --noEmit`, `bunx biome check app components lib` (check, scoped format on changed files only), `bun test lib`.
- api `.venv/bin/python -m pytest tests -q`.
- admin `/Users/changha/.bun/bin/bun run types:check`, `php artisan test --compact --filter=<new tests>`, `bun run build` using absolute bun if PATH missing.
- root `bun run build`; sandbox previously hangs/fails API/font access, retry require_escalated. Do not leave hung build processes.

Browser: exact URL at 390x844 and 1440x900. Verify S/Navy remain selected, spacing, SKU/low-stock absence, guide data matches hoodie, mobile bottom/desktop right directions, close/Escape/focus, scroll/drag, stock zero disabled, reduced motion and no console errors. Capture screenshots. If chart is empty, test actual renderer with a clearly isolated fixture/test rather than writing fake measurements to live catalog. Parent reviews final diff and rechecks critical interactions.

## Boundaries and completion

No checkout/payment redesign, header/home redesign, pricing/stock data edits, unverified shipping/care statements, mass dependency upgrades, fake chart measurements. Keep SKU in feed/JSON-LD/backoffice. Escalate concrete missing-data questions to parent while continuing independent UI/data plumbing.

Done means code in current workspace, migrations applied if needed, checks pass, actual browser verification, docs/project-context.md and this plan status updated with precise remaining data limitations. Report changed files and tests. Do not stop after implementing a tiny UI slice; finish API/admin/PDP integration.
