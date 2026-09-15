set @add_model_prompt_sql := if(
  exists(
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'catalogs'
      and column_name = 'model_mockup_prompt'
  ),
  'select 1',
  'alter table catalogs add column model_mockup_prompt longtext null after description_override'
);
prepare add_model_prompt_statement from @add_model_prompt_sql;
execute add_model_prompt_statement;
deallocate prepare add_model_prompt_statement;

set @add_template_width_sql := if(
  exists(
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'mockup_templates'
      and column_name = 'template_width'
  ),
  'select 1',
  'alter table mockup_templates add column template_width int unsigned null after print_area_json'
);
prepare add_template_width_statement from @add_template_width_sql;
execute add_template_width_statement;
deallocate prepare add_template_width_statement;

set @add_template_height_sql := if(
  exists(
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'mockup_templates'
      and column_name = 'template_height'
  ),
  'select 1',
  'alter table mockup_templates add column template_height int unsigned null after template_width'
);
prepare add_template_height_statement from @add_template_height_sql;
execute add_template_height_statement;
deallocate prepare add_template_height_statement;

insert ignore into schema_migrations(version) values ('012_catalog_model_mockups');
