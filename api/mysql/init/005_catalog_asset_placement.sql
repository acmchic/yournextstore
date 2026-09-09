set names utf8mb4;

alter table catalog_assets
  add column placement enum('front','back','avatar','gallery','unknown') not null default 'unknown' after kind,
  add key ix_catalog_assets_placement (catalog_id, placement, status);

-- Preserve existing imports while the next import learns provider placement metadata.
update catalog_assets set placement='avatar' where placement='unknown' and local_path like '%/avatar-%';
update catalog_assets set placement='front' where placement='unknown' and local_path like '%/gallery-2.%';
update catalog_assets set placement='back' where placement='unknown' and local_path like '%/gallery-3.%';

insert ignore into schema_migrations(version) values ('005_catalog_asset_placement');
