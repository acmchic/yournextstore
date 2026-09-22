# TeeBravo production trên VPS vmi2327956

## Phương án đã chọn theo thông tin máy thật

Host: Ubuntu 20.04.6, PHP 7.4/8.1 đang phục vụ domain cũ, Node 22.21.1, Python 3.8, MariaDB client 10.3, Docker 29.6.1 + Compose v5.3.1. Máy có 6 CPU, 15 GiB RAM (9 GiB available), swap 8 GiB; filesystem `/` dùng 95%, còn khoảng 30 GB tại thời điểm kiểm tra. Port 1990/1991 trống. Phiên bản `mysql --version` là client, chưa xác minh version server MariaDB thực tế.

**Giữ PHP, Python, MariaDB và các vhost hiện tại trên host.** Không nâng Ubuntu/PHP host, không thêm PPA, không restart Docker daemon hay FPM của site cũ. Bộ deploy mới thay thế phương án cài PHP 8.4 trực tiếp trước đó.

| Thành phần | Runtime | Kết nối |
|---|---|---|
| Storefront root | Node host, Next.js standalone, systemd `teebravo-storefront` | `127.0.0.1:1990` |
| `api/` | Container `api`, Python 3.11/venv trên Debian Bookworm | host `127.0.0.1:1991` → container 8000 |
| `admin/` | Container `admin`, PHP 8.4-FPM + Python 3.11 cho importer | Unix socket riêng qua bind mount |
| Database | Container MySQL 8.4, database `pod_store` | `db:3306` trong mạng Compose, không publish port |
| Public HTTPS | Nginx và Certbot hiện tại trên host | 3 vhost: teebravo.com, admin.teebravo.com, api.teebravo.com |

Compose project luôn là `teebravo-prod`, với network/volume riêng, không dùng Compose dev ở root. Cả ba phần TeeBravo dùng chung dữ liệu MySQL này: Laravel/API kết nối trực tiếp; Next.js qua API. Không chuyển dữ liệu hay nâng cấp database của các website khác.

```text
Cloudflare → Nginx :443 + Certbot
              ├─ teebravo.com → Node host 127.0.0.1:1990
              ├─ api.teebravo.com → 127.0.0.1:1991 → container api:8000
              └─ admin.teebravo.com → Unix socket → container PHP-FPM

Node → HTTP loopback API → db:3306
PHP-FPM → db:3306
PHP-FPM → Python CLI cùng image → db:3306 và thư mục assets/cache chung
```

Host Nginx trỏ socket `/srv/teebravo/shared/php/fpm.sock`; trong container cùng socket là `/run/teebravo-php/fpm.sock`. Nginx đọc assets admin từ `/srv/teebravo/shared/admin-public`, nhưng `SCRIPT_FILENAME` gửi FPM là `/app/admin/public/index.php`. Không dùng socket PHP 7.4/8.1 của host.

## 1. Kiểm tra dung lượng trước

