# TeeBravo policy content draft

Prepared: 2026-09-21. Language: US English. Status: editorial draft, not published.

This document applies the installed Humanizer 3.0.0 skill to the store's existing policy framework. It uses plain, factual language and does not invent a founder story, manufacturing location, certifications, delivery guarantees, or return promises. Business facts still need to be completed before this becomes publishable policy copy. This is not a legal opinion or confirmation of platform approval.

## Notes for the owner

The source is `api/policies.json`, the policy token resolver, and the project documentation. These establish the local implementation, not the current production settings or actual fulfillment performance. The public website could not be inspected through the web research tool during this review.

The local JSON currently contains `support@teebravo.com`, processing of 1 to 3 business days, and Standard transit of 2 to 5 business days. Confirm that these are operational facts and that the inbox is monitored. Express transit is blank. The Shipping entry has `published: true`, although `docs/policy-deployment.md` says all pages start as drafts. Do not infer that Shipping is currently public or import this file expecting every page to remain a draft.

The documented shipping model is Standard $5 for the first item plus $3 per additional item, and Express $11 plus $4. The copy below preserves the existing CMS tokens so published prices come from the same settings as checkout. Confirm current database rates before publication.

`{{...}}` denotes an existing CMS token. `[OWNER INPUT: ...]` denotes an editorial placeholder that the CMS does not resolve. Complete every placeholder before copying a page into the CMS. The current editor stores plain text; use the section headings as plain text and do not paste Markdown formatting expecting it to render as HTML.

### Information to complete

| Topic | Information needed |
| --- | --- |
| Business identity | Legal operator name, relationship to TeeBravo, real business mailing address and country. Do not describe a US customer market as a US business location. |
| Support | Confirm the email works; provide any real additional contact method, support hours, time zone and response target if one is promised. |
| Shipping | Exact eligible regions, including Alaska, Hawaii, territories, PO boxes and military addresses; processing and transit ranges; business days, holidays, cutoff and time zone; tracking and split shipment procedures. |
| Returns | Defective/damaged/wrong item remedies; whether buyer's remorse and customer-selected size/color returns are accepted; exchanges; condition requirements; exclusions. |
| Return deadlines | Separate applicable deadlines, whether counted from delivery, and whether the deadline is for requesting or sending a return. |
| Return process and fees | Contact steps, evidence reasonably needed, return destination/authorization, labels, postage payer, restocking fees, original shipping and tax treatment. Distinguish seller fault from change of mind. |
| Refunds | Approval/inspection process, refund method, processing deadline and any separately stated bank posting estimate. |
| Order changes | Cancellation and address/size change cutoff, how customers request changes, unavailable items, and shipment delays. |
| Privacy | Actual hosting, fulfillment, payment and support providers; logs; cookies; analytics/ad pixels; marketing; retention; data locations; rights and opt-out handling where applicable. |
| Terms | Legal operator and jurisdiction; order acceptance; cancellation/refunds; any applicable limitations or dispute terms reviewed for that jurisdiction. |
| Platforms | Identify intended channels, such as Meta ads, Meta Shops, TikTok Shop, Pinterest or marketplaces. Their channel-specific rules need a separate check. |

Populate existing fields as follows: business identity in `business_name` and `business_address`; delivery exclusions in `restrictions`; return decisions in `returns_eligibility`, `returns_window`, `returns_method`, `returns_fees` and `refund_timing`; verified data practices in `privacy_details`; purchase terms in `terms_conditions`.

## 1. About TeeBravo

Destination: `/about`. CMS slug: `about`.

### Printed clothing and accessories

TeeBravo is an online store for printed clothing and accessories, serving customers in the United States. Browse a design, choose an available product, and select the options that suit you.

Before you order, check the details and size guide for the garment you choose. Fit and materials can vary between styles.

### Who operates TeeBravo

TeeBravo is operated by {{business_name}}.

Business address: {{business_address}}

Website: {{storefront_url}}

### Questions before or after ordering

Email {{support_email}} for help with products or an existing order. Include your order reference if you have one.

Our Shipping Policy explains delivery costs and estimated timing. Our Returns & Refunds policy explains which requests we accept and how to contact us.

## 2. Contact us

Destination: `/legal/contact`. CMS slug: `contact`.

Email {{support_email}} for product questions, order support, returns or privacy requests.

For an existing order, include your order reference and a short description of the issue. Do not send your full card number, security code or password.

[OWNER INPUT: Add confirmed support hours, time zone, response target and an additional working contact channel, if available.]

### Business information

Operator: {{business_name}}

Business address: {{business_address}}

Website: {{storefront_url}}

