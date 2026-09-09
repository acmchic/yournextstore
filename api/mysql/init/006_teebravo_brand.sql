set names utf8mb4;

-- Rebrand store-owned listings only. Preserve actual garment-provider brands.
update products
set brand='TeeBravo'
where lower(trim(brand)) in ('your next store', 'yournextstore', 'acm chic', 'acmchic', 'acmchic.com', 'own brand');

alter table products alter column brand set default 'TeeBravo';

insert ignore into schema_migrations(version) values ('006_teebravo_brand');
