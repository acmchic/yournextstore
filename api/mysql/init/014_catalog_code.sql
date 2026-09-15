alter table catalogs add column code varchar(100) null after name;

insert ignore into schema_migrations(version) values ('014_catalog_code');
