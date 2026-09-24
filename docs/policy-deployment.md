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

Published pages are served at `/{slug}`, including `/contact` and `/faq`.
Legacy `/legal/{slug}` URLs permanently redirect (308) to the root URL.
Footer links, canonical metadata, sitemap and return-policy JSON-LD use the same
root URLs. Contact content no longer depends on the optional contact-form flag.
Unpublished pages remain unavailable.
Allow existing Next.js caches to expire or restart/redeploy after publication.

Before Merchant Center submission, verify all seven public links, a test purchase,
shipping/return account settings and actual support contact availability. Settings
in Merchant Center must be updated separately to match the store.

References checked 2026-09-14:
- https://support.google.com/merchants/answer/12756116
- https://support.google.com/merchants/answer/14011730

## TeeBravo production seed (2026-09-22)

`api/policies.teebravo.json` is the completed, owner-requested English policy
configuration. It includes the Hanoi business address, help@teebravo.com, all
shipping rates and delivery ranges, and seven published pages. `api/policies.json`
remains the generic draft template; do not import it over the production content.

`TeeBravoPolicySeeder` writes the configuration and pages together on the Laravel
`store` connection. Migration `2026_09_22_000007_seed_teebravo_policies` runs it
once during the existing admin deployment migration step. Deploy with `--all` for
a fresh installation (API checkout schema must exist first), or `--admin` for an
existing installation. Docker includes the JSON, and deployment fingerprints
include it. Later migrations/deploys do not rerun this seed, preserving admin edits.
No checkout activation, Stripe secrets, tax settings or PDP visibility switches
are changed. This is a forward-only data migration; rollback does not delete policies.

To deliberately reapply the checked-in policy configuration, including overwriting
later admin edits, run from `admin/`:

```sh
php artisan db:seed --class=TeeBravoPolicySeeder --force
```

The seed is repeatable without duplicate pages. Export a backup with the existing
Python policy exporter before deliberately reapplying it. The seeder preserves
unrelated settings, validates publication tokens, and rolls back on failure.

### Business decisions and sources

The owner authorized drafting POD return terms and requested Mango delivery times.
Mango's Help Center, checked September 22, 2026, lists US Standard transit at 5–7
business days and Express at 1–2. Its production FAQ lists US1 and normal FASTUS at
1–3 business days, with seasonal production delays possible. These are separate
production and transit ranges; Priority (1–3 days) is not Express. The seed uses
1–3 processing, 5–7 Standard transit and 1–2 Express transit. Use appropriate
product-specific estimates if fulfillment changes or other production lines are
introduced. Retail rates remain Standard $5 + $3/additional item and Express
$11 + $4/additional item; these are TeeBravo prices, not Mango wholesale charges.

Source: https://mangoteeprints.com/help (search “Shipping” and “Production Time”).
The linked Q3/2026 source workbook also distinguishes production from the time
until the first in-transit scan:
https://docs.google.com/spreadsheets/d/1QwxBJWHidF11snevroYm48rBdoGwZx2GTrrwHgetFcs/edit#gid=300751255

TeeBravo's customer policy is a business decision, not a claim that Mango reimburses
every customer remedy: customers report defects, damage and wrong items within
30 calendar days of delivery and choose a free replacement or refund after review.
No physical return is required for approved claims. Customer-selected wrong sizes,
change of mind and ordinary wear are excluded, with statutory rights preserved.
Approved refunds are submitted within 2 business days; bank posting may take a
further 5–10 business days. These are operational commitments to honor.

Google permits defective-only policies but requires explicit treatment of buyer's
remorse and consistent public terms. Its documented return-method choices concern
physical returns and do not document a dedicated “returnless refund” option. Do
not falsely promise a mail return label or in-store returns to fit a form. Configure
Merchant Center to represent the actual policy and clarify the returnless procedure
with Google support if its current setup requires a physical return method. Do not
advertise universal “free 30-day returns.” Website changes do not update GMC.

- https://support.google.com/merchants/answer/14011730
- https://help.printful.com/hc/en-us/articles/360014006840-What-is-Printful-s-return-and-refund-policy
- https://www.redbubble.com/agreement (comparison only; no copied terms)
- https://www.ftc.gov/business-guidance/resources/selling-internet-prompt-delivery-rules
- https://stripe.com/privacy

The privacy copy describes the current cart, payment, support, hosting and
fulfillment flow. Revisit it before adding advertising pixels, analytics or new
data practices. Contact details supplied by the owner are used as given; no legal
entity registration, phone number, operating history or certification is invented.
Google approval still depends on the full store, products, purchase path and actual
operations; this seed is not legal certification or a platform approval guarantee.

## Editorial release (2026-09-25)

Deploy this release with `sudo bash deploy.sh --api --admin` (or `--all`) from
`/srv/teebravo/repository`. Plain `deploy.sh` deploys only the storefront and does
not run Laravel migrations. The existing backend Dockerfile already bundles
`api/policies.teebravo.json`; the admin deployment fingerprint includes it.

Migration `2026_09_25_000010_refresh_teebravo_policy_content` runs
`TeeBravoPolicyContentSeeder` once. It refreshes the seven policy pages and the
About, returns, privacy and terms text in `checkout_settings.details_json` in a
single transaction. It preserves nonempty business name/address/support email,
shipping restrictions, all shipping rates and delivery ranges, unrelated detail
keys, and checkout/PDP switches. Missing business identity fields use the existing
TeeBravo seed values. Missing delivery values block publication and roll back the
transaction. Existing CMS prose for these seven pages is intentionally replaced
by this editorial release; later deployments do not rerun it. Rollback does not
remove published policy data.

For an intentional manual repeat of this content-only release, use
`php artisan db:seed --class=TeeBravoPolicyContentSeeder --force`.
Do not use the original `TeeBravoPolicySeeder` for a content refresh: that initial
setup seeder also resets rates and business configuration to the JSON values.
Export a backup before manually reseeding. Policies continue to render live rates,
delivery ranges and contact fields; prose detail fields refer to the support
address below instead of embedding a second email address.

The About page's business address, operator name and support email now use the
same API configuration as Contact. Deploy API, admin and storefront together.
The static About editorial sections and brand descriptions are in storefront
source; changing CMS About text does not replace that editorial layout.

Reference review: TeeNavi About, shipping, replacement/refund, privacy and terms;
TheGiftio shipping, return/refund, privacy and terms. TheGiftio About was blocked
by Cloudflare in both the web reader and browser; its company LinkedIn description
and homepage provided limited brand context. No competitor identity, return
promise, customer count, origin claim or personalization capability was adopted.

Official requirements reviewed:
- https://support.google.com/merchants/answer/6150127
- https://support.google.com/merchants/answer/14011730
- https://policy.pinterest.com/en/merchant-guidelines
- https://help.ads.microsoft.com/resources/Microsoft_Advertising_Agreement_08042025_Online_Terms/en.pdf

Copy changes cannot guarantee approval. Before submission, verify a real purchase,
product/feed/checkout agreement, design rights and support availability. Match
platform shipping and returns settings to the live store. Pinterest also requires
fresh price/availability data and excludes some product categories, including
political campaign merchandise. Its announced November 12, 2026 guideline update
must be reviewed when applicable. If Microsoft UET or other advertising trackers
are introduced, update privacy disclosures and consent behavior to reflect the
actual integration before enabling tracking. This release does not enable pixels.