### Returning an item

Contact us before sending a return. Follow the instructions in our Returns & Refunds policy. Our business address is not automatically the address for returns.

## 3. Shipping policy

Destination: `/legal/shipping-policy`. CMS slug: `shipping-policy`.

### Where we ship

We ship to the United States.

{{restrictions}}

### Processing your order

Order processing takes {{processing_time}} before shipment. Shipping transit time starts after processing.

[OWNER INPUT: State when processing starts, the order cutoff and time zone, which days count as business days, and excluded holidays.]

### Shipping charges

All shipping charges are in US dollars and are calculated from the number of items in your order.

Standard shipping costs {{standard_first}} for the first item and {{standard_additional}} for each additional item in the same order.

Express shipping costs {{express_first}} for the first item and {{express_additional}} for each additional item in the same order.

### Estimated delivery

Standard transit takes {{standard_transit}} after processing. Express transit takes {{express_transit}} after processing.

Add processing time to transit time to estimate the total time until delivery. These are estimates, not guaranteed arrival dates.

[OWNER INPUT: Confirm whether Express changes processing time or only transit. Confirm availability and fill its transit range before advertising this method.]

### Costs at checkout

Your item total, selected shipping charge and applicable taxes are shown at checkout before payment.

### Tracking and delivery problems

[OWNER INPUT: Explain how and when tracking is provided, whether orders may arrive in separate packages, and whether this affects the customer's charge.]

If your order is delayed, missing or arrives damaged, email {{support_email}} with your order reference and a description of the problem.

[OWNER INPUT: State the actual process for shipment delays, lost packages, incorrect addresses and returned-to-sender packages. Include any applicable cancellation/refund options and disclosed reshipping costs.]

## 4. Returns & refunds

Destination: `/legal/return-policy`. CMS slug: `return-policy`.

### Items eligible for a return or replacement

{{returns_eligibility}}

### When to contact us

{{returns_window}}

### How to request help

Email {{support_email}} with your order reference and the reason for your request. For an item that arrived damaged, defective or different from what you ordered, describe the problem.

{{returns_method}}

Contact us before mailing an item and follow the return instructions we provide. Our business address is not automatically a return address.

### Return shipping and other charges

{{returns_fees}}

### Refunds

{{refund_timing}}

### Contact

{{business_name}}

{{business_address}}

{{support_email}}

Editorial completion note: the populated fields must explicitly cover both seller-fault issues and non-defective returns, including change of mind and customer-selected wrong sizes. State whether exchanges are accepted. Do not insert a 30-day window, free returns, automatic replacements or a blanket no-refund rule without a real business decision. Separate the refund amount, the merchant's processing time and the bank's posting time.

## 5. Privacy policy

Destination: `/legal/privacy-policy`. CMS slug: `privacy-policy`.

Effective date: [OWNER INPUT: Date this completed policy takes effect.]

### Who we are

{{business_name}} operates TeeBravo at {{storefront_url}}. This policy explains how we handle personal information when you shop with us or contact us.

### Order and support information

We collect the information needed to process your order, including your name, email address, delivery address and purchased items. We keep the delivery information associated with each order so that the order record reflects the details used for that purchase.

If you contact us, we use the information you send to respond to your request.

### Payments

Stripe collects payment information through its hosted checkout. We use payment status and transaction identifiers to reconcile your payment with your order. Do not email us your payment card details.

### Cookies and preferences

Our storefront uses a cart cookie to connect your browser to your shopping cart. It also stores your display preference when you choose a theme.

### Other data practices and your choices

{{privacy_details}}

### Contact

Send privacy questions or requests to {{support_email}}.

{{business_name}}

{{business_address}}

Editorial completion note: expand `privacy_details` into named sections covering actual data categories and purposes, recipients, retention, applicable privacy rights and request procedures. Check production hosting logs and integrations, not just storefront code. Identify analytics/ad cookies and required choices if used. Do not claim “we never share information,” “we collect no personal data,” or “we do not sell or share data” without checking the applicable meaning and actual practices. State transfer or children's-data practices only when verified and relevant. Link the current Stripe privacy notice after verification.

## 6. Terms of service

Destination: `/legal/terms-of-service`. CMS slug: `terms-of-service`.

Effective date: [OWNER INPUT: Date this completed policy takes effect.]

### Shopping with TeeBravo

{{business_name}} operates TeeBravo at {{storefront_url}}. These terms apply when you use our store or place an order.

Review the product, garment style, color, size and quantity before purchasing. Use the size guide for the garment you select.

### Prices and payment

Prices are in US dollars. Your item charges, shipping and applicable taxes are shown before payment. Payments are processed through Stripe's hosted checkout.

### Order acceptance, changes and cancellations

{{terms_conditions}}

### Shipping and returns

Our Shipping Policy explains delivery destinations, charges, processing time and transit estimates. Our Returns & Refunds policy explains eligibility, request deadlines, return procedures, fees and refund timing. Review both before placing an order.

### Questions about an order

Email {{support_email}} and include your order reference.

{{business_name}}

{{business_address}}

Editorial completion note: `terms_conditions` must address acceptance, stock/pricing errors, cancellations and refunds with actual procedures. If it includes other topics, give those topics their own headings in the CMS. Add intellectual-property, governing-law or dispute clauses only after verifying ownership, operator location and applicable law. Do not copy another business's arbitration, liability waiver, jurisdiction or subscription terms.

## 7. Frequently asked questions

Destination: `/legal/faq`. CMS slug: `faq`.

### Where do you ship?

We ship to the United States. {{restrictions}}

### How much is shipping?

Standard shipping is {{standard_first}} for the first item and {{standard_additional}} for each additional item. Express shipping is {{express_first}} for the first item and {{express_additional}} for each additional item. Charges are in US dollars.

### When will my order arrive?

Processing takes {{processing_time}}. After processing, estimated transit is {{standard_transit}} for Standard or {{express_transit}} for Express. Total delivery time includes both processing and transit.

### How do I choose a size?

Use the size guide for the garment you select. Check its measurements before ordering because fit can vary between styles.

### Can I return or exchange an item?

{{returns_eligibility}}

{{returns_window}}

Our Returns & Refunds policy explains the request process, fees and refund timing.

### Can I change or cancel an order?

[OWNER INPUT: Add a short answer that matches the finalized cancellation terms exactly.]

### How do I contact TeeBravo?

Email {{support_email}}. Include your order reference when asking about an existing order, and do not include payment card details.

## Publication checks and source notes

Review the final content against the actual operation before publishing. Policies must be easy to find and the return page must be readable without signing in. Describe non-defective returns explicitly, even if they are not accepted. Match the return window, method, charges and refund timing across the store and Merchant Center. Google's setup supports different acceptance choices; it does not impose a universal 30-day free-return promise. [Google return policy setup](https://support.google.com/merchants/answer/14011730).

Explain the business truthfully and disclose material purchase conditions. Do not invent addresses, endorsements or operating history to make an About page longer. [Google misrepresentation policy](https://support.google.com/merchants/answer/6150127).

Check product prices, currency, mandatory fees and the purchase path against the final policies. Passing a writing review does not verify checkout. [Google checkout requirements](https://support.google.com/merchants/answer/9158778).

Keep handling time, transit time, eligible destinations and shipping costs consistent with the configured service. Quantity-based charges must not be presented as one flat price for every order. [Google shipping settings](https://support.google.com/merchants/answer/12577710).

Stripe's website checklist calls for clear product descriptions, currency, contact methods and fulfillment policies. Check those alongside the Merchant Center requirements. [Stripe website checklist](https://docs.stripe.com/get-started/checklist/website).

Before promising dispatch times, establish a reasonable basis for them. US shipment-delay obligations can require notice, customer consent to delay or a refund; “estimated” wording does not replace an operational delay procedure. [FTC prompt delivery guidance](https://www.ftc.gov/business-guidance/resources/selling-internet-prompt-delivery-rules).

This review covers Google Merchant Center and Stripe source material. It does not certify Meta, TikTok Shop, Pinterest, Amazon or other channel requirements. Confirm the intended channels and applicable seller jurisdiction for that review.

## Writing tools assessed

- Humanizer 3.0.0 is available in this session at `/Users/changha/.agents/skills/humanizer/SKILL.md`. Its role here is editing tone while preserving supported facts. [Upstream repository](https://github.com/blader/humanizer).
- The project already exposes `copywriting`, `copy-editing`, `product-marketing`, `seo-audit` and `schema` skills. The [Marketing Skills repository](https://github.com/coreyhaines31/marketingskills) is useful for these complementary writing and site-quality tasks. None replaces platform policy sources or verification of business facts.
- [Automattic Legalmattic](https://github.com/Automattic/legalmattic) offers legal-document examples under CC BY-SA 4.0. Its WordPress/service context needs substantial adaptation for apparel retail. Observe its license if reusing text. No Legalmattic policy wording was copied into this draft.

Recommended workflow: verify business facts, draft the relevant pages, edit for clarity, apply Humanizer without changing policy meaning, then compare the final promises with checkout and channel settings. Installing more writing skills will not supply missing operational facts.
