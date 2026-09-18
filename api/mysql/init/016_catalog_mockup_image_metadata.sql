set @add_source_path_sql := if(
  exists(
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'catalog_mockup_metadata'
      and column_name = 'source_path'
  ),
  'select 1',
  'alter table catalog_mockup_metadata add column source_path varchar(500) null after asset_id'
);
prepare add_source_path_statement from @add_source_path_sql;
execute add_source_path_statement;
deallocate prepare add_source_path_statement;

set @allow_null_asset_sql := if(
  exists(
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'catalog_mockup_metadata'
      and column_name = 'asset_id'
      and is_nullable = 'YES'
  ),
  'select 1',
  'alter table catalog_mockup_metadata modify column asset_id bigint unsigned null'
);
prepare allow_null_asset_statement from @allow_null_asset_sql;
execute allow_null_asset_statement;
deallocate prepare allow_null_asset_statement;

insert ignore into schema_migrations(version) values ('016_catalog_mockup_image_metadata');
