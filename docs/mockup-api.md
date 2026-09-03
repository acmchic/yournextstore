# Mockup API Plan

## Placement

Keep the API inside this repo as `api/` during phase 1-2. The Docker compose file also lives in `api/` so the Next.js app root stays focused on the storefront.

Why:

- Theme, product URL shape, image URL shape, and renderer contract will change together.
- One commit can update storefront + API contract.
- Branching to another `theme-*` branch is easier because the image API travels with the FE.
- Later extraction is straightforward once traffic and render cost are real.

## Runtime Choice

Use Python FastAPI for the renderer service.

Use Node/Next only as the frontend BFF layer if needed later. The realistic mockup problem is image geometry, not just CRUD. Python has the strongest OpenCV/Numpy path for perspective warp, displacement maps, masks, and highlight/shadow blending.

## First Production Contract

```text
GET /v1/mockups/render
  product_id
  artwork_id
  template_id
  variant_id
  width
  format=webp
```

Response is an image. The same request should be immutable and CDN-cacheable.

The Next.js app also exposes a same-origin proxy:

```text
GET /api/mockups/render
```

Set `POD_MOCKUP_API_URL=http://localhost:8000` for local development.

## Docker Bootstrap

```bash
cd api
docker-compose up -d --build
```

The API container uses `DB_HOST=db`. Host tools should use `DB_HOST=127.0.0.1`.

## Cache Strategy

Cache key:

```text
sha256(product_id, variant_id, artwork_id, template_id, version, width, format)
```

`version` should change when artwork, template, variant, or product visual data changes.

## Image Quality Requirements

Each mockup template should have:

- Base image
- Printable-area mask
- Destination quad points
- Displacement map
- Shadow map
- Highlight map
- Optional occlusion mask later for hands, hair, hoodie strings, and folds

Without these assets, no renderer can consistently avoid the sticker look.