Các lệnh chỉ đọc trên VPS:

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
docker system df
docker info --format '{{.DockerRootDir}}'
df -h / /var/lib/docker
sudo du -xhd1 /var /srv /root 2>/dev/null
sudo ss -ltnp '( sport = :1990 or sport = :1991 )'
```

Nếu DockerRootDir khác `/var/lib/docker`, kiểm tra `df` trên đường dẫn thực. `du` có thể tạo I/O, chạy lúc ít tải. Với 30 GB trống chưa thể kết luận đủ cho DB/assets + image/build cache. Nên tạo thêm khoảng trống tới 50–60 GB trước lần đầu nếu có thể; đây là dự phòng vận hành, không phải dung lượng bắt buộc đo được của ứng dụng. Xác định thư mục nào chiếm chỗ trước khi dọn. Không chạy `docker system prune -a`, `docker volume prune`, `compose down -v`, hoặc xóa log/container của ứng dụng khác.

Script dừng nếu chỗ trống tại `/srv/teebravo` hoặc DockerRootDir dưới **20 GiB**. Kiểm tra lại trước mỗi build lớn. Có thể tăng ngưỡng qua `sudo env MIN_FREE_GB=30 bash deploy.sh --all`. Ngưỡng là kiểm tra trước build, không giữ chỗ hay đảm bảo đủ trong toàn bộ quá trình. Script không xóa tự động image/cache/data.

## 2. Chuẩn bị một lần

Cần host có `/usr/bin/node`, Bun trong `/usr/local/bin` hoặc `/usr/bin`, rsync, Python 3.8+ (chỉ chạy helper), curl, flock/runuser, Nginx, Certbot với timer. Docker/Compose đã có; không cần cài Composer, PHP 8.4, Python mới hoặc MySQL trên host.

```bash
command -v node bun rsync curl python3 docker certbot
/usr/bin/node -v
bun --version
systemctl status certbot.timer --no-pager
```

Bun chỉ cài dependency theo `bun.lock`; chạy Next bằng Node. Nếu Bun chưa có, cài riêng Bun có hỗ trợ lockfile hiện tại, đặt binary trong PATH nêu trên. Repo đang dùng Next.js/React canary; không đổi version tự động trong deploy.

Tạo user/clone (thay URL Git thật; bỏ bước nếu user/repo đã tồn tại):

```bash
sudo useradd --create-home --shell /bin/bash teebravo
sudo install -d -m 755 -o teebravo -g teebravo /srv/teebravo
sudo -u teebravo git clone YOUR_REPOSITORY_URL /srv/teebravo/repository
cd /srv/teebravo/repository
sudo bash deploy.sh --setup
```

Setup chỉ chuẩn bị thư mục, tạo env nếu chưa có, cài **một unit Node** và HTTP ACME vhost nếu chưa có vhost TeeBravo. Mapping production dùng `deploy/env/deploy.env.example` làm nguồn duy nhất cho `teebravo.com`, `admin.teebravo.com`, `api.teebravo.com`, port 1990/1991 và Compose project. Không build/start backend, không sửa PHP host, không restart Docker. Xử lý vhost cũ trùng tên TeeBravo trước (các hostname được kiểm tra chưa có trong output bạn gửi).

Nếu Docker daemon là bản Snap, thêm `TEEBRAVO_SHARED_DIR=/home/teebravo/shared` vào `/etc/teebravo/deploy.env` trước khi chạy `--all`. Docker Snap có thể đọc build context ở `/srv` nhưng không bind-mount được source dưới `/srv`; repo/build vẫn giữ ở `/srv/teebravo`, chỉ dữ liệu bind-mount chuyển sang thư mục trong home.
Đồng thời đặt `TEEBRAVO_DOCKER_CONFIG_DIR=/home/teebravo/config`; script sẽ đồng bộ `api.env` và `admin.env` vào đó để Docker daemon đọc được file secrets.

Nếu muốn setup, deploy toàn bộ và cài HTTPS trong một lần sau khi DNS đã trỏ đúng, dùng:

```bash
sudo bash deploy.sh --production YOUR_REAL_EMAIL
```

Lệnh này vẫn giữ các env/secret đã có, chỉ sinh file còn thiếu và không ghi đè database hoặc env production hiện tại.

### Secrets và env

Setup tự sinh password DB/root, Laravel APP_KEY, signing secret và Server Actions key một lần. Không in secret ra terminal. File:

- `/etc/teebravo/db.env`: MySQL container, không dùng MariaDB host.
- `/etc/teebravo/api.env`: API và Python CLI trong admin; `DB_HOST=db`.
- `/etc/teebravo/admin.env`: Laravel, cùng DB/password với API.
- `/etc/teebravo/storefront.env`: API loopback và public media URL được render từ `/etc/teebravo/deploy.env`.
- `/etc/teebravo/deploy.env`: domain/port/project mapping được sinh từ `deploy/env/deploy.env.example`; không chứa secret.
- `TEEBRAVO_SHARED_DIR` trong file trên: root persistent cho các bind mount Docker và các file Nginx đọc; mặc định `/srv/teebravo/shared`, dùng `/home/teebravo/shared` với Docker Snap.
- `TEEBRAVO_DOCKER_CONFIG_DIR` trong file trên: thư mục chứa bản sao `api.env` và `admin.env` dành cho Docker bind mount; mặc định `/etc/teebravo`, dùng `/home/teebravo/config` với Docker Snap.

Script không ghi đè file đã tồn tại; nếu bộ backend env chỉ có một phần thì dừng để tránh sinh password lệch. Nếu chuyển từ env native cũ: kiểm tra lại DB_HOST=db, asset/cache paths `/app/api/...`, URL loopback 1991 và bỏ tất cả placeholder. Không copy đè key/password lên database đã khởi tạo. MySQL image chỉ áp dụng MYSQL_PASSWORD khi tạo datadir mới; đổi env không tự đổi password trong DB.

`db.env` chỉ root đọc; API/admin env cấp group 33 (www-data trong container) quyền đọc; storefront env cấp group teebravo. Không commit env thật. Cấu hình Stripe keys/webhook và SMTP thật trước khi sử dụng; mail mẫu ghi log. Admin đã tắt Inertia SSR để không cần thêm Node daemon.

### Dữ liệu và ảnh

Thư mục persistent:

```text
${TEEBRAVO_SHARED_DIR}/assets        → /app/api/public (design, mockup…)
${TEEBRAVO_SHARED_DIR}/mockup-cache  → cache render
${TEEBRAVO_SHARED_DIR}/admin-storage → Laravel storage
${TEEBRAVO_SHARED_DIR}/php           → FPM socket
${TEEBRAVO_SHARED_DIR}/admin-public  → assets public trích từ image admin
${TEEBRAVO_SHARED_DIR}/next-static   → chunks Next hiện tại và cũ
```

Đồng bộ assets vào `shared/assets`, không đóng hàng GB ảnh trong image Docker. Nếu repo trên VPS đã có đầy đủ `api/public`, dùng:

```bash
set -a; . /etc/teebravo/deploy.env; set +a
sudo rsync -a api/public/ "${TEEBRAVO_SHARED_DIR}/assets/"
sudo chown -R 33:33 "${TEEBRAVO_SHARED_DIR}/assets"
```

Chỉ chown thư mục TeeBravo này; `api/public/mockup` bị Git ignore nên cần chuyển riêng từ máy đang có ảnh. Dùng rsync không `--delete` để tránh xóa ảnh đã import. Mọi ảnh/assets mới vẫn chiếm dung lượng ổ host; kiểm tra trước.

Ba SQL nền `001_schema.sql`, `002_seed_catalog.sql`, `004_catalog_color_sort_order.sql` phải có trong commit. API bootstrap áp dụng SQL theo ledger; trên DB trống có seed catalog mẫu sẵn có, cần rà trước launch. Admin migrations tạo bảng admin/CMS trên cùng DB. Không chạy `migrate:fresh`.

Nếu chuyển một DB TeeBravo đang có dữ liệu: khởi tạo MySQL riêng, restore bản backup đã kiểm tra trước migrations (xem mục backup bên dưới); không trỏ bộ script vào MariaDB của domain khác. Không có migrate tự động từ MariaDB 10.3 sang MySQL 8.4 trong script.

## 3. Lần deploy đầu

1. DNS A `@`, `admin`, `api` về VPS, DNS-only ban đầu. Chỉ thêm AAAA khi đã cấu hình IPv6; vhost mẫu listen IPv4.
2. Setup/env/assets/disk như trên.
3. Chạy tuần tự:

```bash
cd /srv/teebravo/repository
sudo bash deploy.sh --all
sudo bash deploy.sh --ssl YOUR_REAL_EMAIL
sudo certbot renew --dry-run
```

Hoặc thay ba bước trên bằng `sudo bash deploy.sh --production YOUR_REAL_EMAIL`.

`--all`: ensure MySQL khỏe → build API → bootstrap SQL → start API → build admin → migrate → start PHP → copy public assets → build/restart Node. Build backend xong mới thay container đang chạy. `--production` chạy cùng chuỗi sau khi setup host, kiểm tra port mapping, rồi cài cert/vhost HTTPS ở cuối. `--wait` kết hợp healthcheck kiểm tra API/DB; health admin chỉ kiểm tra socket, cần test `/up`/login sau HTTPS. [Compose startup/readiness](https://docs.docker.com/compose/how-tos/startup-order/).

Build đầu cần Internet để kéo image/package/font. Docker BuildKit giữ layer/cache; PHP/Python runtime chung giúp hai image chia sẻ lớp dependency. Runtime giới hạn tổng xấp xỉ 4 GiB cho ba backend container và 4 CPU quota cộng dồn; frontend riêng. **Giới hạn runtime Compose không giới hạn Docker build**: build tuần tự/lúc ít tải, quan sát RAM/CPU/disk. Build Next heap 2 GiB, nice=10. Không cam kết hoàn toàn không ảnh hưởng latency các site khác vì dùng chung VPS.

Certbot vẫn chạy host, webroot `/var/www/letsencrypt`, một SAN cert cho 3 domain. Chỉ cài vhost HTTPS sau khi có cert, chạy `nginx -t` rồi reload. Không restart Nginx. Nếu dùng timer Certbot Snap thì chỉnh timer tương ứng trước khi chạy `--ssl`. [Certbot](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot).

## 4. Các lần deploy sau

```bash
cd /srv/teebravo/repository
sudo -u teebravo git pull --ff-only
sudo bash deploy.sh                 # chỉ Next, không cập nhật backend container
sudo bash deploy.sh --api           # API + Next
sudo bash deploy.sh --admin         # admin + Next
sudo bash deploy.sh --only-api      # chỉ API
sudo bash deploy.sh --only-admin    # chỉ admin
sudo bash deploy.sh --all           # cả ba, ensure DB chạy
sudo bash deploy.sh --force         # bắt buộc build Next
```

Danh sách lựa chọn thay thế, không chạy tất cả. `--db` là opt-in ensure MySQL chạy, không force recreate database có sẵn. `--all` cũng dùng `--no-recreate` cho DB; routine deploy không nâng image MySQL hay thay volume. Thay đổi image/config database cần kế hoạch backup/maintenance riêng.

Nếu sửa importer/API CLI cần dùng trong admin, deploy `--all` hoặc cả API + admin; mỗi image giữ snapshot code của nó. Thay đổi PHP/Python deps cần build service tương ứng. Image base tags chưa pin digest; không tự `--pull` mỗi deploy. Lưu digest/pip freeze của image đã kiểm thử trước khi cần tái tạo chính xác; không có Python lockfile hiện tại.

Next giữ staging `.next/cache`/node_modules; hash input/env để skip build nếu không đổi. Runtime standalone ở release riêng, đổi symlink sau build, restart Node vài giây. Nếu build lỗi giữ bản cũ; nếu restart/HTTP `/` thất bại tự rollback release cũ. ISR cache riêng từng release; static chunks cũ giữ cho tab đang mở. Code rollback không rollback DB, không đảm bảo mọi Server Action cũ tương thích. API/admin có gián đoạn ngắn khi recreate, migrations có thể ảnh hưởng bản cũ đang chạy nên vẫn cần maintenance với schema không tương thích. Chưa có rollback tự động backend.

Script không tự Git pull/reset, không tự dọn image/volume/release; `flock` ngăn hai deploy.sh chạy cùng lúc. Không sửa/pull checkout trong lúc deploy. Docker logs mỗi container tối đa 3 file × 10 MB; Laravel log ra stderr. [Docker log rotation](https://docs.docker.com/engine/logging/drivers/json-file/).

## 5. Cloudflare và kiểm tra

Sau khi origin cert hợp lệ bật proxy + **Full (strict)**. Bypass cache toàn admin, API JSON/mutation/webhook, HTML/RSC/cart/checkout của Next. Chỉ cache static Next ban đầu; ảnh theo headers origin, giữ query string version/placement/signature. Không Cache Everything, không ép cache response private/Set-Cookie. Không Rocket Loader. ACME challenge phải truy cập được qua Cloudflare để gia hạn. [Full strict](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).

API không tin X-Forwarded-For tùy ý: container bridge không phải loopback host; cần cấu hình proxy trust cụ thể nếu dùng IP khách. Nginx hiện chưa dùng CF real-IP; không trust-all. Admin nhận HTTPS on từ Nginx FPM config. Không gắn Access/challenge vào ảnh public hay webhook Stripe.

```bash
sudo systemctl status teebravo-storefront --no-pager
sudo journalctl -u teebravo-storefront -n 100 --no-pager
sudo docker compose -p teebravo-prod -f deploy/compose.production.yaml ps
sudo docker compose -p teebravo-prod -f deploy/compose.production.yaml logs --tail=100 api admin db
set -a; . /etc/teebravo/deploy.env; set +a
curl -f "http://127.0.0.1:$TEEBRAVO_API_PORT/ready"
curl -f "http://127.0.0.1:$TEEBRAVO_STOREFRONT_PORT/" -o /dev/null
curl -f https://admin.teebravo.com/up
sudo nginx -t
sudo certbot renew --dry-run
```

Test domain cũ (nhất là orders.idreamshirt.com) sau reload Nginx. Test TeeBravo: ảnh HTTPS, login admin, import nhỏ, cart, checkout test và webhook; xem Cache-Control/CF-Cache-Status. PHP stdout/log có thể chứa dữ liệu ứng dụng; kiểm tra trước khi gửi log ra ngoài.

Operations import hiện đồng bộ; import lớn có thể vượt timeout Nginx/Cloudflare. Chạy CLI bằng `docker compose ... exec -u www-data -w /app/api admin /app/api/.venv/bin/python -m app.cli ...` với lệnh đã kiểm tra. Không cấp Docker socket cho admin. API worker hiện chưa fulfillment/email nên chưa chạy worker placeholder.

## 6. Backup và rollback

Backup MySQL riêng từ container, không dùng client MariaDB host để quản lý schema. Ví dụ chạy trong root shell, thư mục backup chmod 700, đủ chỗ (với ổ 95% nên stream tới nơi lưu khác):

```bash
umask 077
docker compose -p teebravo-prod -f deploy/compose.production.yaml exec -T db sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --triggers --events --no-tablespaces --set-gtid-purged=OFF "$MYSQL_DATABASE"' \
  > /PATH_WITH_SPACE_FOR_BACKUP/teebravo.sql
