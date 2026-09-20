#!/usr/bin/env bash
# Host Node/systemd + isolated Docker backends. Fixed layout: /srv/teebravo/repository (this checkout).
set -Eeuo pipefail
umask 022
BASE=/srv/teebravo
REPO="$BASE/repository"
APP_USER=teebravo
DEPLOY_CONFIG=/etc/teebravo/deploy.env
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
storefront=1 admin=0 api=0 db=0 setup=0 tls=0 force=0 production=0 email=''
usage() {
  cat <<'HELP'
Usage: sudo bash deploy.sh [options]
  (no options)      Deploy storefront only
  --admin | admin   Also deploy admin
  --api | api       Also deploy API
  --all             Ensure TeeBravo DB, deploy API, admin, then storefront
  --db              Also ensure TeeBravo MySQL is running
  --only-admin      Deploy admin only
  --only-api        Deploy API only
  --setup           Install storefront unit, generate env, HTTP challenge config; no deploy
  --ssl EMAIL       Obtain/retain Certbot certificate and install HTTPS configs only
  --production EMAIL  Setup, deploy all services, obtain SSL, and install HTTPS configs
  --force           Rebuild even when inputs are unchanged
  --help            Show this help
Run from /srv/teebravo/repository. Read docs/vps-deployment.md first.
HELP
}
while (($#)); do
  case "$1" in
    --admin|admin) admin=1 ;;
    --api|api) api=1 ;;
    --all) admin=1; api=1; db=1 ;;
    --db) db=1 ;;
    --only-admin) storefront=0; admin=1 ;;
    --only-api) storefront=0; api=1 ;;
    --setup) setup=1 ;;
    --ssl) tls=1; shift; email="${1:-}"; [[ -n "$email" && "$email" != -* ]] || { usage; exit 2; } ;;
    --production) production=1; setup=1; tls=1; admin=1; api=1; db=1; shift; email="${1:-}"; [[ -n "$email" && "$email" != -* ]] || { usage; exit 2; } ;;
    --force) force=1 ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done
