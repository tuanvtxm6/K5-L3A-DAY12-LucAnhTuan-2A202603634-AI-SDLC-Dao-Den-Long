# Phase 3: đánh giá

| Mục Ticket-03 | Trạng thái | Ghi chú |
|---|---|---|
| §1 Nhiên liệu, châm dầu, tắt và thắp lại | Đạt | Dầu tính bằng số nguyên 1/60 |
| §2 Bóng Mực hút dầu (`drain`) | Đạt | Giả định B1–B4 |
| §3 Luật thắng mới (bình minh) | Đạt | Không còn `all_lit` |
| §4 Sức chứa tăng dần | Đạt | |
| §5 Điểm mới | Đạt | |
| §6 Chế độ mù màu | Đạt một phần | Màu, ⚠, đèn xẹp, nhấp nháy đều có. Vết rách khó thấy ở xa |
| §7 Contract v1.2 | Đạt (theo test của mình) | |
| DoD: ADR | Đạt | [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md) |
| DoD: test cũ sửa hoặc xóa có lý do | Đạt | 10 mục trong [phase-3-spec §Regression](phase-3-spec.md#regression); không skip |
| DoD: changelog | Đạt | [CHANGELOG.md](../../CHANGELOG.md) |
| DoD: test ẩn Phase 1–2 không bị thay thế vẫn đạt | Đạt với test của mình | Các luật Phase 1–2 không bị đụng tới (di chuyển, lướt, rơi, Gió Lạc, pause…) vẫn xanh |

**Thiết kế thay đổi thế nào:** vùng an toàn được tách thành thuộc tính phái sinh `hasZone()` thay vì đọc thẳng `lit`. Vì vậy luật "Bóng Mực không vào vùng an toàn" chỉ phải đổi ở một chỗ. Luật thắng được gom về bước 11.

**Cần chỉnh:** âm thanh riêng cho `lantern_out` và `refuel`; chơi thử trọn ván để cân độ khó.
