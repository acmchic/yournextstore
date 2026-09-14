#!/usr/bin/env bash
# Host Node/systemd + isolated Docker backends. Fixed layout: /srv/teebravo/repository (this checkout).
set -Eeuo pipefail
umask 022
BASE=/srv/teebravo
REPO="$BASE/repository"
APP_USER=teebravo
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
storefront=1 admin=0 api=0 db=0 setup=0 tls=0 force=0 email=''
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
    --ssl) tls=1; shift; email="${1:-}"; [[ -n "$email" ]] || { usage; exit 2; } ;;
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
((setup + tls <= 1)) || fail 'Run --setup and --ssl separately.'
exec 9>/run/lock/teebravo-deploy.lock
flock -n 9 || fail 'Another deploy is running.'
need() { command -v "$1" >/dev/null || fail "Missing executable: $1"; }
run() { runuser -u "$APP_USER" -- "$@"; }
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
dc() { docker compose --project-name teebravo-prod --file "$REPO/deploy/compose.production.yaml" "$@"; }
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
  local source=$1 target=$2 backup
  backup=$(mktemp)
  if [[ -f "$target" ]]; then cp "$target" "$backup"; fi
  install -m 644 "$source" "$target"
  if ! nginx -t; then
    if [[ -s "$backup" ]]; then cp "$backup" "$target"; else rm -f "$target"; fi
    rm -f "$backup"
    fail 'Nginx test failed; restored this config. Check other vhosts for conflicts.'
  fi
  rm -f "$backup"
  systemctl reload nginx
}
if ((setup)); then
  for tool in nginx rsync python3 node bun docker curl flock runuser; do need "$tool"; done
  docker compose version >/dev/null
  id "$APP_USER" >/dev/null 2>&1 || fail 'Create user teebravo and ownership as documented first.'
  install -d -m 755 -o "$APP_USER" -g "$APP_USER" "$BASE/build" "$BASE/releases" "$BASE/shared" "$BASE/shared/next-static" "$BASE/state"
  # UID/GID 33 is www-data in the Debian containers. Only new TeeBravo data paths.
  install -d -m 755 -o 33 -g 33 "$BASE/shared/assets" "$BASE/shared/mockup-cache" "$BASE/shared/admin-storage" "$BASE/shared/php"
  install -d -m 755 "$BASE/shared/admin-public" /var/www/letsencrypt
  install -d -m 750 -o root -g "$APP_USER" /etc/teebravo
  python3 deploy/init-env.py /etc/teebravo
  chown root:"$APP_USER" /etc/teebravo/storefront.env
  chmod 640 /etc/teebravo/storefront.env
  chown root:33 /etc/teebravo/api.env /etc/teebravo/admin.env
  chmod 640 /etc/teebravo/api.env /etc/teebravo/admin.env
  install -m 644 deploy/systemd/teebravo-storefront.service /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable teebravo-storefront
  # Never replace working HTTPS with a bootstrap vhost on a repeated setup.
  if [[ ! -f /etc/nginx/conf.d/teebravo.conf ]]; then
    install_nginx deploy/nginx/bootstrap.conf /etc/nginx/conf.d/teebravo.conf
  fi
  echo 'Setup complete. Review /etc/teebravo env, sync assets, deploy --all, then --ssl EMAIL.'
  exit 0
fi
if ((tls)); then
  need certbot
  [[ -f /etc/nginx/conf.d/teebravo.conf ]] || fail 'Run --setup first.'
  certbot certonly --webroot -w /var/www/letsencrypt --cert-name teebravo.com \
    -d teebravo.com -d admin.teebravo.com -d api.teebravo.com \
    --email "$email" --agree-tos --non-interactive --keep-until-expiring
  install_nginx deploy/nginx/teebravo.conf /etc/nginx/conf.d/teebravo.conf
  install -d /etc/letsencrypt/renewal-hooks/deploy
  install -m 755 deploy/renew-nginx.sh /etc/letsencrypt/renewal-hooks/deploy/teebravo-nginx
  systemctl enable --now certbot.timer
  echo 'HTTPS installed. Verify certbot renew --dry-run and Cloudflare Full (strict).'
  exit 0
fi
[[ -d "$BASE/state" ]] || fail 'Run --setup first.'
need python3
need rsync
need curl
check_disk "$BASE"
if ((api || admin || db)); then
  need docker
  docker compose version >/dev/null
  docker_root=$(docker info --format '{{.DockerRootDir}}')
  check_disk "$docker_root"
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
    health http://127.0.0.1:1991/ready || fail 'API unhealthy; inspect docker compose logs.'
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
    docker cp "$cid:/app/admin/public/." "$BASE/shared/admin-public/"
    chmod -R a+rX "$BASE/shared/admin-public"
    [[ -S "$BASE/shared/php/fpm.sock" ]] || fail 'Admin FPM socket missing. Inspect container logs, retry --only-admin --force.'
    echo "$hash" > "$BASE/state/admin"
    echo 'Admin deployed. Test /up over HTTPS once SSL is installed.'
  else echo 'Admin unchanged; skipped.'; fi
fi
if ((storefront)); then
  need node
  need bun
  node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22 || (a===22 && b<12))process.exit(1)'
  [[ -f /etc/teebravo/storefront.env ]] || fail 'Missing /etc/teebravo/storefront.env.'
  health http://127.0.0.1:1991/ready || fail 'API must be ready before building storefront.'
  # Persistent staging retains node_modules and .next/cache. Never build in current release.
  run rsync -a --delete --exclude='/.git/' --exclude='/.next/' --exclude='/node_modules/' \
    --exclude='/admin/' --exclude='/api/' --exclude='/deploy/' --exclude='/docs/' --exclude='/plans/' \
    --exclude='/.agents/' --exclude='/.codex/' --exclude='/.claude/' --exclude='/.cache/' \
    --exclude='/.env*' --exclude='/deploy.sh' "$REPO/" "$BASE/build/"
  hash=$(cd "$BASE/build"; fingerprint . /etc/teebravo/storefront.env)
  if ! changed "$BASE/state/storefront" "$hash" && systemctl is-active --quiet teebravo-storefront; then
    echo 'Storefront unchanged; skipped (use --force to rebuild).'; exit 0
  fi
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
  install -d -o "$APP_USER" -g "$APP_USER" "$release/.next"
  run rsync -a "$BASE/build/.next/standalone/" "$release/"
  run rsync -a "$BASE/build/public/" "$release/public/"
  run rsync -a "$BASE/build/.next/static/" "$release/.next/static/"
  # Hashed static chunks from older releases remain available to already-open tabs.
  run rsync -a "$BASE/build/.next/static/" "$BASE/shared/next-static/"
  old=$(readlink -f "$BASE/current" || true)
  ln -s "$release" "$BASE/current.new"
  mv -Tf "$BASE/current.new" "$BASE/current"
  if ! systemctl restart teebravo-storefront || ! health http://127.0.0.1:1990/; then
    if [[ -n "$old" && -d "$old" ]]; then
      ln -s "$old" "$BASE/current.rollback"
      mv -Tf "$BASE/current.rollback" "$BASE/current"
      systemctl restart teebravo-storefront
      health http://127.0.0.1:1990/ || fail 'New release and rollback failed; inspect service logs.'
      fail 'New storefront failed health check; previous release restored.'
    fi
    systemctl stop teebravo-storefront
    fail 'First storefront release failed health check; inspect service logs.'
  fi
  echo "$hash" > "$BASE/state/storefront"
  echo "Storefront deployed: $release"
fi
echo 'Done. Smoke-test domains, product images, cart, admin login and Stripe webhook.'
