#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
api_dir="$repo_dir/api"
if [[ ! -f "$api_dir/.env" ]]; then
  echo "Missing api/.env" >&2
  exit 1
fi

if ! grep -Eq '^(GEARMENT_CLIENT_KEY|GEARMENT_API_KEY|X-Gearment-Client-Key)=.+' "$api_dir/.env"; then
  echo "Missing Gearment client key in api/.env" >&2
  exit 1
fi

if ! grep -Eq '^(GEARMENT_CLIENT_SECRET|GEARMENT_API_SECRET|X-Gearment-Client-Secret)=.+' "$api_dir/.env"; then
  echo "Missing Gearment client secret in api/.env" >&2
  exit 1
fi

if command -v docker >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    compose=(docker-compose)
  else
    compose=(docker compose)
  fi
  compose+=(--env-file "$api_dir/.env" -f "$api_dir/docker-compose.yml")
  "${compose[@]}" up -d db
  until "${compose[@]}" exec -T db sh -c \
    'mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent' >/dev/null 2>&1; do
    sleep 1
  done
  for migration in 001_schema.sql 002_seed_catalog.sql 003_gearment_catalog.sql 004_catalog_color_sort_order.sql 004_catalog_mockup_metadata.sql 005_catalog_asset_placement.sql 006_teebravo_brand.sql 007_remove_unused_catalog_payload.sql 008_catalog_asset_categories.sql 009_catalog_material_json.sql; do
    version="${migration%.sql}"
    applied="$("${compose[@]}" exec -T db sh -c \
      "mysql -N -uroot -p\"\$MYSQL_ROOT_PASSWORD\" \"\$MYSQL_DATABASE\" -e \"select count(*) from schema_migrations where version='${version}'\"" \
      2>/dev/null || true)"
    if [[ "$applied" != "1" ]]; then
      "${compose[@]}" exec -T db sh -c \
        'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < "$api_dir/mysql/init/$migration"
    fi
  done
  "${compose[@]}" build api
  mkdir -p "$api_dir/catalog-cache"
  "${compose[@]}" run --rm --no-deps \
    -v "$api_dir/public:/app/public:rw" \
    -v "$api_dir/catalog-cache:/app/catalog-cache:rw" \
    api python -m app.cli sync-gearment-catalog \
    --manifest /app/catalog-import.json --cache-file /app/catalog-cache/catalog-import.cache.json --apply
else
  env_value() {
    awk -F= -v key="$1" '$1 == key {sub(/^[^=]*=/, ""); gsub(/\r$/, ""); print; exit}' "$api_dir/.env"
  }
  db_host="$(env_value DB_HOST)"
  db_port="$(env_value DB_PORT)"
  db_user="$(env_value DB_USER)"
  db_password="$(env_value DB_PASSWORD)"
  db_name="$(env_value DB_NAME)"
  export MYSQL_PWD="$db_password"
  mysql_args=(-h "${db_host:-127.0.0.1}" -P "${db_port:-3306}" -u "${db_user:-root}" "${db_name:-pod_store}")
  for migration in 001_schema.sql 002_seed_catalog.sql 003_gearment_catalog.sql 004_catalog_color_sort_order.sql 004_catalog_mockup_metadata.sql 005_catalog_asset_placement.sql 006_teebravo_brand.sql 007_remove_unused_catalog_payload.sql 008_catalog_asset_categories.sql 009_catalog_material_json.sql; do
    version="${migration%.sql}"
    applied="$(mysql "${mysql_args[@]}" -N -e "select count(*) from schema_migrations where version='${version}'" 2>/dev/null || true)"
    if [[ "$applied" != "1" ]]; then
      mysql "${mysql_args[@]}" < "$api_dir/mysql/init/$migration"
    fi
  done
  (
    cd "$api_dir"
    PYTHONPATH=. .venv/bin/python -m app.cli sync-gearment-catalog \
      --manifest catalog-import.json --apply
  )
fi
