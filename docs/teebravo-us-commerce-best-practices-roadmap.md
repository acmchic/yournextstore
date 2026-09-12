# TeeBravo US Commerce Best Practices & Implementation Roadmap

## Executive summary

TeeBravo should not copy any one benchmark wholesale. The strongest direction is a premium, editorial graphic-apparel brand: borrow GitHub Shop's campaign storytelling, Son of a Tailor's product-detail clarity and proof, and Printerval's search-demand taxonomy—but reject Printerval's visual density, permanent-discount framing, and IP-risk marketplace behavior.

The current storefront already has a distinctive monochrome editorial foundation, a usable department hierarchy, crawlable product routes, variant URLs, JSON-LD, sitemap, a real cart, and Stripe Checkout. However, the observed local storefront is not ready for public traffic acquisition or merchant review: a sampled PDP showed a blank primary image, an implausible `$2.52–$18.00` price range, no published return information, and no public policy links in the footer. These are launch blockers, not polish items.

The recommended sequence is:

1. Make every purchase fact true, complete, stable, and publicly visible.
2. Strengthen the PDP around product proof, fit, delivery, returns, and a single decisive CTA.
3. Build demand-led collections and editorial landing pages instead of publishing a large undifferentiated catalog.
4. Establish measurement, Search Console, Pinterest Business, domain claiming, and reusable creative production.
5. Launch Google free listings before paid Shopping campaigns; use real conversion and fulfillment data to decide when paid acquisition is safe.

## Research basis and limitations

This report combines direct visual/structural inspection of TeeBravo's local storefront on 12 September 2026 with inspection of [GitHub Shop](https://thegithubshop.com/), [Son of a Tailor](https://www.sonofatailor.com/), its [Cotton T-Shirt PDP](https://www.sonofatailor.com/product/cotton-t-shirt/1-1-3-9-12), and [Printerval](https://printerval.com/). It also uses current official guidance from Google, Pinterest, and the FTC, plus apparel usability research from Baymard.

Observations of competitor interfaces are point-in-time examples, not proof that a particular component raises conversion. Any material conversion change should be instrumented and tested after TeeBravo has enough traffic.

## Strategic position

### Recommended promise

**Distinctive graphics on dependable everyday garments.**

TeeBravo's advantage should be curation and clarity—not being the largest POD marketplace or the cheapest T-shirt store. A customer should remember the artwork first, immediately understand the garment body and fit, and feel confident that what arrives will match the mockup.

### Brand pillars

| Pillar | Customer meaning | Required proof |
|---|---|---|
| Graphic point of view | Designs feel selected, not scraped | Tight collections, consistent art direction, artist/design story |
| Garment confidence | The blank is not an afterthought | Fabric, weight, fit, size chart, model measurements, care |
| Mockup accuracy | The image represents what will arrive | Correct color, print area, placement, scale, front/back views |
| Honest made-to-order service | No vague urgency or fake scarcity | Processing time, delivery range, return/remake rules, support route |
| US-ready buying | Familiar, low-friction checkout | USD, US shipping, conventional card checkout, total cost before payment |

### What not to become

- Do not imitate a marketplace full of unrelated products, keywords, and themes.
- Do not use perpetual countdowns, inflated compare-at prices, unverified “best seller” labels, or fake social proof.
- Do not publish trademark, celebrity, sports-team, movie, music, or political designs without documented rights.
- Do not call blanks, print, materials, sustainability, durability, or production “premium” unless the statement is specific and substantiated.

## Benchmark synthesis

### GitHub Shop: brand world and campaign merchandising

What works:

- One bold campaign idea leads the homepage instead of a generic product grid.
- Campaign photography and copy create a recognizable world around merchandise.
- The top taxonomy is shallow: All Products, Apparel, Lifestyle, Collectibles.
- New arrivals and category modules provide clear second steps.
- Footer navigation is compact and includes contact, FAQ, terms, privacy, newsletter, and social channels.
- Image descriptions are unusually descriptive, supporting accessibility and product understanding.

Apply to TeeBravo:

- Turn the homepage hero into a seasonal/editorial “drop,” with one visual story and one primary collection CTA.
- Keep the primary navigation short; put the full body/catalog taxonomy inside department menus and filters.
- Commission or generate rights-safe lifestyle assets per collection, while keeping accurate isolated mockups on PDPs.

Do not copy:

- GitHub can rely on enormous pre-existing brand equity. TeeBravo must provide more product, shipping, return, and business proof above the fold.

