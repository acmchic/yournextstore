# Implementation plans

| Plan | Status | Scope |
| --- | --- | --- |
| [001-own-commerce-platform.md](001-own-commerce-platform.md) | Proposed | Replace Commerce Kit/local fixtures with the store-owned FastAPI + MySQL commerce platform |
| [002-gearment-catalog-sync.md](002-gearment-catalog-sync.md) | Proposed | Import selected Gearment catalogs, variants, provider images, taxonomy overrides, and design-to-catalog offerings |
| [003-premium-home-navigation-seo-merchant-and-legal.md](003-premium-home-navigation-seo-merchant-and-legal.md) | Proposed | Premium homepage, taxonomy navigation, admin-managed legal pages, SEO, and Merchant Center readiness |

## Dependency notes

- [004-pdp-catalog-details-and-size-guide.md](004-pdp-catalog-details-and-size-guide.md): Ready for Luna max — PDP spacing, catalog size guide, fit/care and published policies, responsive drawer/slide-over.

- Plan 002 extends the owned schema and API boundary established by Plan 001. Its
  Gearment client, migration, importer, and asset sync can land before the full
  storefront cutover, but the tracer product route depends on Plan 001's product API.
- Plan 003 depends on the owned API/catalog schema from Plans 001–002. Execute its
  data contract and legal-page phases before changing homepage navigation or feeds.