```

Kiểm tra exit code/khả năng restore, backup env và assets offsite. MySQL volume tên mặc định `teebravo-prod_mysql-data`, chỉ thuộc TeeBravo. Không xóa volume hoặc restore đè DB đang nhận order. Khởi tạo DB riêng trước restore bằng Compose `up -d --wait db`; restore dùng `exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot "$MYSQL_DATABASE"' < backup.sql`, sau đó chạy migrations. Đây là quy trình chuyển dữ liệu có chủ đích, không chạy mỗi deploy.

Rollback Node thủ công bằng symlink release đã biết tốt và restart `teebravo-storefront`; dùng `--force` khi deploy tiếp. Giữ current + ít nhất một release tốt. Backend cần giữ image digest/tag trước khi đổi nếu muốn rollback code, nhưng DB migrations không tự rollback. Không downgrade MySQL volume tại chỗ.

Nếu đã từng chạy bộ native cũ, **không chạy hai API/FPM cùng lúc**: kiểm tra và chỉ dừng các unit TeeBravo cũ sau khi xác định chúng tồn tại. Không dừng php7.4-fpm/php8.1-fpm. Bộ mới không cài hoặc reload `teebravo-php`/`teebravo-api` systemd nữa. Node unit vẫn giữ nguyên. Vhost và env cũ cần cập nhật theo bộ mới.

