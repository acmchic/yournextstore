#!/bin/sh
set -eu
mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs storage/app/public
chown -R www-data:www-data storage bootstrap/cache
php artisan config:cache
php artisan view:cache
if [ ! -L public/storage ]; then php artisan storage:link; fi
exec "$@"