### Son of a Tailor: premium PDP and evidence hierarchy

What works:

- Large, high-resolution product and on-body imagery dominates the page.
- The buy panel keeps name, price, color, sizing, and CTA tightly grouped.
- Material, construction, production, guarantee, shipping, care, FAQ, and reviews are available without leaving the decision context.
- Specific details—fiber, fabric weight, drape, factory, quality checks—justify premium pricing better than adjectives.
- The visual system is restrained: warm white, black, narrow type hierarchy, few decorations, and generous whitespace.

Apply to TeeBravo:

- Keep the existing split PDP, but make the image gallery reliable and the right-side purchase panel more legible.
- Show exact catalog/blank facts: brand, model, fabric composition, fabric weight, fit profile, care, print method, and print placement.
- Add model/lifestyle views and close-up print texture as secondary images.
- Replace generic “Built like a drop” claims with product-specific evidence.
- Put the size guide immediately beside the size control, preserve browser-back behavior, and include product-specific measurements.

Do not copy:

- Do not imply owned manufacturing, custom fitting, Supima quality, B Corp status, or guarantees TeeBravo does not actually provide.

### Printerval: long-tail discovery and content engine

What works:

- Search is prominent and taxonomy covers recipient, occasion, interest, product type, and season.
- Gift-finder paths translate vague intent into browseable collections.
- Seasonal landing pages, blog articles, social proof, payment marks, support routes, and Pinterest presence form a wide acquisition surface.
- The same asset system is repurposed across product modules, seasonal collections, social content, and editorial content.

Apply selectively:

- Build indexed, curated collection pages at the intersection of **audience/interest × garment × occasion**, but only where enough original products and useful copy exist.
- Add a lightweight “Find your graphic” discovery module after the catalog is broad enough.
- Use seasonal editorial calendars and Pinterest boards to distribute those collections.

Reject:

- Dense carousels, competing banners, app promotions, countdowns, and excessive discounts dilute premium perception.
- The observed marketplace includes obvious third-party IP and celebrity references. This is a severe model risk for TeeBravo and conflicts with Google/Pinterest merchant safety.

## TeeBravo current-state audit

### Anti-pattern verdict

**Pass with reservations.** The desktop visual direction does not look like generic gradient/card-based AI output. Its monochrome editorial grid is distinctive and consistent. The risk is that the brutalist all-caps treatment has become too uniform: small uppercase labels, hard borders, and similar visual weight make product facts harder to scan. The design feels art-directed, but not yet fully commerce-resolved.

### Severity summary

| Severity | Count | Meaning |
|---|---:|---|
| Critical | 4 | Blocks a trustworthy purchase path or merchant review |
| High | 7 | Likely damages conversion, accessibility, or organic acquisition |
| Medium | 7 | Weakens premium perception, findability, or maintainability |
| Low | 3 | Useful refinement after launch readiness |

### Critical findings

#### C1. Primary PDP media failed to render in the observed purchase view

- **Observed:** the large left media region was blank on `/product/pug-pug-anatomy-pug/authentic-short-5250?Color=White`.
- **Impact:** shoppers cannot validate artwork, garment, color, or print placement; Google and Pinterest product imagery may also fail or mismatch.
- **Recommendation:** add an automated rendered-image health check for every active variant; never activate a product without a valid, crawlable primary image; render a visible fallback only as an operational warning, not a generic placeholder sold to customers.
- **Acceptance:** every active feed item returns a 200 image of at least 500×500, visually matches selected color/catalog/print area, and displays in desktop/mobile PDP before CTA interaction.

#### C2. Price integrity is implausible and ambiguous

- **Observed:** an Authentic Short Sleeve T-Shirt displayed `$2.52–$18.00`; related products repeated the same range.
- **Impact:** signals a data/import bug or mixed variant family; erodes trust and can create landing-page/feed/checkout price mismatches.
- **Recommendation:** audit catalog costs, retail price rules, variant grouping, and decimal/minor-unit conversion. Default to a specific purchasable variant price, or label honestly as “From $X” only when the minimum variant is a valid selection of that same product.
- **Acceptance:** selected variant price, PDP, JSON-LD Offer, Google feed, cart, and Stripe line item match exactly for a matrix of products/variants.

#### C3. Returns/refunds information is publicly missing

