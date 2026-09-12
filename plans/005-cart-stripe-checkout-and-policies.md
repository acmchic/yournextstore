# TeeBravo: cart, Stripe Checkout, shipping và policies

Ngày lập: 2026-09-10. Người dùng yêu cầu lập kế hoạch rồi tự giao Luna max triển khai.
Đây là kế hoạch và tiêu chí nghiệm thu, không phải bằng chứng đã triển khai/production-ready.

## Kiến trúc quyết định

- Giữ Next.js → ownCommerce → FastAPI → MySQL; Laravel admin dùng cùng DB store.
- Tái sử dụng carts/cart_items, orders và legal_pages hiện có; migration bổ sung tương thích, không reset dữ liệu.
- Stripe-hosted Checkout, thanh toán một lần bằng card (bao gồm Apple Pay/Google Pay khi đủ điều kiện). Không tự xử lý PAN/CVC.
- Không thêm form billing riêng; billing_address_collection=auto. Stripe có thể vẫn thu thông tin tối thiểu để xử lý thanh toán.
- Thu email, tên, địa chỉ giao hàng US: line1, line2 tùy chọn, city, state, postal_code, country. Không yêu cầu tài khoản hay phone nếu không có nhu cầu nghiệp vụ.
- Server tự lấy giá/biến thể/tồn kho từ DB. Client không quyết định số tiền thanh toán.

## Các bước triển khai

1. Rà soát/sửa add/update/remove cart, cookie nhận diện và khôi phục giỏ, admin danh sách/chi tiết giỏ.
2. Cấu hình shipping DB/admin: Standard first=500, additional=300; Express first=1100, additional=400, tất cả USD cents. Tổng shipping = first + additional × (tổng quantity − 1). Giỏ trống không checkout.
3. Tạo order pending cùng snapshot item/giá và shipping rules; tạo Stripe Session idempotent. Hai shipping_options cố định cho quantity của snapshot. Không bật chỉnh quantity trong Stripe khi phí tính trước.
4. Xác nhận bằng signed webhook raw body; chống event lặp và xử lý đồng thời; so khớp session/order/payment_status/currency/tổng tiền. Transaction lưu customer/address/shipping được chọn và trạng thái paid. Không tin query success từ trình duyệt.
5. Xử lý cancel/expired/failed/retry, hạn chế tạo Session/đơn trùng; giữ giỏ khi thanh toán chưa thành công, tránh xóa hàng mới thêm sau snapshot. Bảo vệ PII và quyền xem order/cart/session.
6. Admin xem customer, địa chỉ, items, shipping, tổng tiền, payment status và Stripe reference. Không nhầm fulfillment status với payment status.
7. Mở rộng CMS About/Shipping/Returns; shipping rates render từ cấu hình (không copy số tiền vào văn bản). Draft/published/preview và validation. Chỉ publish thông tin kinh doanh có thật.
8. PDP hiển thị hai block Shipping/Returns với link policies tương ứng khi published, dùng cùng nguồn dữ liệu. Footer/sitemap/canonical/SSR metadata nhất quán. Cart/checkout/order noindex. Schema không bịa điều kiện shipping/return chưa có.
9. Test và cập nhật docs/project-context.md theo implementation thực tế.

## Dữ liệu nghiệp vụ đang cần

- Tên/pháp nhân/địa chỉ và email hỗ trợ thực tế.
- Processing time, Standard/Express transit time, phạm vi US (territories/APO/PO box nếu có giới hạn).
- Returns: defective/non-defective, buyer remorse/sai size, thời hạn, phương thức, phí, hướng dẫn liên hệ, refund timing.
- Stripe test/live credentials và webhook endpoint; cấu hình thuế US theo nghĩa vụ thực tế. Không tự cam kết tax-free hoặc tự đăng ký thuế.

Thiếu dữ liệu không cản trở xây chức năng; nội dung thiếu giữ draft và chỉ rõ trong admin. Không xuất bản placeholder/cam kết giả. Không bật Merchant feed hay chạy giao dịch thật trong lượt triển khai local.

Người dùng đã xác nhận trong lượt này: tạo bản nháp và cấu hình dynamic trong admin cho toàn bộ thông tin còn thiếu, sẽ cung cấp sau.

## Nghiệm thu

- Add đúng design/catalog/color/size; reload giữ giỏ; admin nhìn thấy quantity và item tương ứng.
- Shipping cho quantity 1/2/3: Standard $5/$8/$11; Express $11/$15/$19. Quantity là số đơn vị, không phải số dòng.
- Sửa admin rates cập nhật cart/checkout/policy/PDP theo cơ chế cache có kiểm chứng; đơn cũ giữ nguyên snapshot.
- Test signed paid event, duplicate/concurrent delivery, invalid signature, unpaid/mismatched amount, unknown session và stale cart.
- Customer PII không lộ qua public order listing, ID đoán được hoặc response không có ownership.
- Stripe test card thành công/thất bại và wallet trên thiết bị đủ điều kiện nếu có test credentials; báo rõ phần không thể kiểm chứng.
- Chạy kiểm tra API, root type/lint/tests/build và admin phù hợp; browser mobile/desktop luồng bị ảnh hưởng.
- Published policies đọc được không login; footer/PDP link hoạt động; nội dung raw HTML và schema nhất quán.
- Merchant Center shipping/returns và tax/account settings là bước cấu hình bên ngoài riêng; website update không tự đồng bộ tài khoản Google.

## Nguồn chính thức đối chiếu

- Stripe Checkout: https://stripe.com/payments/checkout
- Checkout Session parameters: https://docs.stripe.com/api/checkout/sessions/create
- Shipping options: https://docs.stripe.com/payments/checkout/custom-shipping-options
- Fulfillment/webhooks: https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted
- Address collection: https://docs.stripe.com/payments/collect-addresses?payment-ui=embedded-form
- Google Merchant guidelines: https://support.google.com/merchants/answer/12756116
- Returns requirements: https://support.google.com/merchants/answer/14011730
- Return schema: https://developers.google.com/search/docs/appearance/structured-data/return-policy
- Shipping schema: https://developers.google.com/search/docs/appearance/structured-data/shipping-policy

Google yêu cầu purchase path hoạt động, full costs rõ ràng, contact dễ tìm và returns minh bạch/nhất quán. Code hoặc schema hợp lệ không đảm bảo được Google phê duyệt hay xếp hạng organic.
