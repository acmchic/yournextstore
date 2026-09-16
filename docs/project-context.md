# TeeBravo — context và kiến trúc cho AI

## Cập nhật cart / checkout / policies ngày 2026-09-10

- Cart được lưu trong MySQL qua cookie HttpOnly chứa cart ID. Trang `/cart`, cart drawer và checkout đều đọc cùng cart. Khi người dùng sửa cart trong lúc một Stripe Checkout Session đang mở, storefront hủy session đó rồi thử lại thao tác một lần để snapshot thanh toán không lệch với cart.
- `/checkout` tạo Stripe-hosted Checkout Session cho USD/US. `card` là payment-method type duy nhất trong code; Apple Pay và Google Pay được Stripe hiển thị trong Checkout khi domain, Dashboard, browser và thiết bị đủ điều kiện. Không có form billing tự xây.
- Checkout giữ snapshot bất biến của item, giá, shipping và cấu hình thuế; giữ stock cho đến khi thanh toán hoặc Session hết hạn. Chỉ webhook Stripe đã xác minh chữ ký hoặc reconciliation trực tiếp với Stripe mới tạo order `paid`. Endpoint tạo order chưa thanh toán cũ trả `410`.
- Thông tin tên, email và địa chỉ giao hàng US được lưu vào `customers` và bản sao theo đơn trong `order_addresses`. Admin xem được carts, checkout attempts, shipping, tax và Stripe identifiers trên order.
- Shipping tính theo tổng số item trong đơn: Standard 500 cents item đầu + 300 cents/item tiếp; Express 1100 + 400. Bốn giá này và các chi tiết business/processing/transit/returns được sửa tại admin `Shipping & business`.
- Admin seed About, Shipping, Returns, Privacy và Terms dưới dạng draft. API chỉ public policy đã publish và thay token `{{...}}` bằng cấu hình hiện hành, nên giá shipping trong policy thay đổi cùng admin. Product detail hiển thị hai block Shipping/Returns; chỉ gắn link khi policy tương ứng đã publish.
- Product detail dùng tên bán hàng dạng `Product name — Catalog name` nhất quán cho H1, cart, Product JSON-LD và Merchant feed. Breadcrumb hiển thị `Home / Products / Product name`; mô tả ngắn tự sinh không nằm trong purchase panel, nhưng mô tả đầy đủ vẫn ở phần Product details.
- Storefront hỗ trợ light/dark theo hệ điều hành và lưu lựa chọn thủ công qua nút Sun/Moon trong header.
- Admin `Shipping & business` có công tắc cho cụm delivery/purchase information trên PDP và sáu trường min/max theo business day. Các trường này là nguồn chung cho timeline giao hàng và token processing/transit trong Shipping Policy; component không hiển thị khi công tắc tắt hoặc dữ liệu chưa đầy đủ.
- Runbook cấu hình production và webhook nằm tại `docs/stripe-checkout-runbook.md`. Không bật live checkout cho đến khi Stripe secrets và toàn bộ năm policy bắt buộc đã publish với dữ liệu thật.

## Cập nhật storefront / CMS ngày 2026-09-08