## Trạng thái kiểm chứng

Workspace không có Docker CLI/daemon, nên chưa build/chạy image thực hoặc kiểm tra bằng `docker compose config` tại đây. YAML được parse cục bộ; Bash/helpers và tests mô phỏng kiểm tra được, nhưng không thay thế build/integration test Linux trên VPS. Chưa có truy cập SSH; chưa thay đổi server, database hoặc domain thật. Các phụ thuộc launch (SMTP, Stripe live, policy publish, quyền artwork, fulfillment, monitoring) vẫn cần hoàn tất trước mở bán.

Kiểm tra bộ mới: 8 tests Python (default chỉ storefront, chỉ API không recreate DB, disk guard, rollback Node, secrets/mapping đồng bộ và partial env), Bash syntax, template rendering và kiểm tra port/limits đều qua. Chạy lại bằng `python3 -m unittest discover -s deploy/tests -p 'test_*.py'`. Trên VPS cần thêm `sudo docker compose --env-file /etc/teebravo/deploy.env -p teebravo-prod -f deploy/compose.production.yaml config --quiet` sau setup và build thực trong cửa sổ ít tải trước khi mở domain.

## Import ảnh ngoài repository

Trên server, thêm/cập nhật dòng sau trong `/etc/teebravo/deploy.env`:

