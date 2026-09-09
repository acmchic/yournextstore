create table if not exists catalog_mockup_metadata (
  id bigint unsigned auto_increment primary key,
  catalog_id bigint unsigned not null,
  placement varchar(40) not null,
  asset_id bigint unsigned not null,
  print_area_json json not null,
  garment_mask_path varchar(500) null,
  displacement_path varchar(500) null,
  shadow_path varchar(500) null,
  highlight_path varchar(500) null,
  template_width int unsigned not null,
  template_height int unsigned not null,
  analysis_version varchar(40) not null,
  status enum('ready','needs_review','failed') not null default 'needs_review',
  error_message varchar(500) null,
  analyzed_at timestamp(6) null,
  created_at timestamp(6) not null default current_timestamp(6),
  updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
  unique key uq_catalog_mockup_metadata (catalog_id, placement),
  constraint fk_catalog_mockup_metadata_catalog foreign key (catalog_id) references catalogs(id),
  constraint fk_catalog_mockup_metadata_asset foreign key (asset_id) references catalog_assets(id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

insert ignore into schema_migrations(version) values ('004_catalog_mockup_metadata');