- Home: `Hero` → `HomeCollections`, phong cách ảnh lớn, monochrome, typography gọn. Không còn form newsletter chưa có API hoạt động hoặc nút Favorites không có chức năng.
- `lib/catalog-navigation.ts` là nguồn grouping menu; `/shop/[department]?type=...&page=...` dùng `/v1/shop` phân trang 24 cặp design–catalog. Storefront chuẩn hóa catalog có taxonomy nguồn `men` thành `unisex`, bỏ taxonomy `women` trùng trên cùng loại, và chỉ giữ `women` cho catalog nữ chuyên biệt. Không gộp sản phẩm chỉ theo design ID. Filter/page noindex, department chính có canonical và breadcrumbs.
- Admin `/collections`: active/draft, featured, sort order, mô tả; rule `manual` chọn design, `newest` dùng thứ tự published_at, `tees` chỉ catalog taxonomy t-shirts. Home tối đa 3 collections featured, 4 sản phẩm/module. Automatic collections xoay vòng toàn bộ catalog đủ điều kiện bằng một selector dùng chung, rồi xoay màu còn hàng theo vị trí card; không hard-code hoodie, tee hay tên catalog cụ thể. Đây là lựa chọn merchandising hiện tại, không phải bestseller.
- Admin `/legal`: soạn plain text, preview, draft/published, unpublish. URL không đổi sau khi tạo. API chỉ đọc published. Text được escape để tránh XSS. Thay đổi lưu vào activity_logs cùng transaction. Footer/sitemap đọc published policies; không có nội dung chính sách giả được xuất bản.
- Migrations Laravel bổ sung: `2026_09_08_000001_create_legal_pages_table.php`, `2026_09_08_000002_add_collection_rules.php` trên connection `store`. Chạy trước khi cập nhật API/storefront ở môi trường mới.
- Feed chuẩn bị tại `/api/feed/google?department=unisex&page=1` (unisex/women/kids, 12 cặp design–catalog/trang, header X-Feed-Pages). `MERCHANT_FEED_ENABLED=false` mặc định. `lib/merchant.ts` chia sẻ URL, giá, currency và stock với JSON-LD. Chỉ bật sau khi kiểm tra payment, quyền artwork, chính sách, ảnh HTTPS và dữ liệu feed. Không coi feature này là Google approval.
- `bun scripts/audit-storefront.ts http://localhost:3000` so sánh status/title/canonical/legacy branding của browser thường và Googlebot trên 7 routes. Đây chưa phải full feed/checkout audit.
- Production build hoạt động khi chạy ngoài sandbox có quyền truy cập API/font; Turbopack root được cố định trong next.config.ts.
- Launch vẫn cần thông tin doanh nghiệp, shipping/returns thực tế, rà quyền sử dụng artwork/ảnh hiện có, xác nhận retail pricing và tích hợp payment thực. Checkout hiện là preview, nằm ngoài phạm vi homepage/CMS.

Đối chiếu với working tree ngày 2026-09-07 (bao gồm code chưa commit). Đây là tài liệu nhập môn cho repo; đọc trước khi sửa code. Khi code hoặc nghiệp vụ thay đổi, cập nhật tài liệu này cùng thay đổi đó. Tên bảng, API và file dưới đây phản ánh implementation hiện tại, không phải roadmap.

## 1. Repo này làm gì?

Thương hiệu public là **TeeBravo**, định vị premium graphic clothing cho khách hàng US, domain chính thức **https://teebravo.com**. Tên thư mục local vẫn là `Teeravo`.

TeeBravo là storefront bán áo in design, phục vụ khách hàng US. Một design có thể được bán trên nhiều catalog khác nhau, ví dụ cùng artwork trên T-shirt và hoodie. Không tạo một bản artwork riêng cho từng loại áo, màu hoặc size.

Repo gồm ba phần:

| Phần | Công nghệ | Trách nhiệm |
| --- | --- | --- |
| Root (`app/`, `components/`, `lib/`) | Next.js App Router + React, base YourNextStore | Giao diện khách hàng, browse/search, trang sản phẩm, chọn catalog/màu/size, giỏ hàng |
| `api/` | Python FastAPI + MySQL + renderer | Cung cấp dữ liệu store/product/catalog/cart/order; render ảnh áo có design; import catalog và artwork |
| `admin/` | Laravel + Inertia + React | Quản lý sản phẩm, catalog/variant, import design/catalog, xem và cập nhật đơn hàng |

**YourNextStore là nguồn template và interface tương thích, không phải backend commerce hiện đang được sử dụng.** `lib/commerce.ts` export `commerce = ownCommerce`; `lib/own-commerce.ts` gọi FastAPI qua `STORE_API_URL` và chuyển response sang shape của `commerce-kit`. Việc package `commerce-kit` còn tồn tại không có nghĩa dữ liệu sản phẩm đến từ dịch vụ YourNextStore. Các ví dụ SDK cũ trong tài liệu template cần được đối chiếu với adapter này.

## 2. Mô hình nghiệp vụ và bảng dữ liệu