- **Observed:** PDP states “Return information is not available yet”; footer showed no policy links.
- **Impact:** purchase anxiety and direct Merchant Center/Pinterest merchant risk. Google requires clear, conspicuous, consistent information that also addresses non-defective returns such as buyer's remorse.^1
- **Recommendation:** owner must provide the real policy; publish it globally; summarize it on PDP/cart and mirror it in Merchant Center. Do not invent a customer-friendly policy that operations cannot fulfill.
- **Acceptance:** policy states eligibility, window, method, return address/process, fees, defective/remake handling, buyer's-remorse handling, and refund timing; accessible without login from footer and PDP.

#### C4. Merchant submission cannot proceed while public business/purchase facts are incomplete

- **Observed:** architecture supports policies and Stripe, but live content remains draft/config-dependent; checkout production readiness depends on live keys, verified webhook, wallet/domain setup, and a completed test purchase.
- **Impact:** Google flags missing contact data, incomplete policies, broken links, placeholder content, and nonfunctional checkout.^2
- **Recommendation:** introduce a release gate that prevents Merchant/Pinterest catalog submission until all critical acceptance tests pass.
- **Acceptance:** successful US test order from PDP through signed Stripe webhook; contact identity and all policy pages public; no placeholders; shipping/tax/full costs visible before payment.

### High-severity findings

#### H1. Product imagery lacks the confidence set expected for apparel

The code supports multiple views and mobile swipe, but current catalog media appears dominated by isolated mockups. Baymard's apparel testing finds that cut-out images alone are insufficient; model imagery and fit context are important.^3 Require at minimum: clean front, clean back where relevant, on-body scale, print close-up, and one lifestyle/context image.

#### H2. Sizing exists but remains too thin for confidence

The size-guide trigger is correctly placed beside size selection. Preserve that. Expand the content to product-specific garment measurements, how to measure, fit label (slim/regular/relaxed/oversized), unit toggle, and model size/measurements. Baymard reports insufficient sizing on most apparel sites and observed uncertainty causing abandonment.^4

#### H3. The PDP hierarchy undersells product value

The H1 is only `text-sm`, most labels are uppercase, and price/product facts have similar visual weight. Increase title/price readability; show a short product-specific value statement above variants; group garment facts near the buy decision. Use sentence case for explanatory content and reserve uppercase for compact labels.

#### H4. The CTA is state-correct but not maximally clear

“SELECT OPTIONS” accurately prevents invalid add-to-cart, but gives weak guidance. Use state-specific copy: “Choose a size”, “Unavailable in this combination”, and “Add to bag — $XX.XX”. On mobile, add a sticky purchase bar only after the main CTA scrolls out of view; it must retain selected state and never obscure policy/content controls.

#### H5. Public trust navigation is incomplete while policies are drafts

The footer code correctly renders only published legal pages. Operationally, that produces an empty Store Information column. Publish real Shipping, Returns & Refunds, Privacy, Terms, Contact, FAQ, and About content before acquisition. Add order tracking only when it works.

#### H6. Homepage catalog presentation exposes internal assortment mechanics

“Catalog” plus counts and a long list of garment bodies reads like a supplier catalog. It competes with the premium editorial promise. Use customer language in primary browsing: Graphic Tees, Hoodies & Sweatshirts, Women, Men, Kids, Gifts; expose exact blank/catalog details on PDP, not homepage.

#### H7. Product names and collection copy need editorial QA

Examples such as “Pug Pug Anatomy Pug” repeat tokens and accessible product-card descriptions repeat titles. Add ingestion normalization and human merchandising review. Product title should follow: `Design name — Garment type`, with the exact same customer-facing form across H1, feed, JSON-LD, cart, and checkout.

### Medium-severity findings

#### M1. Typography is distinctive but not premium enough

The code uses Inter for display and Space Grotesk for body, effectively reversing the more natural roles and relying on a heavily overused display face. Recommended direction: a refined editorial grotesk display plus a highly readable humanist sans body. Candidate open-source pairing: **Archivo/Archivo Narrow** for display and **Source Sans 3** for body; alternative: **DM Sans** body with **Barlow Condensed** used sparingly for campaign labels. Validate licensing, Vietnamese is irrelevant to the US storefront, and cap font payload to essential weights.

#### M2. Dark-mode control is not a customer priority

Theme switching adds header competition without improving product evaluation. Choose one carefully tuned light retail theme for launch; retain dark mode only if every product image, token, and contrast state is verified.

#### M3. Search is present but needs demand-aware behavior

Add spelling tolerance, synonym mapping (`tee/t-shirt`, `sweatshirt/crewneck`), no-result recovery, recent/trending suggestions, and collection/content results. Do not index internal search-result pages unless deliberately curated.