```dotenv
TEEBRAVO_IMAGE_SOURCE=/home/images_ids/images
```

Đường dẫn này phải tồn tại và user `www-data` trong Admin (UID 33) phải đọc được file,
traverse được thư mục. Không di chuyển/copy kho ảnh. Compose mount cùng thư mục host
chỉ đọc vào `/app/api/public/design/external` của cả Admin và API; `PRODUCT_IMPORT_HOST_ROOT`
được truyền tự động cho Admin. Dùng đường dẫn gốc ổn định: đổi mount sang kho khác có
thể làm ảnh đã import không còn truy cập được. Docker Snap cũng phải có quyền đọc đường dẫn host.

Sau khi cập nhật code và cấu hình, deploy cả hai backend (không cần build storefront):

```bash
sudo bash deploy.sh --only-api --admin --force
```

Tại Products → Import images, nhập `/home/images_ids/images/ids` hoặc thư mục con
như `/home/images_ids/images/ids/gmc`. Chọn **Try first 100 products (draft)** để import
thật tối đa 100 ảnh đầu, xem tên/slug/đường dẫn và kiểm tra thumbnail. Đây không phải dry-run:
sản phẩm mới được lưu draft, trạng thái sản phẩm cũ được giữ. Chọn **Import and publish all
products** để chạy toàn bộ, mỗi đợt 100 ảnh; giữ modal mở tới khi Finished và giữ nguyên
cây file trong suốt lần chạy. Nếu bị gián đoạn, các đợt đã hoàn thành vẫn được lưu; chạy
lại cùng thư mục sẽ upsert, không nhân đôi sản phẩm. File hỏng hoặc slug trùng ảnh khác
được báo lỗi và không chặn các ảnh còn lại. Kết quả modal hiển thị đợt gần nhất và tổng số lỗi.

