# Implementation plans

| Plan | Status | Scope |
| --- | --- | --- |
| [001-own-commerce-platform.md](001-own-commerce-platform.md) | Proposed | Replace Commerce Kit/local fixtures with the store-owned FastAPI + MySQL commerce platform |
| [002-gearment-catalog-sync.md](002-gearment-catalog-sync.md) | Proposed | Import selected Gearment catalogs, variants, provider images, taxonomy overrides, and design-to-catalog offerings |

## Dependency notes

- Plan 002 extends the owned schema and API boundary established by Plan 001. Its
  Gearment client, migration, importer, and asset sync can land before the full
  storefront cutover, but the tracer product route depends on Plan 001's product API.
