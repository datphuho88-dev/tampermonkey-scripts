# Quick Tool Finder v0.2.0

## Điểm mới

- Ép hiện toolbar/icon Quick Tool Finder trên màn hình khi SketchUp khởi động.
- Nút `▣` trong cửa sổ để hiện lại toolbar nếu người dùng lỡ ẩn.
- Đặt **tên gợi nhớ** cho bất kỳ công cụ nào. Ví dụ `Make Box` → `Hình vuông`.
- Tên gợi nhớ được lưu bằng SketchUp preferences và vẫn còn sau khi khởi động lại.
- Tìm kiếm ưu tiên tên gợi nhớ.
- Tạo command theo tên gợi nhớ để người dùng có thể gán shortcut trong `Preferences > Shortcuts`.
- Hiển thị shortcut đã gán khi SketchUp trả về shortcut tương ứng.
- Có nút mở phần Shortcuts cho chính Quick Tool Finder.

## Lưu ý về phím tắt

SketchUp Ruby API có `Sketchup.get_shortcuts` để đọc shortcut nhưng không có API chính thức để extension tự ghi/gán shortcut. Vì vậy Quick Tool Finder tạo một `UI::Command` có tên gợi nhớ rồi mở trang Shortcuts để người dùng gán phím bằng giao diện chuẩn của SketchUp.
