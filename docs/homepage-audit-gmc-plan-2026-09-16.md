# TeeBravo — Homepage audit và kế hoạch chuẩn bị GMC

Ngày audit: 2026-09-16. Phạm vi: homepage localhost, các trang trust được liên kết, so sánh ba storefront tham khảo. Đây là kế hoạch, chưa sửa giao diện hay cấu hình kinh doanh.

## Kết luận

Giữ phong cách editorial tối giản hiện tại, nhưng sửa thông tin mua hàng trước khi mở rộng trang. Bản localhost chưa sẵn sàng làm cơ sở đăng ký GMC: Returns mở trang 404, About còn placeholder, banner và FAQ không nhất quán với chính sách/checkout. Thêm nhiều collection không giải quyết được những điểm này.

GMC không quy định homepage phải có số lượng block, bestseller, review, blog hay newsletter cụ thể. Trọng tâm là thông tin trung thực, sản phẩm mua được, điều kiện mua rõ ràng và dữ liệu nhất quán. Homepage chỉ là một phần của lần kiểm tra trước khi nộp.

## Phương pháp và giới hạn

- Xem browser và DOM homepage tại desktop 1440px và mobile 390 × 844; kiểm tra menu mobile và chuyển light/dark cơ bản.
- Đọc Shipping Policy, Returns, About, Contact, FAQ; mở câu trả lời shipping/returns/payment.
- Kiểm tra metadata và JSON-LD trong DOM đã render, cùng code hero, collection, banner, FAQ và tính shipping.
- GitHub Shop và Vintage & Classic được xem trực tiếp qua browser và dữ liệu web. IdreamShirt có chặn xác minh tự động trong browser; so sánh nội dung từ bản trang do web tool đọc, không kết luận pixel/layout mobile của trang đó.
- Không thực hiện thanh toán, gửi contact form, kiểm tra tài khoản GMC, quyền artwork, mailbox hay cấu hình production. Không đo Core Web Vitals thực địa. Không coi tốc độ localhost dev là hiệu năng production.
- Tool next-devtools-mcp init không có trong danh sách callable của phiên; đã dùng browser, tài liệu dự án và codebase-memory để kiểm tra. Graph có một số kết quả không phản ánh literal hiện tại nên đối chiếu source trực tiếp khi cần.

## Điểm nên giữ

- Hướng hình ảnh lớn, nền trung tính và đường phân cách rõ; không cần thay toàn bộ bằng một theme Shopify đại trà.
- Có giá, loại áo, số màu và đường dẫn sản phẩm trên card.
- Grid hai cột ở mobile; tại mẫu 390px không phát hiện overflow ngang của trang đã tải.
- Menu mobile có search và đường dẫn phân loại áo; search không bị mất, nhưng phải mở menu mới dùng được.
- Canonical homepage là https://teebravo.com/; có meta description, một H1 và Organization/WebSite/Store JSON-LD trong DOM.
- Có Shipping Policy nêu phí, processing và transit riêng. Contact có form; chưa kiểm tra gửi thành công.
- Light/dark hoạt động trong kiểm tra cơ bản. Không có popup newsletter che nội dung khi audit.

Về thiết kế: không có dấu hiệu rõ của kiểu gradient/glass/card trang trí đại trà. Điểm yếu nằm ở nhiều khẩu hiệu tương tự nhau, khoảng trống lớn và hai dải sản phẩm lặp artwork, làm trang có cảm giác merchandising chưa hoàn thiện.

## Findings theo mức ưu tiên

P0 = cần giải quyết trước khi nộp GMC; không có nghĩa đã xác nhận tài khoản bị từ chối. P1 = quan trọng với mua hàng/niềm tin. P2 = tối ưu trải nghiệm và SEO.

