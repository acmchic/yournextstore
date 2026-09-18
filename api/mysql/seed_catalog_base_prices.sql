-- Run manually after migration 015_catalog_base_price.
-- Assign one random 20%–35% markdown per catalog, preserving its sale price.
-- Existing base prices are left untouched so this can be safely re-run.
start transaction;

create temporary table catalog_base_price_seed as
select catalog_id, floor(20 + rand() * 16) as markdown_percent
from catalog_variants
where active = true
group by catalog_id;

update catalog_variants as variant_row
join catalog_base_price_seed as seed on seed.catalog_id = variant_row.catalog_id
set variant_row.base_price_minor = ceil(
  variant_row.default_price_minor * (100 + seed.markdown_percent) / 100
)
where variant_row.active = true
  and variant_row.base_price_minor is null;

commit;