#### M4. Collection pages need editorial substance and crawl discipline

Each indexable collection needs a unique H1, short decision-oriented intro, product count, useful filters, stable canonical, internal links, and 150–300 words of genuinely useful supporting copy below the grid where warranted. Avoid mass-generating thin combinations.

#### M5. Organization structured data is incomplete

Current Organization/Store JSON-LD covers name, URL, logo/image, but can be extended after facts are published with durable contact data and `hasMerchantReturnPolicy`/shipping details supported by Google. Never mark up drafts.

#### M6. ProductGroup implementation needs validation against Google's variant rules

The code emits ProductGroup/hasVariant and variant-specific URLs, which is a strong foundation. Validate output in Rich Results Test and Merchant listings reports. Ensure default/canonical strategy does not collapse distinct selected variants in a way that contradicts feed landing URLs.

#### M7. Accessibility requires a focused pass

Observed media controls appeared as unlabeled buttons in the accessibility tree, and tiny product-card text/controls may create target and contrast issues. Audit keyboard order, image-control names, visible focus, 44×44 touch targets, zoom/reflow at 200%, form errors, carousel announcements, and WCAG 2.2 AA contrast.

### Low-severity findings

- Replace generic icon-led assurance statements with fewer, more specific text links.
- Add a restrained newsletter block in the footer after email consent, privacy, and lifecycle flow are ready; avoid an interruptive entry popup for first-time organic visitors.
- Add wishlist/back-in-stock only after sufficient return traffic justifies account/state complexity.

### Positive findings to preserve

- The editorial black/white system is recognizable and avoids generic gradient/glass/card tropes.
- Department navigation is shallow and understandable.
- PDP routes encode catalog and selected variants in URLs.
- Product data, feed mapping, cart, checkout, and JSON-LD share much of the same commerce source.
- Mobile gallery uses native swipe behavior and gives the first image priority.
- Delivery estimates and exact quantity-based US shipping are visible on PDP.
- Size guide is adjacent to size selection.
- Reviews are rendered only when real review data exists; continue avoiding fabricated reviews.
- Stripe-hosted checkout and signed-webhook order creation are a sound trust/security base.

## Target information architecture

### Header

1. New
2. Graphic Tees
3. Hoodies & Sweatshirts
4. Women
5. Men
6. Kids (only if assortment is meaningful)
7. Gifts (after at least 3 useful gift collections)
8. Search icon/field
9. Bag

Remove the theme switch from the primary retail header. Keep the mobile menu task-oriented and show search at the top.

### Collection system

Use three controlled layers:

- **Departments:** Women, Men, Kids.
- **Garments:** Graphic Tees, Hoodies, Sweatshirts, Long Sleeves, Tanks.
- **Editorial intent:** Dog Lovers, Minimal Line Art, Funny Graphics, Gifts for Dog Moms, Halloween, Christmas.

An indexable page must have a real assortment, unique intent, unique copy, and at least one inbound link. Filter combinations remain non-indexable by default. Start narrow: 8–12 strong collections outperform hundreds of thin pages.

### Footer

| Shop | Help | About | Legal |
|---|---|---|---|
| New arrivals | Contact | Our story | Privacy |
| Graphic tees | FAQ | How products are made | Terms |
| Hoodies | Shipping | Design/licensing standard | Accessibility statement |
| Gifts | Returns & refunds | Journal | Cookie choices |
| Size guide | Order support | Pinterest / Instagram | Do not sell/share (if legally applicable) |

Add legal links only with finalized content; do not present empty categories.

## Target PDP specification

### Above the fold

**Media column**

- First image: accurate clean product shot for the selected variant.
- Second: on-body front view.
- Third: back/alternate print-area view.
- Fourth: print/detail close-up.
- Fifth: lifestyle scene.
- Swipe, keyboard arrows, visible current position, zoom/pinch, and meaningful alt text.

**Purchase column**

1. Breadcrumb.
2. `Design name — Garment type` H1.
3. Real rating/review count only when eligible.
4. Exact selected price; range only before a materially price-changing option is selected.
5. One-sentence design/garment proposition.
6. Color label and named swatches with unavailable combinations disabled.
7. Size buttons or accessible select, with “Size & fit guide” adjacent.
8. Print area only where genuinely offered; explain front/chest/back visually.
9. CTA: “Add to bag — $XX.XX”.
10. Delivery range, shipping-cost link/summary, and return/remake summary.

### Below the fold

