# TeeBravo — context và kiến trúc cho AI

## Cập nhật storefront / CMS ngày 2026-09-08

- Home: `Hero` → `HomeCollections`, phong cách ảnh lớn, monochrome, typography gọn. Không còn form newsletter chưa có API hoạt động hoặc nút Favorites không có chức năng.
- `lib/catalog-navigation.ts` là nguồn grouping menu; `/shop/[department]?type=...&page=...` dùng `/v1/shop` phân trang 24 cặp design–catalog. Không gộp sản phẩm chỉ theo design ID. Filter/page noindex, department chính có canonical và breadcrumbs.
- Admin `/collections`: active/draft, featured, sort order, mô tả; rule `manual` chọn design, `newest` dùng thứ tự published_at, `tees` chỉ catalog taxonomy t-shirts. Home tối đa 3 collections featured, 4 sản phẩm/module. Automatic collections chọn một catalog đại diện; New Arrivals ưu tiên hoodie, Graphic Tees lấy tee đầu theo thứ tự catalog. Đây là lựa chọn merchandising hiện tại, không phải bestseller.
- Admin `/legal`: soạn plain text, preview, draft/published, unpublish. URL không đổi sau khi tạo. API chỉ đọc published. Text được escape để tránh XSS. Thay đổi lưu vào activity_logs cùng transaction. Footer/sitemap đọc published policies; không có nội dung chính sách giả được xuất bản.
- Migrations Laravel bổ sung: `2026_09_08_000001_create_legal_pages_table.php`, `2026_09_08_000002_add_collection_rules.php` trên connection `store`. Chạy trước khi cập nhật API/storefront ở môi trường mới.
- Feed chuẩn bị tại `/api/feed/google?department=men&page=1` (men/women/kids, 12 cặp design–catalog/trang, header X-Feed-Pages). `MERCHANT_FEED_ENABLED=false` mặc định. `lib/merchant.ts` chia sẻ URL, giá, currency và stock với JSON-LD. Chỉ bật sau khi kiểm tra payment, quyền artwork, chính sách, ảnh HTTPS và dữ liệu feed. Không coi feature này là Google approval.
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
6. API có `POST /v1/orders`, nhưng storefront checkout hiện vẫn là preview, chưa phải luồng thanh toán hoàn chỉnh.

### Render ảnh

Renderer kết hợp artwork với ảnh catalog, màu và vị trí in theo dữ liệu mockup. Asset gốc nằm trong `api/public/design/` và `api/public/mockup/`; ảnh kết quả được cache qua `api/app/cache.py`. Không cần dựng sẵn toàn bộ tích design × catalog × màu × size.

Các HTTP contract đang tồn tại trong `api/app/main.py`:

- `/{product_slug}/{catalog_slug}_color-{color}.webp`: ảnh sản phẩm theo catalog/màu.
- `/v1/products/{product_slug}/catalogs/{catalog_slug}/mockup`: render theo lựa chọn, gồm placement.
- `/img/{design_and_catalog:path}` và `/img/blank/{filename}`: render theo asset/file và ảnh áo nền.
- `/v1/mockups/render`, `/m`, `/m/{product_ref}`: các đường render/reference khác còn được hỗ trợ.

Đọc `product_media.py`, `repository.py`, `rendering/pipeline.py` trước khi thay URL, placement, asset selection hoặc cache. Các đường render có quy tắc khác nhau; không suy ra một thay đổi ở một endpoint sẽ áp dụng cho tất cả endpoint. Catalog renders ưu tiên giữ đúng artwork; renderer tổng quát còn có các map mask/warp/displacement/shadow/highlight.

### Admin quản lý

`admin/routes/web.php` dùng middleware `auth` + `verified`; controller chính là `admin/app/Http/Controllers/Store/StoreController.php`. Admin dùng `DB::connection('store')` đọc/ghi trực tiếp DB nghiệp vụ, không đi qua FastAPI cho mọi thao tác CRUD. Connection `store` trong `admin/config/database.php` sao chép connection mặc định và bỏ table prefix; cấu hình deployment phải trỏ nó vào cùng DB mà API sử dụng.

Admin gọi Python CLI trong `api/` để import folder design, import Gearment catalog và phân tích mockup. `runImporter()` chạy `bootstrap-db.sh` trước CLI; đường dẫn dùng `POD_API_PATH` hoặc mặc định là thư mục `api` cạnh thư mục `admin`, nên không phụ thuộc workspace local. Audit nghiệp vụ ghi vào `activity_logs` trên cùng connection.

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
- `compose.yaml` root có MySQL, API, worker và storefront; chưa có service admin.
- Admin là app Laravel riêng với config/runtime riêng; đọc `admin/composer.json`, `admin/package.json` và config DB trước khi chạy.
- `app/checkout/page.tsx` hiện là “Private checkout preview”. Không mô tả hệ thống đã có thanh toán production chỉ vì API có endpoint order.
- `api/app/worker.py` hiện lấy outbox event rồi đánh dấu done; chưa thấy fulfillment/payment integration trong worker này.
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
