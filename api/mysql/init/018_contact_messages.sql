create table if not exists contact_messages (
  id char(36) primary key,
  email varchar(320) not null,
  message text not null,
  store_id varchar(36) not null default 'teebravo',
  read_at timestamp(6) null,
  email_sent_at timestamp(6) null,
  created_at timestamp(6) not null default current_timestamp(6),
  updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
  key idx_contact_messages_created_at (created_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

insert ignore into schema_migrations(version) values ('018_contact_messages');
