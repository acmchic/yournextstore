-- Non-unique: historical duplicates remain available for manual review.
set @title_index_sql := if(
  exists(select 1 from information_schema.statistics
         where table_schema = database() and table_name = 'products'
           and index_name = 'idx_products_title'),
  'select 1',
  'alter table products add index idx_products_title (title)'
);
prepare title_index_statement from @title_index_sql;
execute title_index_statement;
deallocate prepare title_index_statement;
insert ignore into schema_migrations(version) values ('017_product_title_index');
