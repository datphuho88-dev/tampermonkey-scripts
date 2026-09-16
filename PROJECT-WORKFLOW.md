# Dự án Tampermonkey – Hướng dẫn làm việc với ChatGPT + GitHub

## 1. Mục tiêu
Dùng GitHub làm **nguồn code chính** cho toàn bộ userscript Tampermonkey. ChatGPT đọc, sửa và commit code trực tiếp trên GitHub. Người dùng không cần copy-paste lại code mỗi lần sửa.

Repo chính:
`datphuho88-dev/tampermonkey-scripts`

## 2. Quy tắc mặc định khi yêu cầu sửa code
Khi người dùng nói kiểu:

> sửa code VADA Auto Workflow: ...

thì mặc định ChatGPT phải:

1. Tìm đúng file trên GitHub.
2. Đọc đúng phần code cần sửa, hạn chế đọc lại toàn bộ file nếu không cần.
3. Giữ nguyên tất cả chức năng đang hoạt động, chỉ sửa phần được yêu cầu.
4. Sửa trực tiếp trên GitHub.
5. Tăng `@version` đúng một lần trong cùng commit.
6. Commit trực tiếp lên nhánh `main`.
7. Trả lại version mới + commit SHA ngắn gọn.

Không yêu cầu người dùng copy-paste toàn bộ code trừ khi file không tồn tại hoặc GitHub không truy cập được.

## 3. Ưu tiên tốc độ khi sửa
Để sửa nhanh nhất:

- Ưu tiên **1 lần đọc + 1 lần ghi** nếu đủ thông tin.
- Nếu sửa nhỏ, tìm đúng đoạn cần đổi thay vì phân tích lại toàn bộ script.
- Không tạo commit phụ nếu không cần.
- Không thay đổi format hoặc cấu trúc không liên quan.
- Nếu có thể xác định chính xác vị trí sửa từ code hiện tại thì sửa luôn.

## 4. Quy tắc version
Mọi thay đổi code phải tăng `@version`.

Ví dụ:

```text
2.2.0 → 2.2.1  : sửa nhỏ / UI / bug nhỏ
2.2.1 → 2.3.0  : thêm tính năng đáng kể
3.0.0           : thay đổi lớn, có khả năng ảnh hưởng tương thích
```

Nếu script có biến version bên trong như:

```js
const SCRIPT_VERSION = '2.2.1';
```

thì phải cập nhật đồng bộ với `@version`.

## 5. Metadata tối thiểu cho userscript
Mỗi file `.user.js` nên có:

```js
// ==UserScript==
// @name         ...
// @namespace    ...
// @version      ...
// @description  ...
// @match        ...
// @run-at       document-idle
// @updateURL    ...
// @downloadURL  ...
// ==/UserScript==
```

Nếu cần icon thì thêm `@icon`.

Không lưu mật khẩu, cookie, token, API key hoặc dữ liệu bí mật trong repo public.

## 6. Workflow cập nhật chuẩn

```text
Người dùng yêu cầu sửa
        ↓
ChatGPT tìm đúng file GitHub
        ↓
Đọc đúng phần cần sửa
        ↓
Sửa code + tăng version
        ↓
Commit trực tiếp lên main
        ↓
Người dùng bấm ↻ LOAD trên panel
        ↓
Code mới được tải từ GitHub và chạy ngay
```

## 7. Cơ chế ↻ LOAD
Script VADA có nút `↻ LOAD` để dùng khi đang phát triển.

Mục tiêu:

- Không cần F5 trang web.
- Không cần chờ Tampermonkey phát hiện bản update.
- Tải code mới trực tiếp từ GitHub Raw.
- Dùng cache-busting, ví dụ:

```js
RAW_URL + '?_=' + Date.now()
```

và:

```js
fetch(url, { cache: 'no-store', credentials: 'omit' })
```

Khi hot-load bản mới, script cũ phải tự dọn panel, launcher, listener và timer trước khi bản mới chạy để tránh chạy chồng.

Lưu ý: `↻ LOAD` chỉ làm **code đang chạy trên tab hiện tại** thành bản mới. Version hiển thị trong Tampermonkey Dashboard có thể vẫn là bản cũ cho đến khi Tampermonkey cập nhật chính thức.

## 8. Cập nhật chính thức trong Tampermonkey
Tampermonkey dùng:

- `@updateURL`
- `@downloadURL`
- `@version`

để kiểm tra bản mới.

Cơ chế này có thể chậm vài phút do lịch kiểm tra hoặc cache. Vì vậy khi đang sửa/test nhanh thì ưu tiên `↻ LOAD`; Tampermonkey Update dùng để đồng bộ bản cài chính thức.

## 9. Phạm vi chạy của VADA Auto Workflow
Script VADA Auto Workflow hiện chỉ được phép chạy trên:

```text
https://hoadondientu.gdt.gov.vn/*
```

Không đổi `@match` sang toàn bộ website trừ khi người dùng yêu cầu rõ.

## 10. Quy tắc bảo toàn chức năng
Khi sửa code:

- Không xóa chức năng cũ nếu người dùng không yêu cầu.
- Không đổi selector, storage key, workflow hoặc UI không liên quan.
- Nếu thay UI, cố gắng giữ nguyên dữ liệu/config đã lưu trong `localStorage`.
- Nếu sửa hot-load, phải giữ nút `↻ LOAD` hoạt động.
- Nếu có thể gây xung đột với phiên bản đang chạy, phải bổ sung cleanup/destroy phù hợp.

## 11. Script hiện đang quản lý

- `🧰 VADA - Auto Workflow - Chọn ngày • Tìm kiếm • Tải file • 12 tháng.user.js`
- `🏦 ACB - Xuất Excel - Tự tải đủ 12 tháng.user.js`
- `🧾 Thuế DVC - 01-GTGT - Chọn năm • quý • khoảng ngày.user.js`

## 12. Quy tắc trả lời sau khi sửa
Sau khi commit xong, chỉ cần báo ngắn gọn:

```text
Đã sửa trực tiếp trên GitHub.
Version mới: x.x.x
Commit: abc123...
Bấm ↻ LOAD để chạy bản mới ngay.
```

Không cần gửi lại toàn bộ code trong chat trừ khi người dùng yêu cầu.