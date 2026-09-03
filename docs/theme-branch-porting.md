# Theme Branch Porting Contract

Use this checklist whenever switching to another `theme-*` branch. The goal is to keep the storefront running without the paid YNS API and avoid re-solving the same checkout/runtime problems.

## Files To Carry Across

- `lib/storefront-config.ts` - brand name, positioning, and core copy tokens.
- `lib/local-commerce-data.ts` - local POD catalog seed data.
- `lib/local-commerce.ts` - local Commerce Kit-compatible adapter.
- `app/checkout/page.tsx` - local checkout placeholder.
- `api/` - Python FastAPI mockup renderer contract and on-demand image pipeline.
- `app/api/mockups/render/route.ts` - Next.js same-origin proxy to the renderer.
- `lib/mockup-image-url.ts` - helper for frontend image URLs.

## Required Patches On Each Theme

1. `lib/commerce.ts`
   - Import `localCommerce`.
   - Export remote `Commerce(...)` only when `YNS_API_KEY` exists.
   - Return `localCommerce.meGet()` inside `meGetCached()` when no key exists.
   - Return a local `{ subdomain, publicUrl }` from `getSubdomainPublicUrl()` when no key exists.

2. `proxy.ts`
   - Only proxy `/checkout` when `YNS_API_KEY` or `NEXT_PUBLIC_YNS_API_TENANT` exists.
   - Keep `/api/feed/*` proxy behavior separate from checkout.

3. Cart sidebar or checkout link component
   - If `YNS_API_KEY` exists, keep hosted checkout URL.
   - If no key exists, link to `/checkout?cartId=<cartId>`.
   - Keep checkout links as plain `<a>` tags when they point to hosted checkout.

4. App layout/header
   - Replace theme demo text such as `Sneakers` or `Your Next Store` with `storefront.brandName`.
   - Keep visual theme identity intact. Do not redesign the branch while porting the commerce layer.

5. Next instant-navigation warnings
   - If a catalog route reads `params`, `searchParams`, or cached commerce data outside Suspense and Next reports instant-navigation warnings, add `export const instant = false` to that route.

6. Mockup renderer
   - Keep `POD_MOCKUP_API_URL` in `.env.local` pointed at the Python service.
   - Keep image URLs same-origin through `/api/mockups/render` so theme branches do not need CORS or image-domain changes.

## Validation

Run after porting:

```bash
./node_modules/.bin/tsgo --noEmit
bun run lint
curl -I http://localhost:3000/
curl -I http://localhost:3000/products
curl -I http://localhost:3000/product/solar-bloom-classic-tee
curl -I http://localhost:3000/checkout
curl -I "http://localhost:3000/api/mockups/render?product_id=p&artwork_id=a&template_id=t"
```

## Git Workflow

Keep the commerce layer as one commit before testing visual changes:

```bash
git add lib/storefront-config.ts lib/local-commerce.ts lib/local-commerce-data.ts lib/commerce.ts proxy.ts app/checkout
git commit -m "feat: add local commerce fallback"
```

When testing a new theme branch, cherry-pick that commit first, resolve the small theme-specific header/cart link differences, then start visual work.
