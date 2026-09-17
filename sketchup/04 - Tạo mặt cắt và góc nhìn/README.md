# VADA Section View Generator

Plugin tạo nhanh hệ mặt cắt và scene nhìn cho SketchUp.

**Bản hiện tại:** `v1.4.0`

## Yêu cầu của bản hiện tại

- Tạo các scene: `MB`, `MD1`, `MD2`, `MC1`, `MC2`, `View trần`.
- Có Section Plane tương ứng cho từng hướng cần cắt.
- Các view nhìn cùng hướng với Section Plane tương ứng.
- `MD1` và `MD2` có mặt cắt riêng, không dùng chung.
- Tránh trường hợp `MD2` và `MC2` trùng hướng.
- Các góc nhìn dùng **Perspective**.
- Bản v1.4.0 đã dùng camera Perspective, FOV khoảng 35° và camera bám theo hướng Section Plane.

## Trạng thái mã nguồn

Cấu trúc GitHub đã được tạo. Source/RBZ chính xác của `v1.4.0` cần lấy lại từ artifact cũ để giữ đúng bản đã kiểm thử.