| ID | Mức | Bằng chứng | Tác động và cách xử lý |
| --- | --- | --- | --- |
| F01 | P0 | Footer Returns → /return-policy hiện Page not found/404 | Publish chính sách thật, nêu hàng lỗi và đổi ý, thời hạn, quy trình, phí, thời gian hoàn tiền. Trang mở không cần login; mọi link trỏ đúng trang. |
| F02 | P0 | Banner ghi miễn phí ship trên $300. Shipping Policy ghi Standard $5 + $3/item tiếp; Express $11 + $4/item tiếp. api/app/shipping.py tính theo quantity, không nhận subtotal để áp ngưỡng $300. | Bỏ ưu đãi khỏi banner hoặc triển khai quy tắc được chủ shop xác nhận xuyên suốt checkout, policy và GMC. Không chỉ sửa prose cho có vẻ nhất quán. |
| F03 | P0 | FAQ nói ship quốc tế; Shipping Policy và checkout hướng US. FAQ nói returns 14 ngày dù trang chính sách 404. FAQ source còn hứa newsletter welcome discount trên home. | Thay toàn bộ câu trả lời starter bằng nội dung thật. Các con số/điều kiện dùng nguồn admin chung. Không mặc định chính sách 14 ngày là quyết định kinh doanh đã duyệt. |
| F04 | P0 | /about hiện “Store information is not available yet.”; footer Legal chỉ có Shipping Policy, không có Privacy/Terms. | Hoàn thiện About, Privacy, Terms; public đúng identity và hoạt động. Checkout code có gate yêu cầu 5 policy published khi dùng live key, nên đây còn là dependency vận hành. Chưa kiểm chứng live checkout. |
| F05 | P1; điều kiện trước launch | Hero có hình nhân vật/biểu tượng có thể nhận diện; chưa có bằng chứng quyền sử dụng trong audit | Kiểm tra nguồn và giấy phép từng artwork/ảnh/model. Thay bằng artwork được sở hữu/cấp phép nếu chưa chứng minh được quyền. Không kết luận vi phạm chỉ từ ảnh. |
| F06 | P1; nâng P0 nếu giá sai | Card đầu hiển thị $2.52–$18.00; tên “Yorkshire Terrier Animals Rainbow Scare Ainime Din” khó hiểu | Audit retail price từng variant, tránh nhầm cost với giá bán. Kiểm tra biến thể giá thấp nhất thực sự mua được. Chuẩn hóa title theo artwork + loại áo; cập nhật nhất quán PDP/feed/cart/schema. Giá thấp tự nó không phải vi phạm. |
| F07 | P1 | New Arrivals và Graphic Tees cùng bốn artwork, phần lớn chỉ đổi loại áo/màu | Chọn collection bằng merchandising; tránh lặp design trong hai dải đầu. Với collection có ý định so sánh fit, được dùng cùng design nhưng ghi rõ mục đích. |
| F08 | P1 | Mobile 390px: H1 khoảng y=655; New Arrivals khoảng y=1337. Hero hai ảnh bị crop hẹp; CTA nằm sau ảnh. | Gọn hero, đưa thông điệp và CTA vào màn hình đầu; giảm phần intro giữa hero và sản phẩm. Giữ một ảnh mobile có crop phù hợp. |
| F09 | P1 | Card mobile có title và price cùng một hàng; title/type bị ellipsis rất sớm | Tên tối đa hai dòng, loại áo một dòng, giá hàng riêng; giữ ảnh/card ổn định. Link phải mở đúng catalog và màu ảnh. |
| F10 | P2 | Cart button đo 20 × 20px, menu 40 × 40px, theme 36 × 36px tại mẫu mobile | Thiết kế vùng bấm 44 × 44px trở lên. Đây là mục tiêu UX; đánh giá WCAG 2.5.8 cần tính cả khoảng cách/ngoại lệ, không kết luận fail chỉ từ kích thước icon. Search nên truy cập trực tiếp từ header. |
| F11 | P2 | Title homepage chỉ “TeeBravo”; H1 là khẩu hiệu chung. Organization logo/image dùng URL tương đối | Dùng title “Graphic Tees, Hoodies & Sweatshirts | TeeBravo”; H1 nói rõ sản phẩm. Chuẩn hóa URL asset tuyệt đối và thêm dữ liệu business đã xác minh, tránh schema claim không có nội dung hỗ trợ. |
| F12 | P2 | “The TeeBravo difference”, brand intro và footer lặp thông điệp everyday/graphics. Garment Care trỏ FAQ không có mục care tương ứng | Gộp brand story, thêm thông tin chất liệu/fit/care hữu ích. Đưa link care tới nội dung thật; footer ưu tiên contact và policy. |

Không báo lỗi ảnh từ trạng thái naturalWidth=0 trước khi scroll vì có lazy loading. Ảnh card đã xuất hiện khi vào viewport. Skeleton hiện tại trong app/page.tsx dùng kích thước/kiểu khác nội dung thật, có phần w-96; cần kiểm tra loading ở mobile và mạng chậm khi triển khai, chưa xác nhận CLS/overflow loading qua đo đạc.

## So sánh storefront tham khảo

