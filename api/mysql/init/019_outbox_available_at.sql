set @has_outbox_available_at = (
  select count(*)
  from information_schema.columns
  where table_schema = database()
    and table_name = 'outbox_events'
    and column_name = 'available_at'
);
set @outbox_available_at_ddl = if(
  @has_outbox_available_at > 0,
  'select 1',
  'alter table outbox_events add column available_at timestamp(6) not null default current_timestamp(6) after status'
);
prepare outbox_available_at_stmt from @outbox_available_at_ddl;
execute outbox_available_at_stmt;
deallocate prepare outbox_available_at_stmt;

set @has_outbox_claim_index = (
  select count(*)
  from information_schema.statistics
  where table_schema = database()
    and table_name = 'outbox_events'
    and index_name = 'idx_outbox_claim'
);
set @outbox_claim_index_ddl = if(
  @has_outbox_claim_index > 0,
  'select 1',
  'alter table outbox_events add key idx_outbox_claim (status, available_at, id)'
);
prepare outbox_claim_index_stmt from @outbox_claim_index_ddl;
execute outbox_claim_index_stmt;
deallocate prepare outbox_claim_index_stmt;

insert ignore into schema_migrations(version) values ('019_outbox_available_at');