- Artwork story and rights/artist attribution where appropriate.
- Garment: brand/model, material, weight, fit, construction, origin if known.
- Print: method, placement, expected texture/variation, care.
- Size chart and measuring guide.
- Shipping and returns summary linked to full policies.
- Verified customer reviews, including fit signals when enough data exists.
- Related designs first; related garment bodies second.

### Mobile behavior

- Media occupies the first viewport but leaves enough title/price cue to signal commerce.
- No horizontal overflow; no tiny dot-only control as the only carousel indicator.
- Purchase options are full width and touch targets are at least 44px.
- Sticky CTA appears only after selection context is understood and does not cover content.
- Size guide is a bottom sheet or route with a clear close action and correct Back behavior.
- Filters use an accessible drawer with applied-filter count and a persistent results count.

## Policy and trust content checklist

Policy content is operational data, not marketing filler. The owner must approve all promises.

### Shipping

- US-only scope and excluded destinations/territories.
- Processing time versus carrier transit time.
- Standard and Express methods and the exact quantity-based cost formula.
- Business-day definition and cutoff behavior.
- Tracking, address changes, lost/damaged packages, split shipments, delays, duties (if irrelevant, say so).

### Returns, refunds, remakes, cancellations

- Defective/misprinted/damaged item process and photo evidence.
- Wrong item/size sent.
- Buyer remorse and customer-selected wrong size—even if not accepted.
- Window measured from delivery/order date.
- Return authorization and address.
- Who pays return shipping; restocking fee if any.
- Refund method and processing timing.
- Cancellation/change window for made-to-order production.

### Privacy and cookies

- Contact, order, address, device, analytics, cookies, newsletter, and support data.
- Stripe payment handoff and service providers.
- Retention, access/deletion/contact process, and state privacy rights applicable to the business.
- Sale/share and targeted-advertising disclosures must match actual pixels/tools.

### Terms, contact, and identity

- Legal business name, operating/contact address as appropriate, durable support email, response expectations.
- Pricing/currency, order acceptance, fulfillment, IP, prohibited use, disputes, and limitation language reviewed for the actual entity/jurisdiction.
- Do not publish a guessed legal template; obtain qualified US legal review as the business scales.

## Organic acquisition plan

### Channel priority

| Priority | Channel | Role | Start condition |
|---:|---|---|---|
| 1 | Google Search + Images | Durable intent capture | Crawlable PDPs, image health, schema, sitemap |
| 1 | Pinterest organic | Visual discovery and collection traffic | Claimed domain, 20+ strong creatives, complete policies |
| 2 | Google Merchant Center free listings | Free product distribution and data QA | All critical merchant gates passed |
| 2 | Instagram | Brand proof and reusable short-form assets | Repeatable photo/video cadence |
| 3 | TikTok | Creative discovery/testing | Capacity for authentic creator-style video |
| 4 | Email | Retention, launches, cart recovery | Consent, privacy, deliverability, useful cadence |
| 4 | Reddit/community | Listening and selective participation | Authentic expertise; never link-spam |

Google free listings can surface products across Search, Shopping, Images, Lens, YouTube, Maps, and Gemini at no media cost.^5 This should begin before paid Shopping, but only after the same merchant-readiness gate.

### Pinterest setup sequence

1. Create a US-facing Pinterest Business account with exact TeeBravo branding, logo, About copy, and public contact.
2. Claim `teebravo.com` using an HTML tag or DNS method.
3. Install Pinterest Tag with consent-aware PageVisit, ViewCategory, PageVisit/PDP, AddToCart, Checkout, and Purchase events; pass currency and stable `product_id` values matching the future catalog.
4. Ensure Product rich Pin inputs are present. Pinterest accepts Open Graph or Schema.org product markup; TeeBravo's product JSON-LD is a base, but validate actual rendered pages.^6
5. Publish 6–10 boards based on customer intent, not internal taxonomy: Graphic Tees for Dog Lovers, Pug Gifts, Funny Dog Shirts, Minimal Dog Art, Gifts for Dog Moms, Halloween Dog Shirts, Christmas Dog Gifts, New TeeBravo Designs.
6. Create 3–5 pin assets per priority design/collection: isolated product, on-body, lifestyle, detail, and simple editorial collage.
7. Use 2:3 vertical creative as the default production format; keep branding legible and avoid cramming promotional text into the product itself.
8. Link every Pin to the closest matching canonical collection/PDP and add UTM parameters.
9. Publish consistently and seasonally; refresh creative, not duplicate URLs/copy endlessly.
10. Add the catalog only after site eligibility passes. Pinterest requires a business account, claimed site, tag, and easy-to-find contact, shipping, and refund policies.^7