| Trang | Điều đáng học | Cách áp dụng TeeBravo |
| --- | --- | --- |
| [GitHub Shop](https://thegithubshop.com/) | Hero gắn một collection có câu chuyện; New Arrivals chọn ít sản phẩm; campaign riêng; Shop by category rõ | Học cấu trúc curated collection + category. Không cần sao chép hiệu ứng tương tác hoặc nhận diện GitHub. Browser thể hiện Shopify section; đây cũng là một tham chiếu Shopify. |
| [Vintage & Classic](https://vintagenclassic.com/) | Browse theo Holidays/Hobbies và nhiều chủ đề; footer có các nhóm trợ giúp và contact | Học cách nhóm theo sở thích và dịp mua. Không cần sao chép mật độ listing, collection có tên IP hoặc nhãn bestseller khi chưa có dữ liệu. |
| [IdreamShirt](https://idreamshirt.com/) | Nói rõ loại sản phẩm/dịch vụ; trình bày thông tin delivery/returns; có Bestsellers, Find your style, New Arrivals và review | Học độ cụ thể và phân lớp block. Các cam kết về California, thời gian ship, guarantee và review của họ không phải bằng chứng cho TeeBravo. |

Không suy ra bất kỳ shop tham khảo nào đã được GMC phê duyệt. Nội dung/số review của họ là claim quan sát được, không phải số liệu đã xác minh độc lập.

## Cấu trúc homepage đề xuất

Giới hạn giai đoạn đầu: hai product grid, một seasonal/editorial feature, các block điều hướng và hỗ trợ ngắn. Không nối thêm mọi collection thành dải sản phẩm riêng.

1. **Announcement + header.** Một thông tin hữu ích, chính xác, có link tới shipping. Điều hướng theo loại áo; department vẫn có thể nằm trong menu. Search và cart dễ tìm. Không giữ free shipping chưa được hỗ trợ.
2. **Hero có sản phẩm cụ thể.** Gợi ý H1: “Graphic tees for your everyday.” Mô tả nêu tees/hoodies/sweatshirts thật. Primary CTA: Shop graphic tees; secondary: Explore new arrivals. Ảnh đại diện sản phẩm bán thật, có quyền sử dụng. Không dùng slideshow tự chạy.
3. **Thông tin mua hàng ngắn.** Ba mục: ships to US; processing theo cấu hình hiện hành; shipping & returns có link. Nêu processing không đồng nghĩa delivery. Không gắn “easy returns”, “free returns” hay guarantee khi chưa có chính sách hỗ trợ.
4. **Shop by style — 4 ô.** Graphic Tees, Hoodies, Sweatshirts, Long Sleeves. Chỉ hiện loại có hàng/ảnh; desktop 4 cột, mobile 2 × 2. Đây là phân loại áo nền/catalog, không phải bốn nhóm artwork mới.
5. **New Arrivals — 4 sản phẩm.** Theo published_at; mỗi card ưu tiên một artwork khác nhau; view all tới collection đầy đủ. Dùng giá bán đã kiểm tra.
6. **Shop by interest — 3 đến 4 ô ảnh.** Khởi đầu với nhóm đủ artwork có quyền sử dụng; Dogs & Pets phù hợp dữ liệu đang nhìn thấy. Các nhóm khác chỉ xuất bản khi đã có đủ nội dung thật.
7. **Một campaign theo mùa.** Ví dụ Fall Layers hoặc Halloween nếu có artwork phù hợp, giấy phép và khả năng giao đúng thời điểm. Một banner + CTA, không cần thêm grid tám sản phẩm. Có lịch bắt đầu/kết thúc và cutoff giao hàng nếu quảng bá dịp lễ.
8. **TeeBravo Picks — 4 sản phẩm tuyển chọn.** Lựa chọn thủ công về artwork, ảnh, giá và fit; không gọi Best Sellers khi chưa có dữ liệu bán. Có thể chọn dải Graphic Tees hiện tại thay block này; không cần cả hai nếu lặp nhiều.
9. **About + fit/quality proof.** Ảnh thật hoặc mockup trung thực, đoạn ngắn về TeeBravo và sản phẩm; thông tin chất liệu/care theo từng catalog. Nếu có mẫu in thật thì dùng ảnh cận. Không dùng “premium” như một bằng chứng tự thân.
10. **Buying FAQ — 4 câu.** Ship ở đâu, processing/transit, chọn size ở đâu, xử lý returns thế nào. Câu trả lời ngắn và link chi tiết; dữ liệu khớp policy.
11. **Footer.** Brand/contact; Shop; Help; Legal. Contact email hoạt động, business identity đúng thực tế, About, Shipping, Returns & Refunds, Privacy, Terms. Track Order chỉ quảng bá như tính năng hoạt động khi đã test. Chỉ hiển thị payment methods đã xác nhận khả dụng.

Review là block tùy chọn bổ sung về sau khi có dữ liệu thật, số lượng và nguồn xác minh. Newsletter, blog, social feed, countdown, popup giảm giá và sale toàn store không phải ưu tiên chuẩn bị GMC.

## Collection nên có

| Collection | Quy tắc đề xuất | Triển khai |
| --- | --- | --- |
| New Arrivals | Sản phẩm vừa publish; ưu tiên artwork khác nhau ở home | Giữ collection/rule sẵn có |
| Graphic Tees | Catalog taxonomy t-shirts và artwork được duyệt | Giữ rule tees; có landing rõ ràng |
| Hoodies / Sweatshirts / Long Sleeves | Theo catalog type thật | Giai đoạn đầu dùng browse route đang có; nếu cần SEO landing riêng thì tạo URL indexable có nội dung riêng |
| Dogs & Pets | Manual artwork phù hợp, đã kiểm tra quyền | Ưu tiên vì đã nhìn thấy nguồn design về chó; không suy ra mọi design đều an toàn |
| Nature & Outdoors / Hobbies & Humor / Retro Graphics | Manual theo chủ đề hoặc thẩm mỹ; chỉ publish khi inventory đủ | Roadmap sau khi inventory audit; không tạo collection rỗng |
| Seasonal Edit | Manual + thời gian hiệu lực + khả năng fulfillment | Chỉ một collection mùa nổi bật mỗi lần |
| TeeBravo Picks | Manual, người vận hành tuyển chọn | Dùng thay Bestseller trong giai đoạn chưa có dữ liệu |
| Best Sellers | Thứ hạng từ đơn đã thanh toán trong khoảng thời gian định nghĩa; xử lý hoàn/hủy nhất quán | Giai đoạn sau; không suy ra từ thứ tự import hoặc newest |

Mục tiêu merchandising nội bộ: một topic collection có khoảng 8–12 artwork khác nhau trước khi quảng bá lớn; đây không phải yêu cầu Google. Nếu kho nhỏ, bắt đầu ít collection. Mỗi card phải neo vào cặp design–catalog–màu cụ thể; không xoay catalog/màu ngẫu nhiên giữa các lượt tải.

Mô hình hiện tại đã có manual/newest/tees và tối đa ba featured collections, bốn sản phẩm/module. Phase đầu có thể làm bằng cấu hình hiện hữu. Để kiểm soát chính xác card và mùa vụ, giai đoạn sau cân nhắc lựa chọn catalog/màu đại diện, ảnh collection, thời gian hiển thị và trạng thái duyệt artwork. Không cần xây page builder tổng quát ngay.

## Desktop và mobile

| Hạng mục | Desktop | Mobile |
| --- | --- | --- |
| Hero | Nội dung và CTA cùng khung ảnh, khống chế chiều cao | Một ảnh crop có chủ đích; CTA trong viewport đầu ở 390 × 844 |
| Chiều sâu trang | Giảm intro trước catalog, tránh hai đoạn slogan nối nhau | Mục tiêu bắt đầu product section trong khoảng 900–1100px ở 390px, điều chỉnh theo copy thực tế |
| Product grid | 4 cột; tối đa hai dải đầu giai đoạn launch | 2 cột, 4 sản phẩm mỗi dải; tên hai dòng, giá riêng; không phụ thuộc hover |
| Category/topic tiles | 3–4 cột với ảnh phân biệt | 2 × 2, nhãn luôn nhìn thấy; ưu tiên grid hơn carousel ẩn nội dung |
| Header | Search rõ, cart có vùng click đủ | Menu, logo, search, cart; nếu chật thì chuyển theme toggle vào menu |
| Footer/FAQ | Các nhóm rõ, policy trong một thao tác | Accordion truy cập bằng keyboard; contact và link policy dễ tìm, không ẩn quá sâu |

Reuse components/ui, đặc biệt Button, Accordion, Sheet và Spinner. Sửa ProductCard/shared control một lần để các trang cùng kế thừa. Mọi link checkout dùng thẻ a theo quy tắc repo.

## Lộ trình triển khai

### Phase A — độ chính xác và điều kiện launch

- Chủ shop chốt business identity, contact hoạt động, return conditions, giá retail, quyền ảnh/artwork và có/không ưu đãi freeship.
- Publish đủ policy thật; sửa footer, About và FAQ cùng lúc.
- Xóa hoặc triển khai đúng freeship; bảo đảm UI, cart, checkout và GMC sau này dùng cùng điều kiện.
- Audit giá thấp bất thường và tên sản phẩm; kiểm tra các ảnh hero được quyền sử dụng.
- Output: không link trust hỏng; không placeholder; không claim trái policy; đủ điều kiện tiếp tục kiểm tra checkout live.

### Phase B — homepage desktop/mobile

- Làm hero gọn, heading/CTA rõ; bỏ/gộp intro dư thừa.
- Thêm Shop by style, thông tin mua hàng ngắn và Shop by interest.
- Chọn New Arrivals và TeeBravo Picks không lặp artwork; cải thiện ProductCard mobile.
- Thêm About ngắn, Buying FAQ và footer chuẩn; chỉnh metadata.
- Output: homepage có đường mua rõ và mỗi block phục vụ một quyết định khác nhau.

### Phase C — kiểm tra trước GMC trên production

- Kiểm tra domain HTTPS teebravo.com, verification/claim, crawlability, robots/sitemap/canonical và ảnh public.
- Test product → chọn màu/size → cart → checkout; xác nhận số tiền, ship, tax, payment, webhook, đơn và quy trình sau mua. Thực hiện test payment trong môi trường phù hợp; giao dịch thật cần chủ shop thực hiện/xác nhận.
- Feed dùng URL sản phẩm/variant cụ thể, không dùng homepage. Kiểm tra title/ảnh/giá/stock/size/color/gender/age_group, identifiers và item grouping theo specification.
- Cấu hình shipping/returns trong GMC khớp store. Phí theo số lượng cần mô hình tương ứng, không khai một flat rate cho mọi đơn.
- Test batch sản phẩm đại diện trước khi mở rộng feed; mọi mặt hàng được submit phải có dữ liệu/quyền sử dụng hợp lệ.
- Chạy responsive, a11y và performance trên production build. Không có phép thử frontend nào đảm bảo được Google phê duyệt.

### Phase D — sau khi có dữ liệu

- Best Sellers từ đơn thật, review có nguồn, UGC có đồng ý sử dụng, seasonal campaigns và newsletter hoạt động.
- Theo dõi view_item_list/select_item/view_item/add_to_cart/begin_checkout/purchase; so sánh CTR từng block và mobile funnel với baseline, không đặt uplift giả định.

## Tiêu chí nghiệm thu

- Các trust links trả nội dung đúng; không có placeholder, draft public hoặc 404.
- Banner, Buying FAQ, full FAQ, PDP, Shipping/Returns và checkout nhất quán.
- Tại 360/390/430/768/1024/1440px không overflow; đọc được title/price; search và cart dễ thao tác. Các width ngoài 390/1440 là phạm vi test cần làm, không phải đã pass trong audit này.
- Hero CTA trong màn hình đầu ở cấu hình mobile mục tiêu; hai dải sản phẩm có artwork đủ khác biệt.
- Keyboard mở/đóng menu, Escape, focus return, selected/hover/focus/disabled/loading/empty/error; light/dark; reduced motion; text zoom 200%; target size và contrast được kiểm tra bằng công cụ phù hợp.
- Skeleton khớp grid và chiều cao nội dung; test API chậm/lỗi, không hiện khoảng trống vô nghĩa hoặc ưu đãi thiếu dữ liệu.
- Ảnh đúng variant, không méo, không broken; lazy load phần dưới, ưu tiên hợp lý ảnh hero. Đo LCP/INP/CLS production, mục tiêu good: ≤2.5s/≤200ms/≤0.1 ở p75 khi có field data.
- Chạy typecheck, lint, test và build phù hợp phần thay đổi; smoke test browser. Những bước này chưa chạy vì audit không sửa code.
- Không coi Product/Review/FAQ schema hay review badge trên home là điều kiện bắt buộc để GMC duyệt. Product/Offer cần được rà ở PDP/feed; tránh aggregateRating giả.

## Nguồn chính thức

- [Merchant Center approval guidelines](https://support.google.com/merchants/answer/12756116): contact, phương thức thanh toán, điều kiện mua và checkout hoàn tất.
- [Misrepresentation](https://support.google.com/merchants/answer/6150127): tính trung thực của business identity, offer và nội dung.
- [Return policies](https://support.google.com/merchants/answer/14011730): công khai và thiết lập return policy.
- [Landing page requirements](https://support.google.com/merchants/answer/4752265): thông tin sản phẩm/variant và tính nhất quán với data source.
- [Missing contact information](https://support.google.com/merchants/answer/12472091): Google chấp nhận các cách liên hệ khác nhau; không tự suy ra bắt buộc mọi store phải hiện cả phone lẫn địa chỉ US trong footer. Business/account verification là yêu cầu riêng cần hoàn thành đúng thực tế.

Các nhận định giao diện là đánh giá UX từ phiên audit, không phải quy định Google. Các thay đổi hiện hữu trong working tree được giữ nguyên.
