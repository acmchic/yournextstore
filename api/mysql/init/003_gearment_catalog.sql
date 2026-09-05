set names utf8mb4;

alter table catalogs
  add column provider varchar(32) not null default 'manual' after id,
  add column provider_product_id varchar(100) null after provider,
  add column provider_legacy_product_id int null after provider_product_id,
  add column source_page_url varchar(500) null after brand,
  add column source_page_slug varchar(190) null after source_page_url,
  add column provider_description text null after source_page_slug,
  add column description_override text null after provider_description,
  add column provider_size_chart_json json null after description_override,
  add column size_chart_override_json json null after provider_size_chart_json,
  add column shipping_guideline_json json null after size_chart_override_json,
  add column artwork_guideline_json json null after shipping_guideline_json,
  add column provider_payload_json json null after artwork_guideline_json,
  add column website_payload_json json null after provider_payload_json,
  add column provider_synced_at timestamp(6) null after website_payload_json,
  add column website_synced_at timestamp(6) null after provider_synced_at,
  add unique key uq_catalog_provider_product (provider, provider_product_id);

alter table catalog_colors
  add column provider_color_code varchar(100) null after catalog_id,
  add unique key uq_catalog_provider_color (catalog_id, provider_color_code);

alter table catalog_sizes
  add column provider_size_code varchar(100) null after catalog_id,
  add unique key uq_catalog_provider_size (catalog_id, provider_size_code);

alter table catalog_variants
  add column provider_variant_id varchar(100) null after catalog_id,
  add column provider_legacy_variant_id int null after provider_variant_id,
  add column provider_sku varchar(160) null after provider_legacy_variant_id,
  add column provider_price_minor int unsigned null after base_cost_minor,
  add column recommended_price_minor int unsigned null after provider_price_minor,
  add column extra_price_minor int unsigned null after recommended_price_minor,
  add column net_price_minor int unsigned null after extra_price_minor,
  add column provider_stock_label varchar(80) null after stock_quantity,
  add column provider_payload_json json null after provider_stock_label,
  add column provider_synced_at timestamp(6) null after provider_payload_json,
  add unique key uq_catalog_provider_variant (catalog_id, provider_variant_id);

create table if not exists catalog_print_locations (
  id bigint unsigned auto_increment primary key,
  catalog_id bigint unsigned not null,
  provider_location_id int null,
  code varchar(80) not null,
  name varchar(120) not null,
  active boolean not null default true,
  unique key uq_catalog_print_location (catalog_id, code),
  constraint fk_catalog_print_locations_catalog foreign key (catalog_id) references catalogs(id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists catalog_taxonomy (
  id bigint unsigned auto_increment primary key,
  catalog_id bigint unsigned not null,
  department enum('men','women','kids','home-living','accessories') not null,
  type_slug varchar(100) not null,
  type_label varchar(120) not null,
  source_url varchar(500) null,
  sort_order int not null default 0,
  unique key uq_catalog_taxonomy (catalog_id, department, type_slug),
  constraint fk_catalog_taxonomy_catalog foreign key (catalog_id) references catalogs(id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists catalog_assets (
  id bigint unsigned auto_increment primary key,
  catalog_id bigint unsigned not null,
  color_id bigint unsigned null,
  kind enum('avatar','gallery','size-chart','artwork-template','blank','other') not null,
  source_url varchar(1000) not null,
  source_hash char(64) not null,
  local_path varchar(500) not null,
  checksum char(64) not null,
  mime_type varchar(100) not null,
  width int unsigned null,
  height int unsigned null,
  byte_size int unsigned not null,
  status enum('active','failed','archived') not null default 'active',
  created_at timestamp(6) not null default current_timestamp(6),
  updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
  unique key uq_catalog_asset_source (catalog_id, kind, source_hash),
  constraint fk_catalog_assets_catalog foreign key (catalog_id) references catalogs(id),
  constraint fk_catalog_assets_color foreign key (color_id) references catalog_colors(id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

insert ignore into schema_migrations(version) values ('003_gearment_catalog');
