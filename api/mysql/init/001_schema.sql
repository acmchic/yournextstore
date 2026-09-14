set names utf8mb4;

create table if not exists schema_migrations (
  version varchar(64) primary key,
  applied_at timestamp(6) not null default current_timestamp(6)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists catalogs (
  id bigint unsigned auto_increment primary key,
  public_id varchar(26) not null unique,
  slug varchar(100) not null unique,
  name varchar(160) not null,
  product_type varchar(60) not null,
  material varchar(160) null,
  brand varchar(120) null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamp(6) not null default current_timestamp(6),
  updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
  key idx_catalog_active_sort (active, sort_order)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists catalog_colors (
  id bigint unsigned auto_increment primary key,
  catalog_id bigint unsigned not null,
  slug varchar(60) not null,
  name varchar(100) not null,
  hex char(7) null,
  active boolean not null default true,
  sort_order int not null default 0,
  unique key uq_catalog_color (catalog_id, slug),
  constraint fk_catalog_colors_catalog foreign key (catalog_id) references catalogs(id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists catalog_sizes (
  id bigint unsigned auto_increment primary key,
  catalog_id bigint unsigned not null,
  code varchar(30) not null,
  label varchar(60) not null,
  sort_order int not null default 0,
  active boolean not null default true,
  unique key uq_catalog_size (catalog_id, code),
  constraint fk_catalog_sizes_catalog foreign key (catalog_id) references catalogs(id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists catalog_variants (
  id bigint unsigned auto_increment primary key,
  public_id varchar(64) not null unique,
  catalog_id bigint unsigned not null,
  color_id bigint unsigned not null,
  size_id bigint unsigned not null,
  sku varchar(120) not null unique,
  base_cost_minor int unsigned not null default 0,
  default_price_minor int unsigned not null,
  currency char(3) not null default 'USD',
  stock_policy enum('finite','continue') not null default 'continue',
  stock_quantity int unsigned not null default 0,
  active boolean not null default true,
  unique key uq_catalog_variant (catalog_id, color_id, size_id),
  key idx_catalog_variant_active (catalog_id, active),
  constraint fk_catalog_variants_catalog foreign key (catalog_id) references catalogs(id),
  constraint fk_catalog_variants_color foreign key (color_id) references catalog_colors(id),
  constraint fk_catalog_variants_size foreign key (size_id) references catalog_sizes(id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists mockup_templates (
  id bigint unsigned auto_increment primary key,
  public_id varchar(100) not null unique,
  catalog_id bigint unsigned not null,
  color_id bigint unsigned not null,
  style enum('flat','men','women') not null default 'flat',
  placement enum('front','left-chest','back') not null default 'front',
  base_source varchar(500) not null,
  print_area_json json null,
  renderer_version varchar(60) not null default 'v3-sharp',
  active boolean not null default true,
  unique key uq_mockup_template (catalog_id, color_id, style, placement),
  constraint fk_mockup_templates_catalog foreign key (catalog_id) references catalogs(id),
  constraint fk_mockup_templates_color foreign key (color_id) references catalog_colors(id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists designs (
  id bigint unsigned auto_increment primary key,
  public_id varchar(26) not null unique,
  slug varchar(190) not null unique,
  name varchar(255) not null,
  source_path varchar(500) not null,
  checksum char(64) not null,
  width int unsigned null,
  height int unsigned null,
  license_status enum('unknown','owned','licensed','rejected') not null default 'unknown',
  alt_text varchar(500) null,
  metadata_json json null,
  status enum('draft','active','archived') not null default 'draft',
  created_at timestamp(6) not null default current_timestamp(6),
  updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
  key idx_design_checksum (checksum),
  key idx_design_status (status)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists products (
  id bigint unsigned auto_increment primary key,
  public_id varchar(26) not null unique,
  design_id bigint unsigned not null,
  slug varchar(190) not null unique,
  title varchar(255) not null,
  description text null,
  status enum('draft','active','archived') not null default 'draft',
  brand varchar(120) not null,
  product_condition enum('new','refurbished','used') not null default 'new',
  seo_title varchar(255) null,
  seo_description varchar(500) null,
  published_at timestamp(6) null,
  created_at timestamp(6) not null default current_timestamp(6),
  updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
  constraint fk_products_design foreign key (design_id) references designs(id),
  key idx_product_publish (status, published_at, id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists product_catalogs (
  product_id bigint unsigned not null,
  catalog_id bigint unsigned not null,
  default_color_id bigint unsigned null,
  price_adjustment_minor int not null default 0,
  active boolean not null default true,
  primary key (product_id, catalog_id),
  constraint fk_product_catalogs_product foreign key (product_id) references products(id),
  constraint fk_product_catalogs_catalog foreign key (catalog_id) references catalogs(id),
  constraint fk_product_catalogs_default_color foreign key (default_color_id) references catalog_colors(id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists product_variants (
  id bigint unsigned auto_increment primary key,
  public_id varchar(90) not null unique,
  product_id bigint unsigned not null,
  catalog_variant_id bigint unsigned not null,
  sku varchar(160) not null unique,
  price_minor int unsigned not null,
  compare_at_minor int unsigned null,
  currency char(3) not null default 'USD',
  active boolean not null default true,
  unique key uq_product_catalog_variant (product_id, catalog_variant_id),
  key idx_product_variant_active (product_id, active),
  constraint fk_product_variants_product foreign key (product_id) references products(id),
  constraint fk_product_variants_catalog_variant foreign key (catalog_variant_id) references catalog_variants(id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists collections (
  id bigint unsigned auto_increment primary key,
  public_id varchar(26) not null unique,
  slug varchar(190) not null unique,
  title varchar(255) not null,
  description text null,
  image_url varchar(500) null,
  status enum('draft','active','archived') not null default 'draft',
  indexable boolean not null default false,
  seo_title varchar(255) null,
  seo_description varchar(500) null,
  created_at timestamp(6) not null default current_timestamp(6),
  updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
  key idx_collection_publish (status, indexable)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists collection_products (
  collection_id bigint unsigned not null,
  product_id bigint unsigned not null,
  sort_order int not null default 0,
  primary key (collection_id, product_id),
  constraint fk_collection_products_collection foreign key (collection_id) references collections(id),
  constraint fk_collection_products_product foreign key (product_id) references products(id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists carts (
  id bigint unsigned auto_increment primary key,
  public_id varchar(36) not null unique,
  currency char(3) not null default 'USD',
  status enum('active','converted','expired') not null default 'active',
  expires_at timestamp(6) null,
  created_at timestamp(6) not null default current_timestamp(6),
  updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
  key idx_cart_status_expiry (status, expires_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists cart_items (
  cart_id bigint unsigned not null,
  product_variant_id bigint unsigned not null,
  quantity int unsigned not null,
  created_at timestamp(6) not null default current_timestamp(6),
  updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
  primary key (cart_id, product_variant_id),
  constraint fk_cart_items_cart foreign key (cart_id) references carts(id),
  constraint fk_cart_items_variant foreign key (product_variant_id) references product_variants(id),
  constraint chk_cart_item_quantity check (quantity between 1 and 99)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists orders (
  id bigint unsigned auto_increment primary key,
  public_id varchar(36) not null unique,
  order_number varchar(32) not null unique,
  cart_id bigint unsigned null,
  email varchar(320) not null,
  currency char(3) not null,
  subtotal_minor int unsigned not null,
  shipping_minor int unsigned not null default 0,
  tax_minor int unsigned not null default 0,
  discount_minor int unsigned not null default 0,
  total_minor int unsigned not null,
  payment_status enum('pending','paid','failed','refunded') not null default 'pending',
  fulfillment_status enum('unfulfilled','processing','fulfilled','cancelled') not null default 'unfulfilled',
  created_at timestamp(6) not null default current_timestamp(6),
  updated_at timestamp(6) not null default current_timestamp(6) on update current_timestamp(6),
  constraint fk_orders_cart foreign key (cart_id) references carts(id),
  key idx_order_email_created (email, created_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists order_items (
  id bigint unsigned auto_increment primary key,
  order_id bigint unsigned not null,
  product_variant_public_id varchar(90) not null,
  sku varchar(160) not null,
  title varchar(255) not null,
  catalog_name varchar(160) not null,
  color_name varchar(100) not null,
  size_code varchar(30) not null,
  mockup_url varchar(500) not null,
  unit_price_minor int unsigned not null,
  quantity int unsigned not null,
  line_total_minor int unsigned not null,
  constraint fk_order_items_order foreign key (order_id) references orders(id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists order_addresses (
  id bigint unsigned auto_increment primary key,
  order_id bigint unsigned not null,
  address_type enum('shipping','billing') not null,
  full_name varchar(255) not null,
  line1 varchar(255) not null,
  line2 varchar(255) null,
  city varchar(120) not null,
  region varchar(120) null,
  postal_code varchar(40) not null,
  country_code char(2) not null,
  phone varchar(40) null,
  unique key uq_order_address_type (order_id, address_type),
  constraint fk_order_addresses_order foreign key (order_id) references orders(id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists idempotency_keys (
  idempotency_key varchar(190) primary key,
  request_hash char(64) not null,
  resource_type varchar(40) not null,
  resource_id varchar(64) null,
  response_json json null,
  created_at timestamp(6) not null default current_timestamp(6),
  expires_at timestamp(6) null
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists outbox_events (
  id bigint unsigned auto_increment primary key,
  event_type varchar(100) not null,
  aggregate_type varchar(60) not null,
  aggregate_id varchar(90) not null,
  payload_json json not null,
  status enum('pending','processing','done','failed') not null default 'pending',
  available_at timestamp(6) not null default current_timestamp(6),
  attempts int unsigned not null default 0,
  created_at timestamp(6) not null default current_timestamp(6),
  processed_at timestamp(6) null,
  key idx_outbox_claim (status, available_at, id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

insert ignore into schema_migrations(version) values ('001_schema');
