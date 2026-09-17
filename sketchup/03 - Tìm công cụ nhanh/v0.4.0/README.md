# Tìm Công Cụ Nhanh v0.4.0

Giữ nguyên các tính năng của v0.3.3 và bổ sung quản lý ghim theo nhóm.

## Mới trong v0.4.0
- Gỡ ghim ngay trong cửa sổ bằng nút `−`.
- Khi ghim, nhập nhóm như `Dựng hình`, `Tô màu`, `Kích thước`, `Vật liệu`, `Khác` hoặc tên tùy ý.
- Đổi nhóm của ghim bằng nút `📂`.
- Tự tạo toolbar riêng theo nhóm, ví dụ `Quick Tools - Dựng hình`, `Quick Tools - Tô màu`.
- Bộ lọc nhóm trong cửa sổ hiển thị số lượng, ví dụ `Dựng hình (3)`.
- Ghim cũ từ v0.3.3 tự chuyển sang `Chưa phân loại` và vẫn được giữ lại.
- Nhóm ghim được lưu cùng hệ thống lưu kép Preferences + AppData của v0.3.3.

## Lưu ý SketchUp
Ruby API của SketchUp có `add_item` nhưng không có API chính thức để xóa riêng một nút khỏi toolbar đang tồn tại. Vì vậy khi bấm Gỡ ghim, ghim bị xóa khỏi dữ liệu và nút cũ bị vô hiệu ngay; khởi động lại SketchUp sẽ dọn icon cũ hoàn toàn khỏi toolbar.
