set @add_delivery_column_sql := if(
  exists(
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'checkout_settings'
      and column_name = 'pdp_assurance_enabled'
  ),
  'select 1',
  'alter table checkout_settings add column pdp_assurance_enabled boolean not null default false'
);
prepare add_delivery_column_statement from @add_delivery_column_sql;
execute add_delivery_column_statement;
deallocate prepare add_delivery_column_statement;

set @add_delivery_column_sql := if(
  exists(
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'checkout_settings'
      and column_name = 'processing_min_business_days'
  ),
  'select 1',
  'alter table checkout_settings add column processing_min_business_days smallint unsigned null'
);
prepare add_delivery_column_statement from @add_delivery_column_sql;
execute add_delivery_column_statement;
deallocate prepare add_delivery_column_statement;

set @add_delivery_column_sql := if(
  exists(
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'checkout_settings'
      and column_name = 'processing_max_business_days'
  ),
  'select 1',
  'alter table checkout_settings add column processing_max_business_days smallint unsigned null'
);
prepare add_delivery_column_statement from @add_delivery_column_sql;
execute add_delivery_column_statement;
deallocate prepare add_delivery_column_statement;

set @add_delivery_column_sql := if(
  exists(
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'checkout_settings'
      and column_name = 'standard_transit_min_business_days'
  ),
  'select 1',
  'alter table checkout_settings add column standard_transit_min_business_days smallint unsigned null'
);
prepare add_delivery_column_statement from @add_delivery_column_sql;
execute add_delivery_column_statement;
deallocate prepare add_delivery_column_statement;

set @add_delivery_column_sql := if(
  exists(
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'checkout_settings'
      and column_name = 'standard_transit_max_business_days'
  ),
  'select 1',
  'alter table checkout_settings add column standard_transit_max_business_days smallint unsigned null'
);
prepare add_delivery_column_statement from @add_delivery_column_sql;
execute add_delivery_column_statement;
deallocate prepare add_delivery_column_statement;

set @add_delivery_column_sql := if(
  exists(
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'checkout_settings'
      and column_name = 'express_transit_min_business_days'
  ),
  'select 1',
  'alter table checkout_settings add column express_transit_min_business_days smallint unsigned null'
);
prepare add_delivery_column_statement from @add_delivery_column_sql;
execute add_delivery_column_statement;
deallocate prepare add_delivery_column_statement;

set @add_delivery_column_sql := if(
  exists(
    select 1 from information_schema.columns
    where table_schema = database()
      and table_name = 'checkout_settings'
      and column_name = 'express_transit_max_business_days'
  ),
  'select 1',
  'alter table checkout_settings add column express_transit_max_business_days smallint unsigned null'
);
prepare add_delivery_column_statement from @add_delivery_column_sql;
execute add_delivery_column_statement;
deallocate prepare add_delivery_column_statement;

insert ignore into schema_migrations(version) values ('011_pdp_delivery_estimate');