Pinterest's Verified Merchant Program should be treated as a later milestone, not launch scope. Current requirements include an account at least three months old, a website at least nine months old, 75% successful catalog ingestion, and recurring PageVisit/AddToCart/Checkout event signals.^8

### Content operating system

One monthly collection theme should produce:

- 1 indexable editorial collection page.
- 4–8 finished products.
- 12–20 Pinterest Pins across 4 creative templates.
- 3 Instagram posts/reels.
- 1 short journal story or gift guide.
- 1 email only when there is a genuine audience and consent.

Example: **Pug Anatomy Drop** → collection landing page → design story → clean PDP assets → “Pug gifts for vet students” and “funny anatomy shirts” Pins → short print-detail reel → internal links from relevant gift guide.

### Measurement

Define a single analytics event dictionary:

| Funnel step | Event | Required fields |
|---|---|---|
| Collection impression | `view_item_list` | collection ID/name, item IDs |
| Product view | `view_item` | stable product/variant ID, price, currency |
| Variant selected | custom | color, size, print area, availability |
| Add to bag | `add_to_cart` | exact variant, quantity, value |
| Checkout start | `begin_checkout` | cart value, shipping choice |
| Purchase | `purchase` | order ID, value, tax, shipping, currency, items |

Add consent mode/pixel governance before advertising pixels. Reconcile analytics purchases with paid orders; do not treat client-side success-page events as authoritative.

## Google Merchant Center readiness plan

### Register earlier than paid ads—but not before the store is credible

Do not wait for many paid orders to create Merchant Center. Once the critical gates pass, create/claim the account and use free listings as an organic channel and data-quality test. Paid Shopping can follow after real orders prove pricing, fulfillment, support, refund handling, and contribution margin.

### Submission gate

- Claimed HTTPS `teebravo.com`; no checkout redirect away from the domain except the legitimate secure payment step.
- Conventional card payment works for an individual consumer.^9
- Product, price, USD, stock, image, selected variant, and condition match feed/PDP/schema/cart/checkout.
- Stable `id` and `item_group_id`; size, color, age group, gender, material, pattern/product type included when applicable.
- Valid GTIN only when truly assigned; otherwise brand + honest MPN/SKU and correct identifier handling.
- Main images are accurate, unobstructed, non-watermarked, and at least 500×500 to future-proof Google's announced minimum.
- Contact and complete policy pages are public and consistent with Merchant Center settings.
- Shipping configuration reflects the actual quantity formula; never describe it as a flat order rate.
- Test purchase, cancel, expired checkout, refund/remake, and webhook idempotency verified.
- Search Console merchant-listing report and Rich Results Test show no blocking errors.

Google recommends putting Product structured data in the initial HTML and focusing merchant markup on specific purchasable product pages.^10 TeeBravo's server-rendered JSON-LD direction is correct; the next task is validation and data consistency rather than adding more schema types indiscriminately.

### Paid ads trigger

Start paid Shopping only when all are true:

- 20–50 active, rights-cleared products with reliable images and complete attributes.
- At least 10–20 fulfilled real orders or an equivalent controlled beta demonstrating actual delivery performance.
- Known gross margin after blank, print, shipping subsidy, Stripe, refunds/remakes, and support.
- Purchase conversion tracking reconciles to paid orders.
- No unresolved feed price/image/availability warnings on priority SKUs.
- Customer support and refund/remake SLAs are staffed.

Start with a small controlled product set, not the whole catalog. Exclude unproven low-margin bodies and designs with legal ambiguity.

## 12-week implementation roadmap

### Phase 0 — Freeze acquisition and establish truth (Days 1–3)

| Task | Owner | Effort | Exit criterion |
|---|---|---:|---|
| Audit `$2.52` source across DB/import/API/UI/feed/Stripe | Engineering + merchandising | M | No implausible active price; matrix test passes |
| Audit active image URLs and renderer health | Engineering | M | 100% active primary images return valid 200 image |
| Collect real business/policy inputs | Owner + legal/ops | M | Approved policy fact sheet, no guessed promises |
| Define active-product quality gate | Engineering + merchandising | S | Invalid product cannot publish/export |

### Phase 1 — Merchant-safe foundation (Week 1–2)

