-- Restore missing migration: collection ordering + merchandising flags
-- referenced by app/repository.py (list_collections / get_collection).

alter table collections
  add column sort_order int not null default 0 after image_url,
  add column featured boolean not null default false after indexable,
  add column selection_rule varchar(32) not null default 'manual' after featured;

alter table collections
  add key idx_collection_sort (sort_order);

insert into schema_migrations (version) values ('004_catalog_color_sort_order');