Ảnh vẫn ở kho host; DB lưu `external/...`, manifest trong shared assets lưu ánh xạ slug
cho renderer. Chỉ metadata được ghi vào shared assets. Không xóa ảnh gốc sau import.
Mount một lần thư mục cha `/home/images_ids/images`. Modal có thể nhập bất kỳ thư mục
con nào: `.../images/ids`, `.../images/ids/gmc`, hoặc `.../images/another-source`.
Importer quét đệ quy mọi cấp dưới thư mục đã chọn; không yêu cầu ảnh nằm ngay tại đó.
Ví dụ ảnh host `images/ids/gmc/art.png` được lưu đường dẫn `external/ids/gmc/art.png`.
Không cần đổi cấu hình hoặc deploy lại khi thêm thư mục con mới trong `images`.
Đường dẫn ngoài thư mục cha đã mount vẫn bị từ chối.

Storefront dùng URL public dạng `/product-slug/catalog-slug/color.webp`, không dùng đường
dẫn host. API tra manifest `external/...` và render từ mount chỉ đọc; cache ảnh render nằm
trong shared mockup-cache. Sản phẩm/design cần active và catalog có variant/mockup hợp lệ.
Các sản phẩm mới ở chế độ thử 100 là draft: publish sau khi duyệt để hiển thị storefront.
Test `api/tests/test_product_import.py::test_imported_external_image_renders_storefront_webp`
kiểm tra import → repository → endpoint storefront → renderer thật → WebP/cache, giữ nguyên
file gốc; local dùng hard link mô phỏng cùng inode của bind mount, chưa thay thế kiểm tra mount
thật trên VPS.
