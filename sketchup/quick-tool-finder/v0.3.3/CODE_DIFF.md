## Thay đổi mã v0.3.3

Phần sửa nằm trong `quick_tool_finder/main.rb`:

- thêm `require 'fileutils'`;
- thêm lưu ghim dự phòng vào `%APPDATA%/VADA/TimCongCuNhanh/pins.json`;
- giữ song song `PINS_KEY` và `PINS_KEY_backup` trong SketchUp Preferences;
- khi khởi động gọi phục hồi ghim sau 0,8s, 2,5s và 5s;
- không thay đổi logic tìm kiếm, tên gợi nhớ, phím tắt, giao diện hay Quick Tools.
