# Prompt sửa UI sản phẩm, search, tồn kho và place order

Bạn đang làm việc trên project AIMS trong repo này:

- Frontend: `src/frontend` dùng Angular standalone components.
- Backend: `src/backend` dùng NestJS + TypeORM.
- Các màn hình liên quan chính:
  - Homepage danh sách sản phẩm: `src/frontend/src/app/pages/customer/home/*`
  - View chi tiết sản phẩm: `src/frontend/src/app/pages/customer/product-detail/*`
  - Cart/checkout/place order: `src/frontend/src/app/pages/customer/cart/*`, `checkout/*`, services `cart.service.ts`, `order.service.ts`
  - Backend product/order/stock: `src/backend/src/product/*`, `src/backend/src/order/*`

## Mục tiêu

Sửa luồng mua hàng để người dùng có thể tìm sản phẩm theo keyword, chọn số lượng bằng nút `+`/`-`, xem thêm thông tin khi cần, kiểm tra tồn kho đúng, và chỉ cho `place order` khi tồn kho hợp lệ.

## Yêu cầu chi tiết

1. Thêm hoặc hoàn thiện phần "Xem thêm" ở view sản phẩm.
   - Ở homepage, nếu danh sách sản phẩm nhiều thì hiển thị nút `Xem thêm` để load thêm sản phẩm theo từng batch, không làm mất filter/search hiện tại.
   - Ở view chi tiết, nếu mô tả hoặc thông tin chi tiết quá dài thì cắt gọn ban đầu và có nút `Xem thêm` / `Thu gọn`.
   - Nút chỉ hiển thị khi thật sự có nội dung bị ẩn.

2. Chỉnh nút số lượng ở homepage.
   - Trên mỗi product card ở homepage, thêm/chỉnh bộ chọn số lượng dạng stepper: nút `-`, ô số lượng, nút `+`.
   - Số lượng mặc định là `1`.
   - Không cho giảm dưới `1`.
   - Không cho tăng quá `quantityInStock`.
   - Nếu sản phẩm hết hàng thì disable stepper và nút thêm vào giỏ.
   - Khi bấm `Thêm vào giỏ`, thêm đúng số lượng người dùng đã chọn, không hard-code luôn là `1`.

3. Chỉnh lại search theo keyword.
   - Keyword cần trim khoảng trắng và search không phân biệt hoa thường.
   - Search nên match ít nhất các field chung: `title`, `category`, `description`, `barcode`.
   - Nếu backend đã có dữ liệu chi tiết theo loại sản phẩm, cân nhắc match thêm:
     - Book: authors, publisher, genre.
     - CD: artists, recordLabel, genre, track title.
     - DVD: director, studio, genre.
     - Newspaper: publisher, editorInChief, sections.
   - Search phải hoạt động cùng lúc với filter category/media type và khoảng giá.
   - Khi không có kết quả, hiển thị thông báo rõ ràng và giữ lại keyword đang tìm.

4. Hiển thị nút `+` / `-` trong view chi tiết.
   - Ở product detail, thay hoặc bổ sung input số lượng bằng stepper `- [quantity] +`.
   - Validate giống homepage: số nguyên, tối thiểu `1`, tối đa `quantityInStock`.
   - Disable nút `+` khi quantity đã bằng tồn kho.
   - Disable nút `-` khi quantity bằng `1`.
   - Hiển thị message lỗi nếu người dùng nhập số không hợp lệ.

5. Check tồn kho trước khi cho đặt hàng.
   - Frontend phải check số lượng trong cart/checkout không vượt `quantityInStock`.
   - Nếu thiếu hàng, hiển thị lỗi cụ thể sản phẩm nào thiếu và còn bao nhiêu.
   - Disable hoặc chặn action checkout/place order khi cart không hợp lệ.
   - Backend vẫn phải là nguồn kiểm tra cuối cùng:
     - Endpoint check stock phải merge các item trùng productId trước khi so với tồn kho.
     - `placeOrder` chỉ thành công nếu tất cả sản phẩm còn đủ hàng và đang `ACTIVE`.
     - Khi đặt hàng thành công, trừ tồn kho trong transaction có lock để tránh oversell.
   - Nếu tồn kho OK thì cho `place order` bình thường và điều hướng sang success/payment theo flow hiện tại.

6. Chỉnh lại tên giá và text hiển thị.
   - Dùng label nhất quán:
     - `Giá bán` cho `currentPrice`.
     - `Giá gốc` cho `originalPrice` nếu có hiển thị.
     - `Tồn kho` cho `quantityInStock`.
   - Giữ note VAT nếu nghiệp vụ cần, ví dụ `(chưa bao gồm VAT)`.
   - Sửa các text tiếng Việt bị lỗi encoding nếu file đang hiển thị sai.

## Tiêu chí nghiệm thu

- Homepage:
  - Search keyword hoạt động đúng với filter.
  - Mỗi product card chọn được số lượng bằng `+`/`-`.
  - Bấm thêm vào giỏ thêm đúng quantity đã chọn.
  - Hết hàng thì không thêm được.
  - `Xem thêm` chỉ hiện khi còn sản phẩm chưa hiển thị.

- Product detail:
  - Có stepper `-` / `+` cho số lượng.
  - Không chọn được số lượng vượt tồn kho.
  - Có `Xem thêm` / `Thu gọn` cho mô tả hoặc nội dung dài.
  - Label giá/tồn kho hiển thị đúng.

- Cart/checkout/order:
  - Nếu cart vượt tồn kho thì báo lỗi và không place order.
  - Nếu tồn kho OK thì place order thành công.
  - Sau khi place order thành công, backend trừ tồn kho chính xác.

## Lưu ý kỹ thuật

- Giữ style/pattern hiện có của Angular standalone components.
- Không rewrite lớn ngoài phạm vi yêu cầu.
- Không chỉ validate ở frontend; backend vẫn phải validate stock trong `placeOrder`.
- Ưu tiên sửa bằng các service/component hiện có thay vì tạo abstraction mới nếu không cần.
- Sau khi sửa, chạy build/test phù hợp:
  - Frontend: `npm run build` trong `src/frontend`
  - Backend: `npm test` hoặc `npm run test` / `npm run build` trong `src/backend` nếu script có sẵn

## Output mong muốn

Khi hoàn thành, báo lại:

- Danh sách file đã sửa.
- Tóm tắt ngắn từng thay đổi.
- Lệnh đã chạy để kiểm tra.
- Nếu còn case chưa xử lý được, nói rõ lý do và vị trí cần kiểm tra tiếp.
