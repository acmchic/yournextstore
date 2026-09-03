# Google Merchant Center + Google Ads Compliance Checklist

Use this checklist before changing product data, product pages, cart, checkout,
legal/trust pages, structured data, product feeds, image generation, or ad copy.
The goal is to keep the store ready for Google Merchant Center approval and
avoid product/account disapprovals at go-live.

Last policy review: 2026-07-07.

Official references:

- Google Merchant Center product data specification:
  https://support.google.com/merchants/answer/7052112
- Google Merchant Center landing page requirements:
  https://support.google.com/merchants/answer/4752265
- Google Merchant Center approval guidelines:
  https://support.google.com/merchants/answer/12756116
- Google Merchant Center misrepresentation policy:
  https://support.google.com/merchants/answer/6150127
- Google Shopping ads policies:
  https://support.google.com/merchants/answer/6149970
- Google Ads editorial policy:
  https://support.google.com/adspolicy/answer/6021546

## Non-negotiable Build Rules

- Product feed, product page, cart, checkout, and JSON-LD must use the same
  source of truth for title, description, image, price, currency, availability,
  condition, brand, SKU/MPN/GTIN status, and variant attributes.
- Never show a price, currency, stock state, delivery promise, return promise,
  discount, or product claim in UI that cannot be emitted identically in the
  Merchant Center feed and structured data.
- Product pages must be crawlable, live, mobile-friendly, and must not require
  login, popups, geolocation, cookies, or client-only rendering to reveal the
  product title, image, price, currency, availability, variant, and buy button.
- Product URLs must be on the claimed Merchant Center domain once the domain is
  chosen. Do not hardcode a temporary domain into product data, metadata,
  JSON-LD, sitemap, canonical URLs, or feeds.
- Checkout must let users add a product to cart and complete purchase with at
  least one conventional payment method before Merchant Center submission.
- Every product, claim, image, and design must be own-brand, licensed, or
  otherwise legally usable. No counterfeit, fake affiliation, misleading brand
  references, celebrity/IP bait, or copied artwork.

## Store Trust Requirements

- Header/footer must expose clear routes for contact, shipping, returns/refunds,
  privacy policy, terms, FAQ, and about/business identity.
- Contact page must include at least one durable contact method: email, contact
  form, phone, business address, or official social profile.
- Return/refund policy must be explicit even if the policy is "no returns" or
  "made to order". It must state user steps, eligibility, time window, and refund
  timing.
- Shipping policy must state processing time, shipping methods, cost logic,
  target countries, delivery estimates, and restrictions.
- Privacy policy must match actual collection of name, email, address, phone,
  payment handoff, analytics, cookies, newsletter, and support data.
- Checkout and any page collecting personal/payment data must use HTTPS in
  production and must not sell user contact information.
- All purchase conditions must be visible before payment: item price, currency,
  shipping, taxes, optional fees, recurring/subscription terms if any, return
  limits, and delivery restrictions.

## Product Data Checklist

- Required feed fields for each item: `id`, `title`, `description`, `link`,
  `image_link`, `availability`, `price`, `condition`, and brand/identifier data
  where applicable.
- Use stable IDs. Keep the same product/variant ID across updates, countries,
  and languages whenever it is the same item.
- Titles must accurately name the product and match the landing page. Do not add
  promotional text like "free shipping", gimmicky symbols, or unnecessary all
  caps.
- Descriptions must describe only the product. Do not include store links,
  competitor mentions, checkout promises, unrelated accessories, or exaggerated
  claims.
- Prices must include ISO 4217 currency, use a period as decimal separator in
  feed values, and match landing page, structured data, cart, and checkout.
- Availability values must be one of `in_stock`, `out_of_stock`, `preorder`, or
  `backorder`. Preorder/backorder must include `availability_date` and show the
  same expected date on the product page.
- If an item is out of stock, keep the price visible and clearly disable or label
  the buy action.