fail() { echo "ERROR: $*" >&2; exit 1; }
[[ $EUID == 0 ]] || fail 'Run with sudo.'
[[ $(pwd -P) == "$REPO" ]] || fail "cd $REPO first."
[[ $(realpath "${BASH_SOURCE[0]}") == "$REPO/deploy.sh" ]] || fail 'Use the repository deploy.sh.'
((production || !(setup && tls))) || fail 'Run --setup and --ssl separately, or use --production EMAIL.'
((!production || (admin && api && db && storefront))) || fail '--production deploys the complete production stack.'
exec 9>/run/lock/teebravo-deploy.lock
flock -n 9 || fail 'Another deploy is running.'
need() { command -v "$1" >/dev/null || fail "Missing executable: $1"; }
run() { runuser -u "$APP_USER" -- "$@"; }
load_config() {
  [[ -s "$DEPLOY_CONFIG" ]] || fail "Missing $DEPLOY_CONFIG; run --setup first."
  set -a
  # This file is generated from deploy/env/deploy.env.example and contains no secrets.
  # shellcheck disable=SC1090
  . "$DEPLOY_CONFIG"
  set +a
  TEEBRAVO_SHARED_DIR="${TEEBRAVO_SHARED_DIR:-$BASE/shared}"
  TEEBRAVO_DOCKER_CONFIG_DIR="${TEEBRAVO_DOCKER_CONFIG_DIR:-/etc/teebravo}"
  [[ "$TEEBRAVO_SHARED_DIR" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail 'Invalid TEEBRAVO_SHARED_DIR in /etc/teebravo/deploy.env.'
  [[ "$TEEBRAVO_DOCKER_CONFIG_DIR" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail 'Invalid TEEBRAVO_DOCKER_CONFIG_DIR in /etc/teebravo/deploy.env.'
  for name in TEEBRAVO_PUBLIC_DOMAIN TEEBRAVO_ADMIN_DOMAIN TEEBRAVO_API_DOMAIN TEEBRAVO_CERT_NAME TEEBRAVO_STOREFRONT_PORT TEEBRAVO_API_PORT TEEBRAVO_COMPOSE_PROJECT; do
    [[ -n "${!name:-}" ]] || fail "Missing $name in $DEPLOY_CONFIG."
  done
  for domain in "$TEEBRAVO_PUBLIC_DOMAIN" "$TEEBRAVO_ADMIN_DOMAIN" "$TEEBRAVO_API_DOMAIN" "$TEEBRAVO_CERT_NAME"; do
    [[ "$domain" =~ ^[A-Za-z0-9.-]+$ ]] || fail "Invalid domain in $DEPLOY_CONFIG: $domain"
  done
  for port in "$TEEBRAVO_STOREFRONT_PORT" "$TEEBRAVO_API_PORT"; do
    [[ "$port" =~ ^[0-9]+$ && "$port" -ge 1024 && "$port" -le 65535 ]] || fail "Invalid port in $DEPLOY_CONFIG: $port"
  done
  [[ "$TEEBRAVO_COMPOSE_PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || fail 'Invalid Docker Compose project name.'
}
render_template() {
  local source=$1 target=$2
  python3 deploy/render-config.py "$source" "$target" \
    "PUBLIC_DOMAIN=$TEEBRAVO_PUBLIC_DOMAIN" \
    "ADMIN_DOMAIN=$TEEBRAVO_ADMIN_DOMAIN" \
    "API_DOMAIN=$TEEBRAVO_API_DOMAIN" \
    "CERT_NAME=$TEEBRAVO_CERT_NAME" \
    "STOREFRONT_PORT=$TEEBRAVO_STOREFRONT_PORT" \
    "API_PORT=$TEEBRAVO_API_PORT" \
    "SHARED_DIR=$TEEBRAVO_SHARED_DIR"
}
health() {
  local url=$1
  for attempt in {1..30}; do
    if curl --fail --silent --output /dev/null --max-time 5 "$url"; then return 0; fi
    sleep 2
  done
  return 1
}
# Hash file bytes + relative names, ignoring mtimes; secrets are never printed.
fingerprint() {
  python3 - "$@" <<'PY'
import hashlib, os, pathlib, sys
h = hashlib.sha256()
ignored = {'.git', '.next', 'node_modules', 'vendor', '.venv', '__pycache__', '.cache', '.ruff_cache'}
for argument in sys.argv[1:]:
    root = pathlib.Path(argument)
    if not root.exists():
        raise SystemExit(f'Missing input: {root}')
    files = []
    if root.is_dir():
        for directory, dirs, names in os.walk(root):
            dirs[:] = sorted(d for d in dirs if d not in ignored)
            files.extend(pathlib.Path(directory) / name for name in sorted(names))
    else:
        files = [root]
    for p in files:
        if any(part in ignored for part in p.parts) or p.name == 'next-env.d.ts' or p.suffix == '.tsbuildinfo':
            continue
        h.update(str(p).encode())
        with p.open('rb') as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b''):
                h.update(chunk)
print(h.hexdigest())
PY
}
changed() { [[ $force == 1 || ! -f "$1" || $(cat "$1") != "$2" ]]; }
dc() { docker compose --env-file "$DEPLOY_CONFIG" --project-name "$TEEBRAVO_COMPOSE_PROJECT" --file "$REPO/deploy/compose.production.yaml" "$@"; }
check_disk() {
  python3 - "$1" "${MIN_FREE_GB:-20}" <<'PYDISK'
import shutil, sys
free = shutil.disk_usage(sys.argv[1]).free / (1024 ** 3)
minimum = float(sys.argv[2])
if free < minimum:
    raise SystemExit('Not enough free disk at %s: %.1f GiB available; require %.1f GiB. No automatic cleanup.' % (sys.argv[1], free, minimum))
print('Disk available: %.1f GiB at %s' % (free, sys.argv[1]))
PYDISK
}
install_nginx() {
  local source=$1 target=$2 backup rendered
  backup=$(mktemp)
  rendered=$(mktemp)
  render_template "$source" "$rendered"
  if [[ -f "$target" ]]; then cp "$target" "$backup"; fi
  install -m 644 "$rendered" "$target"
  if ! nginx -t; then
    if [[ -s "$backup" ]]; then cp "$backup" "$target"; else rm -f "$target"; fi
    rm -f "$backup" "$rendered"
    fail 'Nginx test failed; restored this config. Check other vhosts for conflicts.'
  fi
  rm -f "$backup" "$rendered"
  systemctl reload nginx
}
port_in_use() {
  ss -H -ltn | awk '{print $4}' | grep -Eq "(^|:)${1}$"
}
check_port() {
  local port=$1 owner=$2
  if ! port_in_use "$port"; then return 0; fi
  if [[ "$owner" == storefront ]] && systemctl is-active --quiet teebravo-storefront 2>/dev/null; then return 0; fi
  if [[ "$owner" == api ]] && dc ps --status running -q api 2>/dev/null | grep -q .; then return 0; fi
  fail "Port $port is already in use; refusing to deploy TeeBravo $owner. Inspect with: ss -ltnp | grep :$port"
}
check_ports() {
  need ss
  check_port "$TEEBRAVO_STOREFRONT_PORT" storefront
  check_port "$TEEBRAVO_API_PORT" api
}
sync_docker_config() {
  [[ -s /etc/teebravo/api.env && -s /etc/teebravo/admin.env ]] || fail 'Missing backend env files; run --setup first.'
  if [[ "$TEEBRAVO_DOCKER_CONFIG_DIR" != /etc/teebravo ]]; then
    install -d -m 755 "$TEEBRAVO_DOCKER_CONFIG_DIR"
    install -m 640 -o root -g 33 /etc/teebravo/api.env "$TEEBRAVO_DOCKER_CONFIG_DIR/api.env"
    install -m 640 -o root -g 33 /etc/teebravo/admin.env "$TEEBRAVO_DOCKER_CONFIG_DIR/admin.env"
  fi
}
setup_host() {
  for tool in nginx rsync python3 node bun docker curl flock runuser ss chown; do need "$tool"; done
  docker compose version >/dev/null
  id "$APP_USER" >/dev/null 2>&1 || fail 'Create user teebravo and ownership as documented first.'
  install -d -m 755 -o "$APP_USER" -g "$APP_USER" "$BASE/build" "$BASE/releases" "$BASE/state"
  install -d -m 750 -o root -g "$APP_USER" /etc/teebravo
  python3 deploy/init-env.py /etc/teebravo
  load_config
  sync_docker_config
  # UID/GID 33 is www-data in the Debian containers. Only new TeeBravo data paths.
  install -d -m 755 -o 33 -g 33 "$TEEBRAVO_SHARED_DIR/assets" "$TEEBRAVO_SHARED_DIR/mockup-cache" "$TEEBRAVO_SHARED_DIR/admin-storage" "$TEEBRAVO_SHARED_DIR/php"
  install -d -m 755 -o root -g root "$TEEBRAVO_SHARED_DIR/admin-public" /var/www/letsencrypt
  install -d -m 755 -o "$APP_USER" -g "$APP_USER" "$TEEBRAVO_SHARED_DIR/next-static"
  check_ports
  render_template deploy/systemd/teebravo-storefront.service "$BASE/teebravo-storefront.service.rendered"
  install -m 644 "$BASE/teebravo-storefront.service.rendered" /etc/systemd/system/teebravo-storefront.service
  rm -f "$BASE/teebravo-storefront.service.rendered"
  chown root:"$APP_USER" /etc/teebravo/storefront.env
  chmod 640 /etc/teebravo/storefront.env
  chown root:33 /etc/teebravo/api.env /etc/teebravo/admin.env
  chmod 640 /etc/teebravo/api.env /etc/teebravo/admin.env
  chown root:"$APP_USER" "$DEPLOY_CONFIG"
  chmod 640 "$DEPLOY_CONFIG"
  systemctl daemon-reload
  systemctl enable teebravo-storefront
  # Never replace working HTTPS with a bootstrap vhost on a repeated setup.
  if [[ ! -f /etc/nginx/conf.d/teebravo.conf ]]; then
    install_nginx deploy/nginx/bootstrap.conf /etc/nginx/conf.d/teebravo.conf
  fi
  echo 'Setup complete. Review /etc/teebravo/*.env, sync assets, then run --production EMAIL or --all.'
}
if ((setup)); then
  setup_host
  if (( !production )); then exit 0; fi
fi
install_tls() {
  need certbot
  [[ -f /etc/nginx/conf.d/teebravo.conf ]] || fail 'Run --setup first.'
  certbot certonly --webroot -w /var/www/letsencrypt --cert-name "$TEEBRAVO_CERT_NAME" \
    -d "$TEEBRAVO_PUBLIC_DOMAIN" -d "$TEEBRAVO_ADMIN_DOMAIN" -d "$TEEBRAVO_API_DOMAIN" \
    --email "$email" --agree-tos --non-interactive --keep-until-expiring
  install_nginx deploy/nginx/teebravo.conf /etc/nginx/conf.d/teebravo.conf
  install -d /etc/letsencrypt/renewal-hooks/deploy
  install -m 755 deploy/renew-nginx.sh /etc/letsencrypt/renewal-hooks/deploy/teebravo-nginx
  systemctl enable --now certbot.timer
  echo 'HTTPS installed. Verify certbot renew --dry-run and Cloudflare Full (strict).'
}
if ((tls && !production)); then
  load_config
  install_tls
  exit 0
fi
[[ -d "$BASE/state" ]] || fail 'Run --setup first.'
load_config
sync_docker_config
check_ports
need python3
need rsync
need curl
check_disk "$BASE"
if ((api || admin || db)); then
  need docker
  docker compose version >/dev/null
  docker_root=$(docker info --format '{{.DockerRootDir}}')
  check_disk "$docker_root"
  check_disk "$TEEBRAVO_SHARED_DIR"
  for name in db api admin; do [[ -s "/etc/teebravo/$name.env" ]] || fail "Missing $name.env; run --setup."; done
fi
if ((db)); then
  # Explicit --db/--all only. Never recreate an existing DB for a routine deploy.
  dc up -d --no-recreate --wait --wait-timeout 180 db
fi
if ((api || admin)); then
  [[ -n $(dc ps --status running -q db) ]] || fail 'TeeBravo DB not running; initialize with --all or --db.'
fi
if ((api)); then
  hash=$(fingerprint api/app api/pyproject.toml api/mysql/init api/bootstrap-db.sh deploy/docker deploy/compose.production.yaml /etc/teebravo/api.env)
  if changed "$BASE/state/api" "$hash" || [[ -z $(dc ps --status running -q api) ]]; then
    check_disk "$docker_root"
    dc build api
    # Build completes while current API is serving. Schema changes need maintenance planning.
    dc run --rm --no-deps --entrypoint bash api bootstrap-db.sh
    dc up -d --no-deps --wait --wait-timeout 150 api
    health "http://127.0.0.1:$TEEBRAVO_API_PORT/ready" || fail 'API unhealthy; inspect docker compose logs.'
    echo "$hash" > "$BASE/state/api"
  else echo 'API unchanged; skipped.'; fi
fi
if ((admin)); then
  hash=$(fingerprint admin/app admin/bootstrap/app.php admin/bootstrap/providers.php admin/config admin/routes admin/resources admin/database admin/composer.json admin/composer.lock admin/package.json admin/package-lock.json admin/vite.config.ts api/app api/pyproject.toml api/mysql/init api/bootstrap-db.sh deploy/docker deploy/compose.production.yaml /etc/teebravo/admin.env /etc/teebravo/api.env)
  if changed "$BASE/state/admin" "$hash" || [[ -z $(dc ps --status running -q admin) ]]; then
    check_disk "$docker_root"
    dc build admin
    dc run --rm --no-deps admin php artisan migrate --force
    dc up -d --no-deps --wait --wait-timeout 90 admin
    # Copy from this exact image; host Nginx serves only the public directory.
    cid=$(dc ps -q admin)
    [[ -n "$cid" ]] || fail 'Admin container failed to start.'
    dc exec -T admin php artisan about --only=environment >/dev/null
    docker cp "$cid:/app/admin/public/." "$TEEBRAVO_SHARED_DIR/admin-public/"
    chmod -R a+rX "$TEEBRAVO_SHARED_DIR/admin-public"
    [[ -S "$TEEBRAVO_SHARED_DIR/php/fpm.sock" ]] || fail 'Admin FPM socket missing. Inspect container logs, retry --only-admin --force.'
    echo "$hash" > "$BASE/state/admin"
    echo 'Admin deployed. Test /up over HTTPS once SSL is installed.'
  else echo 'Admin unchanged; skipped.'; fi
fi
if ((storefront)); then
  need node
  need bun
  need chown
  node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22 || (a===22 && b<12))process.exit(1)'
  [[ -f /etc/teebravo/storefront.env ]] || fail 'Missing /etc/teebravo/storefront.env.'
  health "http://127.0.0.1:$TEEBRAVO_API_PORT/ready" || fail 'API must be ready before building storefront.'
  # Persistent staging retains node_modules and .next/cache. Never build in current release.
  run rsync -a --delete --exclude='/.git/' --exclude='/.next/' --exclude='/node_modules/' \
    --exclude='/admin/' --exclude='/api/' --exclude='/deploy/' --exclude='/docs/' --exclude='/plans/' \
    --exclude='/.agents/' --exclude='/.codex/' --exclude='/.claude/' --exclude='/.cache/' \
    --exclude='/.env*' --exclude='/deploy.sh' "$REPO/" "$BASE/build/"
  hash=$(cd "$BASE/build"; fingerprint . /etc/teebravo/storefront.env)
  if ! changed "$BASE/state/storefront" "$hash" && systemctl is-active --quiet teebravo-storefront; then
    echo 'Storefront unchanged; skipped (use --force to rebuild).'
  else
    deps=$(cd "$BASE/build"; fingerprint package.json bun.lock)
    if changed "$BASE/state/storefront-deps" "$deps" || [[ ! -d "$BASE/build/node_modules" ]]; then
      (cd "$BASE/build"; run env HUSKY=0 bun install --frozen-lockfile)
      echo "$deps" > "$BASE/state/storefront-deps"
    fi
    release="$BASE/releases/$(date -u +%Y%m%dT%H%M%SZ)-${hash:0:12}-$RANDOM"
    check_disk "$BASE"
    # env file must be shell-compatible KEY=value; quotes supported, no shell commands.
    (cd "$BASE/build"; run bash -c 'set -a; source /etc/teebravo/storefront.env; set +a; export NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NEXT_DEPLOYMENT_ID="$1"; export NODE_OPTIONS="--max-old-space-size=${BUILD_HEAP_MB:-2048}"; exec nice -n 10 node node_modules/next/dist/bin/next build' bash "${release##*/}")
    [[ -f "$BASE/build/.next/standalone/server.js" ]] || fail 'standalone/server.js missing.'
    install -d -o "$APP_USER" -g "$APP_USER" "$release" "$release/.next"
    chown -R "$APP_USER:$APP_USER" "$release"
    run rsync -a --no-owner --no-group "$BASE/build/.next/standalone/" "$release/"
    run rsync -a --no-owner --no-group "$BASE/build/public/" "$release/public/"
    run rsync -a --no-owner --no-group "$BASE/build/.next/static/" "$release/.next/static/"
    # Hashed static chunks from older releases remain available to already-open tabs.
    run rsync -a --no-owner --no-group "$BASE/build/.next/static/" "$TEEBRAVO_SHARED_DIR/next-static/"
    old=$(readlink -f "$BASE/current" 2>/dev/null || true)
    [[ -d "$old" && "$old" != "$BASE/current" ]] || old=''
    ln -s "$release" "$BASE/current.new"
    mv -Tf "$BASE/current.new" "$BASE/current"
    if ! systemctl restart teebravo-storefront || ! health "http://127.0.0.1:$TEEBRAVO_STOREFRONT_PORT/"; then
      if [[ -n "$old" && -d "$old" ]]; then
        ln -s "$old" "$BASE/current.rollback"
        mv -Tf "$BASE/current.rollback" "$BASE/current"
        systemctl restart teebravo-storefront
        health "http://127.0.0.1:$TEEBRAVO_STOREFRONT_PORT/" || fail 'New release and rollback failed; inspect service logs.'
        fail 'New storefront failed health check; previous release restored.'
      fi
      systemctl stop teebravo-storefront
      fail 'First storefront release failed health check; inspect service logs.'
    fi
    echo "$hash" > "$BASE/state/storefront"
    echo "Storefront deployed: $release"
  fi
fi
if ((production)); then
  load_config
  install_tls
fi
echo 'Done. Smoke-test domains, product images, cart, admin login and Stripe webhook.'
