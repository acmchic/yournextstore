alter table catalog_variants
  add column base_price_minor int unsigned null after default_price_minor;

insert ignore into schema_migrations(version) values ('015_catalog_base_price');