- Apparel variants must include stable variant grouping: same `item_group_id`
  and parent title for variants, with different `size`, `color`, `gender`,
  `age_group`, `material`, `pattern`, or other variant-identifying attributes as
  relevant.
- For POD apparel, do not create one vague product that secretly changes into
  many items. Each submitted item must resolve to a specific purchasable variant
  or a URL that preselects the correct variant.
- Use `google_product_category` or product type taxonomy consistently for
  apparel and accessories. Keep category choices conservative and specific.
- Use GTIN only when valid and assigned to that exact product. If no GTIN exists,
  provide brand plus MPN/SKU where applicable and do not invent identifiers.

## Landing Page Checklist

- Product link must land on a product detail page, not homepage, collection,
  search, cart, PDF, image file, or generic page.
- Product page must show title, product image, description, price, currency,
  availability, selected variant, and buy/add-to-cart action above or near the
  main purchase area.
- The default selected variant must match the submitted feed item. If feed items
  are variant-specific, URLs should preselect the exact color/size/design.
- The same product, language, price, currency, and availability must show for
  normal users and crawlers, across device, user agent, location, cookies, and
  browser differences.
- Do not change key product information after initial load in a way that causes
  crawlers to see a different price, stock, variant, or currency.
- Include Product/Offer JSON-LD in initial HTML for product pages, especially
  price, currency, availability, condition, brand, SKU/MPN/GTIN, and image.
- Avoid blocking product details with newsletter popups, consent banners, app
  download banners, modals, or overlays. If legally required, they must be
  closable and must not hide the purchase facts.
- Browser back button must work after clicking from Google.
- Use as few redirects as possible; never redirect product links off the claimed
  Merchant Center domain.

## Image + Media Checklist

- Main product image must show the actual product being sold, not a placeholder,
  generic lifestyle scene, low-res thumbnail, or unrelated mockup.
- Future-proof all main product images at 500 x 500 px or larger; Google has
  announced enforcement of this minimum for all product images from 2027-01-31.
- Do not upscale tiny assets. Do not use blurry, sideways, cropped-beyond-use,
  watermarked, bordered, or text-heavy main images.
- Do not put promotional text, discount badges, "free shipping", logos you do
  not own, or watermark overlays in Merchant Center main images.
- Additional images can show context, staging, graphics, or product-in-use shots,
  but still must match the product and be crawlable.
- If generative AI is used for product images, preserve required AI metadata and
  keep an internal record of source/licensing. Do not remove IPTC digital source
  metadata.
- For POD, generated apparel mockups must accurately represent print placement,
  garment type, garment color, and design scale.

## Ads + Copy Checklist

- Business name in ads must be the real brand/domain/app name, not a promo line.
- Avoid gimmicky capitalization, punctuation, repetition, unsupported characters,
  broken spacing, and incomprehensible copy.
- Do not write claims that imply official affiliation, certification, reseller
  status, guarantees, medical/health outcomes, political claims, or unrealistic
  results unless legally documented and allowed by policy.
- Do not promote prohibited or restricted Shopping content unless the target
  country, product type, and Google requirements have been explicitly reviewed.
- For POD apparel, reject designs/copy involving counterfeit goods, hate,
  harassment, graphic violence, adult content aimed at minors, copyrighted
  characters, trademark confusion, or impersonation.

## Code Review Gate

Before merging changes touching commerce surfaces, confirm:

- Product UI, JSON-LD, sitemap/canonicals, and feed/export code share the same
  product/variant source.
- A smoke path works: product listing -> product detail -> variant selection ->
  add to cart -> cart -> checkout.
- Product page HTML contains crawlable title, price, currency, availability, and
  JSON-LD without waiting for user interaction.
- Legal/trust links are visible from header or footer on desktop and mobile.
- No `/checkout` link uses Next `<Link>` or `YnsLink`; this repo requires plain
  `<a>` tags for checkout.
- No hardcoded go-live domain has been added before the real domain is chosen.
- `tsgo --noEmit` and `bun run lint` pass for code changes.

