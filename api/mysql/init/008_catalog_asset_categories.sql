set names utf8mb4;

-- Asset paths are stored as relative paths and are now grouped by catalog category.

insert ignore into schema_migrations(version) values ('008_catalog_asset_categories');