| Khái niệm | Bảng | Ý nghĩa |
| --- | --- | --- |
| Design | `designs` | Artwork gốc: source path, checksum, kích thước, slug, metadata, trạng thái |
| Product | `products` | Listing bán hàng gắn với một `design_id`: title, slug, description, SEO, trạng thái |
| Catalog | `catalogs` | Mẫu hàng nền có thể in lên; có loại sản phẩm, brand/material, thông tin provider và `provider_material_json` chứa danh sách spec chất liệu từ provider |
| Màu / size | `catalog_colors`, `catalog_sizes` | Các lựa chọn thuộc từng catalog |
| Catalog variant | `catalog_variants` | Catalog + màu + size, có SKU, giá/cost, currency, stock policy |
| Product–catalog | `product_catalogs` | Quan hệ đã lưu giữa product và catalog, màu mặc định và điều chỉnh giá |
| Product variant | `product_variants` | Product + catalog variant: biến thể áo in có thể đưa vào giỏ |
| Mockup | `mockup_templates`, `catalog_assets` | Ảnh áo nền, placement, print area và dữ liệu phục vụ renderer |
| Collection | `collections`, `collection_products` | Nhóm listing dùng để trưng bày; khác catalog áo nền |
| Checkout | `checkout_settings`, `checkout_attempts`, `stripe_events` | Cấu hình shipping/policy, snapshot + stock reservation, webhook deduplication |
| Customer/order | `customers`, `orders`, `order_items`, `order_addresses` | Hồ sơ giao hàng tối thiểu và snapshot đơn đã thanh toán |

Quan hệ cốt lõi:

```text
designs ← products → product_variants → catalog_variants
             │                              │
             └── product_catalogs ───────→ catalogs
                                            ├── catalog_colors
                                            ├── catalog_sizes
                                            └── mockup_templates / catalog_assets
```

Mỗi product tham chiếu một design; schema không bắt buộc mỗi design chỉ có một product. Một product có thể có nhiều catalog và nhiều biến thể. Trong adapter storefront, catalog được chuyển sang shape `category` của Commerce Kit; không vì tên `category` mà coi nó là design hay collection.

Giá `*_minor` là số tiền ở đơn vị nhỏ nhất (USD cents), không phải dollars. Adapter chuyển giá sang chuỗi theo contract Commerce Kit; UI dùng `formatMoney`. Store mặc định USD/en-US nếu API không cung cấp cấu hình khác.

## 3. Điểm đặc biệt: catalog được kết hợp động

Code hiện tại cho phép truy cập một product active với bất kỳ catalog active có variant hợp lệ qua `/product/{product-slug}/{catalog-slug}`. Không cần có sẵn dòng `product_catalogs` cho từng cặp trước khi hiển thị trang này. Các trang browse/list và Home ưu tiên quan hệ `product_catalogs` khi product đã được gán; product chưa có mapping vẫn được hiển thị như fallback để catalog chưa seed (ví dụ hoodie/sweatshirt) không biến mất. Với product đã gán, `default_color_id` quyết định màu/ảnh mặc định.

`CatalogRepository.get_product_detail(slug, catalog_slug)` sinh danh sách variant từ catalog được chọn, với ID ổn định bằng `stable_variant_id(product_public_id, catalog_variant_public_id)` trong `api/app/catalog_assignment.py`. Khi thêm vào giỏ, `api/app/repository.py` tìm variant đã lưu; nếu chưa có, nó xác định cặp product/catalog variant rồi tạo `product_catalogs` và `product_variants` trong transaction.

Nhánh API không truyền catalog vẫn đọc các `product_variants` đã lưu và media qua assignment. Vì vậy không được mặc định hai nhánh có cùng hành vi. CLI `assign-product-catalog` vẫn có thể tạo trước assignment/variants, nhưng không phải điều kiện bắt buộc cho trang có catalog.

Lệnh `seed-product-showcase` trong `api/app/cli.py` tạo nhanh các mapping đại diện cho từng catalog thuộc unisex (taxonomy có cả men và women), women, kids và accessories. `--per-category` là số product cho mỗi catalog, nên một design có thể được gán cho cả catalog T-shirt và hoodie. Lệnh chọn màu phổ biến nhưng chỉ lưu nếu màu đó có active variant thật trong catalog. `product_catalogs` vẫn không phải allowlist cho product detail động; nó điều khiển merchandising khi có mapping và dữ liệu variant được materialize trước cho listing/cart.

## 4. Luồng dữ liệu

### Khách hàng xem và mua

1. Next.js gọi `lib/commerce.ts` / `lib/own-commerce.ts`.
2. Adapter gọi FastAPI: `/v1/store`, `/v1/catalogs`, `/v1/products`, `/v1/collections`.
3. API đọc MySQL qua `api/app/repository.py`, trả listing, variant và media URL.
4. Trang `/product/[slug]/[catalog]` dùng chung implementation với `/product/[slug]`; helper `productGetByCatalog` gửi `?catalog=...` đến API.
5. Thêm hàng gọi `PUT /v1/carts/{cart_id}/items`; lấy giỏ qua `GET /v1/carts/{cart_id}`.
6. `/checkout` gọi `POST /v1/carts/{cart_id}/checkout`, rồi chuyển khách sang Stripe-hosted Checkout. Webhook `/v1/stripe/webhook` xác minh sự kiện và tạo order sau khi đối chiếu session với snapshot.
7. `/checkout/success` chỉ hiện xác nhận tối thiểu khi cookie cart và Stripe Session cùng khớp một checkout attempt; không nhận order ID công khai để đọc PII.

