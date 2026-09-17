# Quick Tool Finder for SketchUp

Versioned source archive for the SketchUp command palette plugin.

## Versions

- `v0.4.1` — sửa gỡ ghim hoạt động ngay, tránh ghim đã xóa bị khôi phục, thêm giao diện quản lý nhóm, tạo/đổi tên/xóa nhóm và bộ chọn nhóm trực quan, 2026-09-17.
- `v0.4.0` — thêm gỡ ghim, phân nhóm ghim tùy ý, đổi nhóm, toolbar riêng theo nhóm và bộ lọc nhóm, 2026-09-17.
- `v0.3.3` — sửa lưu/khôi phục ghim qua Preferences + AppData và tự dựng lại sau khi SketchUp khởi động, 2026-09-17.
- `v0.3.2` — renamed visible plugin/window to `Tìm Công Cụ Nhanh`; features and saved settings remain unchanged, 2026-09-17.
- `v0.3.1` — smoother redesigned UI, lighter search rendering, quick filters, visible version badge, 2026-09-17.
- `v0.3.0` — pin any found tool directly to a persistent `Quick Tools` toolbar, reuse the tool's original icon when available, 2026-09-17.
- `v0.2.0` — force-show toolbar, persistent mnemonic aliases, and shortcut helper, 2026-09-17.
- `v0.1.0` — initial working build, 2026-09-17.

## Versioning rule

Each release is stored in its own immutable folder: `vX.Y.Z/`. Future changes should create a new version folder instead of overwriting older versions, so rollback stays simple.
