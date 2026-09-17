# VADA Extension Cleaner v1.2.1

Bản đã sửa lỗi:

```text
NoMethodError: undefined method `execute_script' for UI::ActionCallbackContext
```

Hướng sửa đã dùng: giữ tham chiếu `dlg` tới `UI::HtmlDialog` và gọi `dlg.execute_script(...)` thay vì gọi trên callback context.

**Source/RBZ:** chờ đồng bộ lại từ artifact đã tạo hoặc từ bản đang cài trên máy để đảm bảo đúng bản đã kiểm thử.
