# syntax=docker/dockerfile:1
FROM php:8.4-fpm-bookworm AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv default-mysql-client libcairo2 libglib2.0-0 libgomp1 \
    libicu-dev libzip-dev libonig-dev unzip git ca-certificates \
    && docker-php-ext-install -j2 pdo_mysql mbstring intl zip bcmath opcache \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/api
RUN python3 -m venv .venv
COPY api/pyproject.toml /tmp/pyproject.toml
RUN python3 -c 'import tomllib; print("\n".join(tomllib.load(open("/tmp/pyproject.toml", "rb"))["project"]["dependencies"]))' > /tmp/requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip .venv/bin/pip install -r /tmp/requirements.txt
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1
COPY api/app ./app
COPY api/mysql ./mysql
COPY api/bootstrap-db.sh ./bootstrap-db.sh
COPY api/policies.teebravo.json ./policies.teebravo.json

FROM runtime AS api
USER www-data
CMD ["/app/api/.venv/bin/python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--limit-concurrency", "32"]

FROM runtime AS admin-build
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm
WORKDIR /app/admin
COPY admin/composer.json admin/composer.lock ./
RUN --mount=type=cache,target=/root/.composer/cache COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --prefer-dist --no-interaction --no-scripts --no-autoloader
COPY admin/package.json admin/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev --no-audit --no-fund
COPY admin/ ./
RUN mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && COMPOSER_ALLOW_SUPERUSER=1 composer dump-autoload --no-dev --optimize \
    && composer check-platform-reqs --no-dev \
    && NODE_OPTIONS=--max-old-space-size=1536 npm run build \
    && rm -f public/hot && rm -rf node_modules

FROM runtime AS admin
WORKDIR /app/admin
COPY --from=admin-build /app/admin /app/admin
RUN rm -rf node_modules && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs \
    && chown -R www-data:www-data storage bootstrap/cache
COPY deploy/docker/php-pool.conf /usr/local/etc/php-fpm.d/zz-teebravo.conf
COPY deploy/docker/php.ini /usr/local/etc/php/conf.d/zz-teebravo.ini
COPY deploy/docker/admin-entrypoint.sh /usr/local/bin/teebravo-admin
ENTRYPOINT ["sh", "/usr/local/bin/teebravo-admin"]
CMD ["php-fpm", "-F"]