- Publish Shipping, Returns & Refunds, Privacy, Terms, Contact, FAQ, About.
- Add policy summaries to PDP/cart and make footer links explicit.
- Complete end-to-end Stripe live-mode test in a controlled environment.
- Build consistency tests: API → PDP → JSON-LD → Google feed → cart → checkout snapshot.
- Add image dimension/content-type/availability validation.
- Validate canonical, robots, sitemap, 404s, ProductGroup markup, and variant URLs.
- Remove or noindex thin/broken/placeholder pages and inactive products.

### Phase 2 — PDP conversion and premium proof (Week 3–4)

- Repair gallery and define the five-image apparel standard.
- Redesign hierarchy of H1, price, short proposition, variants, and CTA.
- Add fit profile, garment measurements, measuring guide, model measurements.
- Add specific blank/material/weight/print/care details.
- Implement mobile sticky CTA and accessibility fixes.
- Replace generic claims with product-specific evidence.

### Phase 3 — Merchandising and collection architecture (Week 5–6)

- Normalize titles and remove repeated/spammy token patterns.
- Select 20–50 launch products; archive weak or risky items.
- Create 8–12 curated collections around genuine demand.
- Simplify homepage catalog block and feature 2–3 editorial collections.
- Add collection intros, filters, internal links, and supporting editorial copy.
- Produce one coherent hero/drop asset system.

### Phase 4 — Organic infrastructure (Week 7–8)

- Configure analytics, consent, Search Console, Bing Webmaster Tools.
- Create Pinterest Business account; claim domain and install tag.
- Validate Rich Pins, Open Graph images, and UTM conventions.
- Create board taxonomy and four reusable Pin templates.
- Launch journal/gift-guide content only for supported search intent.
- Add reporting for impressions → PDP sessions → add-to-cart → checkout → paid order.

### Phase 5 — Free distribution (Week 9–10)

- Create Merchant Center; verify/claim domain.
- Configure shipping and returns identically to public policies.
- Submit a controlled product subset to free listings.
- Add Pinterest catalog after merchant checks pass.
- Resolve all disapprovals at source; do not patch feed facts independently from storefront data.

### Phase 6 — Learn and prepare paid acquisition (Week 11–12)

- Review search queries, Pinterest saves/outbound clicks, product-view-to-cart rate, checkout completion, refunds/remakes.
- Improve low-performing PDP assets and fit information.
- Gather verified post-purchase reviews without incentives conditioned on positivity; FTC guidance requires reviews and endorsements to reflect honest experiences.^11
- Calculate contribution margin and target CAC by garment.
- Define a small Shopping test set, but launch only when the paid trigger is satisfied.

## Prioritized engineering backlog

| ID | Priority | Deliverable | Dependencies | Verification |
|---|---|---|---|---|
| TB-01 | P0 | Price-source and variant-group integrity repair | Catalog data | API/UI/feed/checkout snapshot test |
| TB-02 | P0 | Active image health/publish gate | Renderer/storage | 100% active SKU audit |
| TB-03 | P0 | Policy publication and footer/PDP exposure | Owner-approved facts | Anonymous desktop/mobile checks |
| TB-04 | P0 | Live checkout readiness runbook execution | Stripe/domain/policies | Paid test + webhook/order reconciliation |
| TB-05 | P1 | Product data contract test suite | TB-01/02 | CI equality assertions |
| TB-06 | P1 | PDP hierarchy/CTA/mobile sticky behavior | Stable variant state | Device + keyboard smoke tests |
| TB-07 | P1 | Product-specific size/fit system | Catalog measurements | Apparel PDP matrix |
| TB-08 | P1 | Five-image media schema and QA workflow | Asset production | Per-product publish completeness |
| TB-09 | P1 | Accessibility/WCAG 2.2 AA remediation | Stable UI | axe + keyboard + zoom/reflow |
| TB-10 | P1 | Merchant schema/feed validation | TB-05 | Rich Results + feed test |
| TB-11 | P2 | Collection editorial fields and index rules | Merchandising model | Canonical/index/internal-link audit |
| TB-12 | P2 | Title normalization and review queue | Import pipeline | Duplicate/token-quality tests |
| TB-13 | P2 | Analytics event dictionary and server reconciliation | Checkout stable | Event QA vs paid orders |
| TB-14 | P2 | Pinterest tag, domain claim, Rich Pins | Policies + consent | Pinterest diagnostics |
| TB-15 | P2 | Creative templates and board/UTM taxonomy | Brand asset system | 20-Pin pilot |
| TB-16 | P3 | Search synonym/no-result improvements | Search analytics | Task-based usability test |
| TB-17 | P3 | Verified reviews and fit feedback | Fulfilled orders | Moderation + FTC compliance |

