# VADA SketchUp Plugins

Thư mục tập trung các plugin SketchUp của VADA.

| Plugin | Chức năng | Bản hiện tại |
|---|---|---|
| [quick-tool-finder](./quick-tool-finder/) | Tìm nhanh công cụ/plugin, ghim công cụ, nhóm ghim, tên gợi nhớ | v0.4.1 |
| [extension-cleaner](./extension-cleaner/) | Tìm, kiểm tra và gỡ plugin/extension không cần thiết | v1.2.1 |
| [section-view-generator](./section-view-generator/) | Tạo nhanh MB, MD1, MD2, MC1, MC2, view trần và Section Plane tương ứng | v1.4.0 |
| [auto-dim](./auto-dim/) | Tự động ghi kích thước các mặt bàn tròn/mặt cong khó bắt điểm | v1.1.0 |

## Quy ước chung

- Mỗi plugin có thư mục riêng.
- Mỗi phiên bản được lưu trong thư mục `vX.Y.Z`.
- Giữ lịch sử phiên bản, không ghi đè bản cũ.
- Giao diện plugin VADA ưu tiên tiếng Việt.
- Giao diện nền đen `#000000`.
- Khi mở plugin phải hiển thị mã phiên bản hiện tại.
- Plugin có giao diện/toolbar phải có icon rõ ràng, dễ nhận biết ở kích thước nhỏ.

> Lưu ý: `quick-tool-finder` đã có đầy đủ lịch sử trên GitHub. Ba plugin còn lại hiện được lập cấu trúc/version index từ các bản đã phát triển trong dự án; mã nguồn/RBZ lịch sử cần được đưa lại từ artifact của các cuộc chat cũ hoặc tái xuất từ bản đang cài trên máy để đảm bảo đúng 100% bản cuối, tránh đưa mã tái dựng không khớp lên kho chính.
