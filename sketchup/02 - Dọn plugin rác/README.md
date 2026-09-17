# VADA Extension Cleaner

Plugin SketchUp dùng để tìm, kiểm tra và gỡ nhanh các plugin/extension không cần thiết.

**Bản hiện tại:** `v1.2.1`

## Lịch sử gần nhất

- `v1.0.0` — bản đầu.
- `v1.1.0` — cải thiện khả năng tìm plugin.
- `v1.2.0` — sửa luồng quét/hiển thị.
- `v1.2.1` — sửa lỗi callback `UI::ActionCallbackContext` bằng cách gọi `dlg.execute_script(...)` trên đúng đối tượng `UI::HtmlDialog`.

## Môi trường đã dùng

- SketchUp 2023.
- Thư mục plugin từng dùng: `.../SketchUp 2023/SketchUp/Plugins/vada_extension_cleaner/`.

## Trạng thái mã nguồn

Cấu trúc GitHub đã được tạo. Mã nguồn/RBZ chính xác của `v1.2.1` cần lấy lại từ artifact cũ hoặc từ plugin đang cài trên máy để không thay thế bằng mã tái dựng khác bản đã kiểm thử.