Storefront read requests trong `lib/own-commerce.ts` có timeout và retry giới hạn cho lỗi kết nối/gateway tạm thời. Các dữ liệu công khai không bắt buộc như navigation, catalog, collection, legal và product browse dùng fallback rỗng/cấu hình thương hiệu để không làm crash toàn trang khi FastAPI đang khởi động lại; các thao tác cart/checkout và ghi dữ liệu vẫn báo lỗi thay vì dùng dữ liệu giả.

### Render ảnh

Renderer kết hợp artwork với ảnh catalog, màu và vị trí in theo dữ liệu mockup. Asset gốc nằm trong `api/public/design/` và `api/public/mockup/`; ảnh kết quả được cache qua `api/app/cache.py`. Không cần dựng sẵn toàn bộ tích design × catalog × màu × size.

Catalog có thể lưu một prompt tạo model mockup dùng lại. Admin tạo asset model offline một lần bằng prompt kèm ảnh reference của catalog, duyệt thủ công rồi upload vào `mockup_templates` với style `men` hoặc `women`, màu và vùng in chuẩn hóa. Asset được lưu tại `api/public/mockup/{catalog-group}/{catalog-slug}/{style}_{color}_{placement}.{ext}`. API chỉ render artwork bằng code lên template đã duyệt, không gọi AI/VTON trong request của khách. Các model templates là ảnh bổ sung và chỉ hiện cho đúng màu có template; ảnh chính vẫn phải phản ánh đúng variant theo checklist Merchant Center.

`api/scripts/analyze_catalog_mockups.py` chuẩn bị vùng in offline. Guideline từ provider là vùng an toàn mặc định; analyzer còn nhận diện các vùng sản phẩm lặp lại trong một mockup (ví dụ hai tumbler) và lưu tọa độ chuẩn hóa vào `catalog_mockup_metadata`. Lúc phục vụ request, renderer chỉ đọc metadata và đặt một bản artwork theo chế độ `contain` vào từng vùng, không chạy computer vision. Artwork RGB/JPEG cũng được loại nền gần trắng nối với mép ảnh trước khi ghép, nhưng giữ lại chi tiết trắng nằm kín bên trong design.

Các HTTP contract đang tồn tại trong `api/app/main.py`:

- `/{product_slug}/{catalog_slug}/{color}.webp`: ảnh flat/front theo product, catalog và màu. Thêm `/{view}` trước `.webp` cho `men`, `women`, `back`, `chest`, `men-back`, `women-chest` hoặc `blank-back`. Route `_{color}` cũ chỉ còn compatibility.
- `/v1/products/{product_slug}/catalogs/{catalog_slug}/mockup`: render theo lựa chọn, gồm placement.
- `/img/{design_and_catalog:path}` và `/img/blank/{filename}`: render theo asset/file và ảnh áo nền.
- `/v1/mockups/render`, `/m`, `/m/{product_ref}`: các đường render/reference khác còn được hỗ trợ.

Đọc `product_media.py`, `repository.py`, `rendering/pipeline.py` trước khi thay URL, placement, asset selection hoặc cache. Các đường render có quy tắc khác nhau; không suy ra một thay đổi ở một endpoint sẽ áp dụng cho tất cả endpoint. Catalog renders ưu tiên giữ đúng artwork; renderer tổng quát còn có các map mask/warp/displacement/shadow/highlight.

### Admin quản lý

`admin/routes/web.php` dùng middleware `auth` + `verified`; controller chính là `admin/app/Http/Controllers/Store/StoreController.php`. Admin dùng `DB::connection('store')` đọc/ghi trực tiếp DB nghiệp vụ, không đi qua FastAPI cho mọi thao tác CRUD. Connection `store` trong `admin/config/database.php` sao chép connection mặc định và bỏ table prefix; cấu hình deployment phải trỏ nó vào cùng DB mà API sử dụng.

