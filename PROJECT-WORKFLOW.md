# Dự án Tampermonkey – Workflow làm việc với ChatGPT + GitHub

## Mục tiêu
Dùng GitHub làm nguồn code chính cho toàn bộ userscript Tampermonkey. ChatGPT đọc/sửa code trực tiếp trên GitHub, sau đó Tampermonkey nhận bản mới qua `@updateURL` / `@downloadURL`.

## Quy ước làm việc
1. Mỗi userscript là một file riêng có đuôi `.user.js`.
2. GitHub là bản gốc. Hạn chế sửa thủ công trực tiếp trong Tampermonkey nếu không cần thiết.
3. Mỗi lần ChatGPT sửa code phải:
   - Đọc file hiện tại trên GitHub.
   - Sửa trực tiếp file trên GitHub.
   - Tăng `@version`.
   - Commit thay đổi vào nhánh `main`.
4. Khi thêm userscript mới, cần có metadata tối thiểu:
   - `@name`
   - `@namespace`
   - `@version`
   - `@description`
   - `@match`
   - `@updateURL`
   - `@downloadURL`
5. Không lưu mật khẩu, cookie, token, API key hoặc dữ liệu bí mật trong repo public.

## Workflow chuẩn

```text
Yêu cầu sửa tính năng
        ↓
ChatGPT tìm đúng file trên GitHub
        ↓
Đọc code hiện tại
        ↓
Sửa code
        ↓
Tăng @version
        ↓
Commit trực tiếp lên main
        ↓
Tampermonkey kiểm tra cập nhật
        ↓
Cài/chạy phiên bản mới
```

## Repo chính
`datphuho88-dev/tampermonkey-scripts`

## Script hiện đang quản lý
- `🧰 VADA - Auto Workflow - Chọn ngày • Tìm kiếm • Tải file • 12 tháng.user.js`
- `🏦 ACB - Xuất Excel - Tự tải đủ 12 tháng.user.js`
- `🧾 Thuế DVC - 01-GTGT - Chọn năm • quý • khoảng ngày.user.js`

## Quy tắc cho các yêu cầu sau này
Khi có yêu cầu kiểu:

> sửa code VADA Auto Workflow: ...

thì mặc định xử lý trực tiếp trên repo này, không yêu cầu người dùng copy-paste lại toàn bộ code trừ khi file không tồn tại hoặc repo không truy cập được.
