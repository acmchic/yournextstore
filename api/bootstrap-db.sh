#!/usr/bin/env bash

set -euo pipefail

script_dir="${BASH_SOURCE[0]%/*}"
if [[ "$script_dir" == "${BASH_SOURCE[0]}" ]]; then
  script_dir="."
fi
cd "$script_dir"

if [[ ! -f .env ]]; then
  echo "Missing api/.env" >&2
  exit 1
fi

env_value() {
  local key="$1" line value
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == "$key="* ]] || continue
    value="${line#*=}"
    value="${value%$'\r'}"
    value="${value#\"}"
    value="${value%\"}"
    value="${value#\'}"
    value="${value%\'}"
    printf '%s' "$value"
    return
  done < .env
}

db_host="$(env_value DB_HOST)"
db_port="$(env_value DB_PORT)"
db_user="$(env_value DB_USER)"
db_password="$(env_value DB_PASSWORD)"
db_name="$(env_value DB_NAME)"

db_host="${db_host:-127.0.0.1}"
db_port="${db_port:-3306}"
db_user="${db_user:-root}"
db_name="${db_name:-pod_store}"

if [[ ! "$db_name" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "DB_NAME may contain only letters, numbers, and underscores." >&2
  exit 1
fi

export MYSQL_PWD="$db_password"
mysql_base=(--host="$db_host" --port="$db_port" --user="$db_user")

mysql "${mysql_base[@]}" -e "create database if not exists \`$db_name\` character set utf8mb4 collate utf8mb4_unicode_ci"

for migration in mysql/init/001_schema.sql mysql/init/002_seed_catalog.sql mysql/init/003_gearment_catalog.sql mysql/init/004_catalog_mockup_metadata.sql mysql/init/004_catalog_color_sort_order.sql mysql/init/005_catalog_asset_placement.sql mysql/init/006_teebravo_brand.sql mysql/init/007_remove_unused_catalog_payload.sql mysql/init/008_catalog_asset_categories.sql mysql/init/009_catalog_material_json.sql mysql/init/010_checkout_stripe_shipping.sql mysql/init/011_pdp_delivery_estimate.sql mysql/init/012_catalog_model_mockups.sql mysql/init/013_expand_model_renderer_version.sql mysql/init/014_catalog_code.sql mysql/init/015_catalog_base_price.sql mysql/init/016_catalog_mockup_image_metadata.sql mysql/init/017_product_title_index.sql mysql/init/018_contact_messages.sql mysql/init/019_outbox_available_at.sql; do
  version="${migration##*/}"
  version="${version%.sql}"
  applied="$(mysql "${mysql_base[@]}" "$db_name" -N -e "select count(*) from schema_migrations where version='$version'" 2>/dev/null || true)"
  if [[ "$applied" != "1" ]]; then
    mysql "${mysql_base[@]}" "$db_name" < "$migration"
    echo "Applied $version"
  fi
done
