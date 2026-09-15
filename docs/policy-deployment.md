# Portable TeeBravo policies

`api/policies.json` contains seven English CMS policy templates plus business and
delivery settings. Business facts not supplied by the owner are blank. All pages
start as drafts. This is implementation support for Merchant Center requirements,
not a guarantee of Google approval or legal review.

## Configure once

Fill `details` and `delivery` in the JSON with verified operational facts. The
`privacy_details` field must specify actual service providers, retention,
analytics/cookies, disclosures and privacy requests. `terms_conditions` must cover
actual cancellation, acceptance and applicable legal terms. Return terms must
cover both defective and non-defective products, the window, procedure, fees and
refund timing. Do not publish until these have been reviewed.

Shipping prices are resolved from `checkout_settings`; the starter JSON leaves
rates unchanged. A DB export includes current rates. Optional `rates` uses cents:
`standard_first_minor`, `standard_additional_minor`, `express_first_minor`,
`express_additional_minor`.

Set `NEXT_PUBLIC_URL=https://teebravo.com` in the root environment and
`STOREFRONT_PUBLIC_URL=https://teebravo.com` in API and admin environments.
Leave `CHECKOUT_SUCCESS_URL` and `CHECKOUT_CANCEL_URL` blank to derive them from
that origin. Docker Compose passes NEXT_PUBLIC_URL at build time; rebuild the
storefront after a domain change because Next.js bundles public environment
variables. Laravel deployments must refresh their config cache.

## Import / export

Run API SQL migrations and Laravel migrations first (Laravel creates
`legal_pages`). From `api/`:

```sh
.venv/bin/python -m app.policy_config import policies.json --dry-run
.venv/bin/python -m app.policy_config import policies.json
```

The default import preserves all existing policy pages, adds missing pages and
merges nonempty business fields. It never clears facts using blank template values.
Use `--overwrite` deliberately when applying reviewed JSON content to existing
pages, including updated publication flags. Import is transactional and rejects
publication with missing or unknown tokens and invalid delivery ranges. Settings
from nonempty JSON fields are applied even when existing pages are preserved.

After editing/publishing in admin, export to a new file:

```sh
.venv/bin/python -m app.policy_config export policies.production.json
```

Keep this file securely with deployment configuration. On production, import the
same file (use `python` instead of `.venv/bin/python` inside the API container).
This carries page content, publication states, delivery ranges and shipping rates
without re-entering them in admin. It contains business contact information but
no database or Stripe credentials. Domain tokens always come from environment.
The export refuses to replace an existing file. Repeated default imports create
no duplicate pages; explicit overwrite reapplies the file as the chosen source.

Published pages are served at `/legal/{slug}` (About redirects to `/about`) and
are automatically listed in the footer and sitemap. Contact and FAQ use
`/legal/contact` and `/legal/faq`; the separate optional `/contact` form is not
required for the published contact policy. Unpublished pages remain unavailable.
Allow existing Next.js caches to expire or restart/redeploy after publication.

Before Merchant Center submission, verify all seven public links, a test purchase,
shipping/return account settings and actual support contact availability. Settings
in Merchant Center must be updated separately to match the store.

References checked 2026-09-14:
- https://support.google.com/merchants/answer/12756116
- https://support.google.com/merchants/answer/14011730