## Launch scorecard

Do not open a new acquisition channel until its gate is green.

| Area | Green threshold |
|---|---|
| Product truth | 100% sampled agreement among PDP/feed/schema/cart/checkout |
| Images | 100% active primary images healthy and accurate; priority products have 5-view set |
| Policies | All seven trust routes public, complete, consistent, and owner-approved |
| Checkout | Three successful US test paths; webhook idempotency; cancellation/expiry tested |
| Accessibility | No critical/serious axe issues on home, collection, PDP, cart, checkout entry |
| Performance | Field target: LCP ≤2.5s, INP <200ms, CLS <0.1 at 75th percentile^12 |
| Organic | Search Console verified; sitemap accepted; no accidental indexing blockers |
| Pinterest | Domain claimed; tag events valid; 20 quality Pins; policy gate green |
| Merchant Center | Controlled feed approved; shipping/returns match; no P0 warnings |
| Paid ads | Fulfillment/margin/conversion data meets paid trigger |

## Decision principles

1. **Truth before persuasion.** Accurate price, image, delivery, and returns beat a prettier CTA.
2. **Proof before adjectives.** Say “6.1 oz 100% cotton” when true, not “premium quality.”
3. **Curation before scale.** Publish fewer complete products and collections.
4. **One source of commerce truth.** Never fix feed data separately from PDP/cart/checkout.
5. **Mobile is the primary purchase context.** Desktop art direction cannot compensate for mobile friction.
6. **Organic content must map to purchase intent.** Every board/article/collection has a defined query and next step.
7. **Paid traffic amplifies the store you already have.** It does not repair product trust, operations, or margin.

## Sources

1. Google Merchant Center Help, “[Set up your return policies for Shopping ads and free listings](https://support.google.com/merchants/answer/14011730?hl=en),” accessed 12 September 2026.
2. Google Merchant Center Help, “[Editorial and professional requirements](https://support.google.com/merchants/answer/6150244?hl=en),” accessed 12 September 2026.
3. Baymard Institute, “[5 Apparel UX Best Practices](https://baymard.com/blog/apparel-5-best-practices),” accessed 12 September 2026.
4. Baymard Institute, “[83% of Apparel Sites Don’t Provide Sufficient Sizing Information](https://baymard.com/blog/apparel-size-information),” 6 July 2022.
5. Google Merchant Center Help, “[Free listings for products](https://support.google.com/merchants/answer/13889434?hl=en),” accessed 12 September 2026.
6. Pinterest Business Help, “[Create rich Pins](https://help.pinterest.com/en/business/article/rich-pins),” accessed 12 September 2026.
7. Pinterest Business Help, “[Get started with retail catalogs](https://help.pinterest.com/en/business/article/before-you-get-started-with-catalogs),” accessed 12 September 2026.
8. Pinterest Business Help, “[The Verified Merchant Program](https://help.pinterest.com/en/business/article/verified-merchant-program),” accessed 12 September 2026.
9. Google Merchant Center Help, “[Online store URL domain requirements](https://support.google.com/merchants/answer/12160471?hl=en)” and “[Checkout requirements and best practices](https://support.google.com/merchants/answer/9158778?hl=en),” accessed 12 September 2026.
10. Google Search Central, “[Merchant listing structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)” and “[Structured data for ecommerce](https://developers.google.com/search/docs/specialty/ecommerce/include-structured-data-relevant-to-ecommerce),” accessed 12 September 2026.
11. US Federal Trade Commission, “[Endorsements, Influencers, and Reviews](https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews),” accessed 12 September 2026.
12. Google Search Central, “[Understanding Core Web Vitals and Google search results](https://developers.google.com/search/docs/appearance/core-web-vitals),” accessed 12 September 2026.
13. Google Search Central, “[SEO best practices for ecommerce sites](https://developers.google.com/search/docs/specialty/ecommerce),” accessed 12 September 2026.
14. Pinterest Business Help, “[Shopping on Pinterest](https://help.pinterest.com/en/business/guide/shopping-on-pinterest)” and “[Claim your website](https://help.pinterest.com/en/business/article/claim-your-website),” accessed 12 September 2026.
15. Direct benchmark pages: [GitHub Shop](https://thegithubshop.com/), [Son of a Tailor Cotton T-Shirt](https://www.sonofatailor.com/product/cotton-t-shirt/1-1-3-9-12), and [Printerval](https://printerval.com/), inspected 12 September 2026.
