set names utf8mb4;

alter table catalogs
  drop column shipping_guideline_json,
  drop column provider_payload_json,
  drop column website_payload_json,
  drop column provider_synced_at,
  drop column website_synced_at;

alter table catalog_variants
  drop column provider_payload_json,
  drop column provider_synced_at;

insert ignore into schema_migrations(version) values ('007_remove_unused_catalog_payload');
