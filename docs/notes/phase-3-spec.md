# Phase 3 (Ticket-03 "Đèn cạn dầu"): spec, acceptance criteria, assumptions

Quyết định thiết kế được ghi ở [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md). Danh sách breaking changes nằm ở [CHANGELOG](../../CHANGELOG.md).

## Acceptance criteria

| AC | Luật | Kiểm chứng | Bằng chứng |
|---|---|---|---|
| AC-fuel | Đèn sáng có fuel 100, hao đúng 1,0/s (đơn vị nguyên 1/60) | `AC-fuel` | phase3.test |
| AC-out | fuel ≤ 0 → tắt, deposited 0, ever_lit giữ, `lantern_out`. Thắp lại cần 5, được +40, `relight: true`. Đèn chưa từng sáng vẫn cần 10, +100 | `AC-out` ×2 | proof #2 |
| AC-refuel | used = min(mang, ceil((100 − fuel)/10)), fuel ≤ 100, +5 mỗi đom đóm. Chỉ chọn đèn nhận được, gần nhất | `AC-refuel` ×2 | proof #3 |
| AC-zone | Vùng an toàn chỉ khi fuel ≥ 30; đúng 30 vẫn còn | `AC-zone` | |
| AC-drain | wander → đèn yếu gần nhất (không có thì đèn tắt gần nhất); trong 2 m → `drain`; hút 5/s cộng dồn; `fuel_drain` mỗi 60 tick. Thoát: Mây ≤ 6 m → chase, Tỏa Sáng → stunned (tổng +15), đèn tắt hoặc được châm ≥ 30 → wander (kèm đẩy ra trong 30 tick, vô hại) | `AC-drain` ×4 | proof #4 |
| AC-stun | Hết choáng → wander | `AC-stun` | |
| AC-win | Thắng `dawn_survived` khi đèn sáng ở tick cuối ≥ ceil(0,6n) (3/5, 4/6, 5/7); thiếu → `dawn`; không thắng sớm; no_flames xét trước | `AC-win` ×2 | proof #1, #6 |
| AC-score | +5/đom đóm nạp, +100 thắp đầu, +40 thắp lại, +5 / +15 Tỏa Sáng; bình minh 50 + floor(fuel) mỗi đèn sáng + 50 mỗi lửa; bỏ thưởng thời gian | rải trong các test trên | proof #1 |
| AC-capacity | 10 + 2 × lần thắp thành công (kể cả thắp lại), tối đa 20; đèn đặt sẵn không tính | `AC-capacity` | proof #5 |
| AC-colorblind | Cài đặt được lưu; viền/mắt #00B3FF; cảnh báo trắng + ⚠; đèn tắt xẹp 20 % + rách; đèn yếu nhấp nháy 1 Hz | web-static `AC-colorblind`, webcheck "settings survive a reload" | `lanterns-fuel.png` |
| AC-contract | v1.2: tuning keys, snapshot `fuel`/`ever_lit`/`relit_count`/`capacity`, scenario fields, events | `v1.2 snapshot`, headless.test | |

## Giả định (B#)

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| B1 | Tốc độ `wander` | Giữ 1,5 m/s (A22). Đi tới đèn mục tiêu, dừng khi cách ≤ 2 m. Với đèn tắt thì chỉ lượn ở đó, không hút |
| B2 | Khi nào vào `drain` | Trong bước 8, khi `wander` có mục tiêu là đèn yếu và cách ≤ 2 m (XZ). Hút bắt đầu từ bước 2 của tick sau |
| B3 | `fuel_drain` | Mỗi Bóng Mực đếm số tick đã hút. Ghi sự kiện khi bộ đếm chia hết cho 60, với `fuel` là giá trị sau lần hút của tick đó (≥ 0) |
| B4 | `target_lantern_id` trong scenario | Được ưu tiên nếu đèn đó đang yếu; nếu không thì chọn lại theo luật. Snapshot luôn xuất `target_lantern_id` (null nếu không có) |
| B5 | Đèn `lit: true` trong scenario mà thiếu `ever_lit` | `ever_lit = true` |
| B6 | Châm dầu làm vùng an toàn kích hoạt | Mọi lần châm mà kết quả ≥ 30 đều đẩy Bóng Mực đang ở trong 6 m ra mép (bình thường không có con nào, vì vùng đã chặn) |
| B7 | "Đèn tắt xẹp và rách" | Áp dụng **luôn**, không chỉ trong chế độ mù màu, vì không xung đột với luật nào |
| B8 | Hết `recoil` hoặc `spawning` | Vẫn theo khoảng cách (A21/A22). Chỉ `stunned` mới luôn về `wander` |
| B9 | Bóng Mực đang `drain` có gây sát thương không | Không. Nó sẽ chuyển sang `chase` ở bước 8 khi Mây vào trong 6 m, trước bước xét va chạm |
| B10 | Khóa điểm mới trong tuning | `per_relight` 40, `per_stun_drain` 15 (tổng), `per_lit_at_dawn` 50; `per_second_left` = 0 |
| B11 | `deposited` khi đèn đang sáng | Giữ giá trị lúc thắp (10 hoặc 5); về 0 khi tắt |
| B12 | `fuel` trong scenario cho đèn `lit: false` | Bỏ qua (fuel 0) |

## Regression: test cũ bị luật mới làm sai {#regression}

Mỗi test bị đổi đều có ghi chú `P3:` trong mã nguồn.

| Test cũ | Xử lý | Lý do |
|---|---|---|
| sim.test `win: last lantern lit -> won …` | **Thay** bằng "lighting the last lantern no longer ends the night" | Ticket-03 §3: bỏ thắng sớm |
| phase2.test `AC-end … all lit on the last tick still wins` | **Thay** phần all_lit; giữ phần đẩy Bóng Mực khi đèn vừa thắp và phần no_flames | §3 |
| sim.test `deposit … +10 per mote` | Sửa thành +5; lần giữ phím tiếp theo giờ sinh **1 refuel** thay vì không có gì | §5, §1 |
| sim.test `default night 1 … 300 s` | 240 s | §3 |
| phase2.test `AC-nights … 330/360` | 270/300 | §3 |
| headless.test `contract version 1.1` | 1.2 | §7 |
| headless.test `contract example` snapshot đèn | Thêm `fuel`, `ever_lit`, `relit_count` | §7 |
| headless.test `full night 3 … 21600` | 18 000 tick (300 s), kết thúc bằng game_over lúc bình minh | §3 |
| proof `win_all_lit` (Phase 2 #1) | **Xóa**, thay bằng `dawn_win` | §3 |
| proof `pause` (time 299,5) | Tính theo `night1_duration_s` | §3 |

Không có test nào bị skip. Bằng chứng Phase 1 và Phase 2 vẫn được giữ trong `docs/proof/phase-1|2`, vì chúng khớp với tag của phase đó.
