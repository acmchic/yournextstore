# Footer and policy audit — 2026-09-22

## Findings and changes

- Live footer repeated About, Contact, FAQ, Shipping and Returns across Support
  and Legal. Footer now lists each published policy once under Customer care or
  Policies. Contact visibility follows CMS publication, not the contact-form flag.
- Root policy URLs previously rewrote to `/legal` while canonical metadata and
  sitemap advertised `/legal` URLs. Root URLs now render the CMS page directly;
  `/legal/:slug` permanently redirects (308). FAQ/contact aliases also redirect.
- Canonical metadata, sitemap, llms.txt and return-policy JSON-LD now agree on
  root URLs. Sitemap no longer lists FAQ/contact separately from published CMS pages.
- About, Contact and FAQ share the policy renderer. Unpublished pages are not
  replaced with an empty policy or a nonfunctional contact form.
- Policy text is escaped by the existing adapter and rendered on the server.
  No login, client-side fetch or interaction is required to obtain its content.

## Content review

The published English policies already describe business identity and email,
US destinations, quantity-based shipping charges, production plus transit times,
defective versus non-defective claims, the 30-day reporting window, evidence,
returnless remedies, fees and refund timing. Privacy covers data collection,
Stripe, service providers, storage/cookies, retention and privacy requests.
These operational commitments were retained rather than inventing new promises.

The production robots.txt permits policy crawling. Production HTML observed during
this audit obfuscates the email address as `[email protected]` through the edge
layer. Check the CDN email-protection setting before submission if crawlers cannot
extract the support address; this repository change does not control that setting.

Neither Google nor Pinterest requires removing `/legal` or forbids a repeated
footer link in itself. Root URLs and deduplication are the requested information
architecture; approval depends on clear policies, working links, accurate products
and a functioning purchase path.

## Verification and release

- 18 existing tests passed; changed-file Biome checks and TypeScript passed.
- Production build passed using the public API and production URL configuration.
- `bun scripts/audit-policies.ts http://localhost:3100` checks seven pages with
  browser, Googlebot and Pinterestbot user agents, server HTML, canonical URLs,
  legacy 308 redirects, footer uniqueness and sitemap URLs. User-agent simulation
  is not evidence that the actual search engines have crawled or approved the site.
- Browser inspection confirmed desktop and 390px footer layout.
- Changes are local until deployed. After deployment, run the script against
  `https://teebravo.com`, then submit the sitemap and matching shipping/return
  settings in platform accounts. Complete a real test purchase before applying.

Sources checked:
- https://support.google.com/merchants/answer/12756116
- https://policy.pinterest.com/en/merchant-guidelines