Admin gọi Python CLI trong `api/` để import folder design, import Gearment catalog và phân tích mockup. `runImporter()` chạy `bootstrap-db.sh` trước CLI; đường dẫn dùng `POD_API_PATH` hoặc mặc định là thư mục `api` cạnh thư mục `admin`, nên không phụ thuộc workspace local. Audit nghiệp vụ ghi vào `activity_logs` trên connection Laravel mặc định; dữ liệu commerce ghi vào connection `store`.

Admin `/operations` cung cấp allowlist cho các tác vụ vận hành: import product theo folder design, phân tích vùng in mockup, import catalog Gearment theo chế độ không truncate, cập nhật size chart và tạo showcase assignment. Không nhận command hoặc argument tùy ý từ trình duyệt; folder import product được kiểm tra phải nằm trong `api/public/design`.

## 5. Nên đọc file nào trước?

| Công việc | Điểm bắt đầu |
| --- | --- |
| Hiểu frontend lấy dữ liệu từ đâu | `lib/commerce.ts`, `lib/own-commerce.ts` |
| Product page và chọn catalog | `app/product/[slug]/page.tsx`, `app/product/[slug]/[catalog]/page.tsx` |
| API và logic dữ liệu | `api/app/main.py`, `api/app/repository.py`, `api/app/db.py` |
| Schema và migration | `api/mysql/init/`, `api/bootstrap-db.sh` |
| Design/product import | `api/app/importer.py`, `api/app/cli.py` |
| Gearment catalog | `api/app/gearment/sync.py`, `api/catalog-import.json` |
| Ảnh, placement và cache | `api/app/product_media.py`, `api/app/catalog.py`, `api/app/rendering/pipeline.py`, `api/app/cache.py` |
| Admin CRUD/import | `admin/routes/web.php`, `admin/app/Http/Controllers/Store/StoreController.php`, `admin/resources/js/pages/` |
| Deployment và config | `compose.yaml`, `api/app/settings.py`, `admin/config/database.php` |

Schema SQL hiện tại là nguồn quan trọng hơn phần giới thiệu legacy về các view `pod_products` / `pod_mockup_render_jobs` trong `api/README.md`: commerce repository đang truy vấn trực tiếp các bảng domain. Không kết luận toàn bộ service chỉ đọc hai view đó.

## 6. Chạy dự án và ranh giới hiện tại

- Storefront: `bun dev` tại root; `STORE_API_URL` mặc định `http://localhost:8000`. `POD_MOCKUP_API_URL` dùng cho kết nối mockup; `NEXT_PUBLIC_URL` dùng cho public origin. Không lấy `YNS_API_KEY` trong hướng dẫn template làm bằng chứng phải dùng backend YNS.
- API: trong `api/`, cài dependency theo `pyproject.toml`, chạy `uvicorn app.main:app --reload --port 8000`. DB dùng các biến `DB_*` (fallback `MYSQL_*`), asset/cache dùng `MOCKUP_*`; đọc `settings.py` để biết tên và default.
- API giữ pool MySQL có vòng đời hữu hạn (`DB_POOL_RECYCLE`) và ping trước truy vấn; các truy vấn đọc tự reconnect/retry giới hạn khi socket bị MySQL đóng, còn transaction/ghi không tự retry để tránh ghi trùng. `api/start.sh` phải được chạy trong môi trường có DB để áp dụng các migration chưa có.
- `compose.yaml` root có MySQL, API, worker và storefront; chưa có service admin.
- Admin là app Laravel riêng với config/runtime riêng; đọc `admin/composer.json`, `admin/package.json` và config DB trước khi chạy.
- Checkout code đã hoàn chỉnh nhưng production còn phụ thuộc Stripe live keys, public webhook, domain HTTPS/wallet registration, tax configuration và policy thật đã publish.
- `api/app/worker.py` lấy outbox event `order.paid` rồi đánh dấu done; chưa tích hợp nhà fulfillment hoặc email xác nhận đơn.
- README ở root/admin còn dấu vết starter kit. Tài liệu kế hoạch trong `plans/` không phải bằng chứng tính năng đã hoàn thành.

## 7. Quy tắc khi AI sửa repo

