create table if not exists checkout_settings (
  id tinyint unsigned primary key,
  standard_first_minor int unsigned not null default 500,
  standard_additional_minor int unsigned not null default 300,
  express_first_minor int unsigned not null default 1100,
  express_additional_minor int unsigned not null default 400,
  details_json json not null,
  updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6)
) engine=InnoDB default charset=utf8mb4;
insert ignore into checkout_settings(id,details_json) values (1, JSON_OBJECT());

create table if not exists checkout_attempts (
  id char(36) primary key,
  cart_id bigint unsigned not null,
  stripe_session_id varchar(255) null unique,
  snapshot_json json not null,
  status varchar(32) not null default 'creating',
  order_id bigint unsigned null unique,
  shipping_method varchar(32) null,
  payment_intent_id varchar(255) null,
  created_at timestamp(6) not null default current_timestamp(6),
  updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
  key checkout_cart_status (cart_id,status),
  foreign key (cart_id) references carts(id),
  foreign key (order_id) references orders(id)
) engine=InnoDB default charset=utf8mb4;

create table if not exists stripe_events (
  id varchar(255) primary key,
  event_type varchar(100) not null,
  created_at timestamp(6) not null default current_timestamp(6)
) engine=InnoDB default charset=utf8mb4;

create table if not exists customers (
  id bigint unsigned auto_increment primary key,
  email varchar(255) not null unique,
  full_name varchar(255) not null,
  shipping_address_json json not null,
  created_at timestamp(6) not null default current_timestamp(6),
  updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6)
) engine=InnoDB default charset=utf8mb4;

insert ignore into schema_migrations(version) values ('010_checkout_stripe_shipping');
