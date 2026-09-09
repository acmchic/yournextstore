set names utf8mb4;

set @add_provider_material_json_sql := if(
  exists(
    select 1
    from information_schema.columns
    where table_schema = database()
      and table_name = 'catalogs'
      and column_name = 'provider_material_json'
  ),
  'select 1',
  'alter table catalogs add column provider_material_json json null after provider_description'
);
prepare add_provider_material_json_statement from @add_provider_material_json_sql;
execute add_provider_material_json_statement;
deallocate prepare add_provider_material_json_statement;

insert ignore into schema_migrations(version) values ('009_catalog_material_json');