- Giữ mô hình design dùng lại trên nhiều catalog; phân biệt artwork, listing, áo nền và biến thể bán hàng.
- Theo đường dữ liệu đang dùng `ownCommerce → FastAPI → MySQL`; đừng tự chuyển trở lại backend YNS theo ví dụ template.
- Thay schema/giá/variant phải xét cả API và admin vì cùng thao tác dữ liệu nghiệp vụ.
- Thay ảnh phải xét contract URL, metadata placement, cache và frontend đang hiển thị ảnh đó.
- Đọc `docs/google-merchant-center-ads-checklist.md` trước khi sửa product/cart/checkout/legal/feed/image/ad copy. Khách hàng mục tiêu là US; giữ nội dung và giá phù hợp thị trường này.
- Mọi link đến `/checkout` phải dùng thẻ `<a>` như hướng dẫn root.
- Không đưa giá trị secret từ env vào tài liệu; chỉ ghi tên biến.
- Ưu tiên code hiện tại khi tài liệu template mâu thuẫn; phân biệt implementation với ý định kinh doanh và ghi rõ giới hạn.

## Cập nhật thương hiệu 2026-09-08

`lib/storefront-config.ts` là cấu hình thương hiệu. `NEXT_PUBLIC_URL` có default `https://teebravo.com`; robots, sitemap và JSON-LD dùng canonical helper. Store identity từ API là TeeBravo. Migration `006_teebravo_brand.sql` đổi brand placeholder cũ trong products sang TeeBravo. Frontend không còn preview toolbar/referral badge hay hosted checkout proxy. Các tên component public dùng `StoreLink` / `StoreMedia`; cookie dùng prefix `teebravo`. Copyright và nguồn gốc template vẫn lưu trong tài liệu source, không phải nội dung storefront.

## VPS production (2026-09-14)

- Host thực tế Ubuntu 20.04, PHP 7.4/8.1 và Python 3.8; không có package PHP 8.4 trong APT hiện tại, nhưng có Docker/Compose. Bộ deploy chuyển sang host Node + container backend, giữ nguyên runtime/database của domain khác.
- `deploy.sh` mặc định chỉ deploy standalone Next trên loopback 1990; `--api`/`--admin`/`--all` mới build/update backend. Compose production project `teebravo-prod` có API Python 3.11, admin PHP 8.4 kèm Python CLI, MySQL 8.4 riêng không public port; API publish loopback 1991.
- Admin/API cùng DB nội bộ `db:3306`, dùng shared assets/cache. Next gọi API nội bộ nhưng `STORE_MEDIA_URL` giữ URL ảnh public HTTPS. Nginx host chuyển FastCGI tới socket bind mount của container, chỉ trích public assets admin ra host.
- Setup tạo secrets một lần, không thay file env hiện có. Build Next staging/cache, symlink release và rollback khi restart/HTTP health lỗi vẫn giữ; backend migrations chưa có rollback tự động.
- VPS disk đang dùng 95%; script kiểm tra free space và giới hạn container logs, không prune chung. Native PHP/systemd backend templates cũ đã được thay bằng Docker, không dùng song song.
- `INERTIA_SSR_ENABLED=false` production; ba SQL nền đã bỏ ignore để clone sạch đủ bootstrap input. Runbook: `docs/vps-deployment.md`. Chưa build Docker/integration test thực vì workspace không có Docker và chưa truy cập VPS.

## Chuẩn hóa Gearment catalog (2026-09-15)

- Migration `014_catalog_code.sql` bổ sung `catalogs.code` cho mã style như `5000`, `6004`, `64V00`, `3001Y`; mã chỉ lấy từ tên/slug nguồn, không đoán từ provider ID. `provider_product_id` và `source_page_slug` giữ nguyên để đối chiếu Gearment.
- Import giải mã HTML entity, bỏ possessive khỏi slug và tách mã cuối: `women39;s-slim-fit-tee-6004` → `women-slim-fit-tee`, code `6004`. Tên hiển thị giữ dạng dễ đọc, không chứa mã cuối. Slug trùng catalog khác báo lỗi để tránh ghi đè.
- `sync-gearment-catalog --apply` mặc định upsert, giữ ID và assignment. Chỉ `--truncate` mới yêu cầu reset. Chạy bootstrap DB trước import trên môi trường mới.
- Asset front/back lưu theo placement (`front.png`, `back.png`, giữ extension thật); ảnh cùng placement bổ sung có hậu tố số, URL ảnh trùng được gộp. Khi sync catalog cũ, importer sao chép asset sang đường dẫn chuẩn rồi cập nhật DB và tham chiếu model/metadata. File nguồn cũ được giữ để rollback và tránh làm hỏng request ảnh đang chạy.
