# Changelog

## [0.3.0] — Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2)

### Breaking changes

- **Bỏ thắng sớm.** `game_over.reason` không còn `all_lit`. Thắng = `dawn_survived` khi hết giờ mà số đèn sáng ≥ ceil(0,6 × tổng đèn) (Đêm 1: 3/5, Đêm 2: 4/6, Đêm 3: 5/7). Ngược lại thua với `dawn`. Hết lửa vẫn là `no_flames` và luôn được xét trước.
- **Đèn tắt được.** Đèn đang sáng mất 1 dầu/giây; dầu ≤ 0 thì đèn tắt, kèm sự kiện `lantern_out` và `deposited = 0`. Thắp lại chỉ cần 5 đom đóm.
- **Đèn sáng nhận thêm đom đóm** (châm dầu, sự kiện `refuel`). Trước đây đèn đã sáng thì không nhận gì nữa.
- **Vùng an toàn chỉ còn khi dầu ≥ 30.** Bóng Mực vào được đèn yếu và hút dầu (trạng thái mới `drain`, sự kiện `fuel_drain`).
- **Điểm mới:** mỗi đom đóm nạp vào đèn +5 (trước là +10); thắp lần đầu +100; thắp lại +40; Tỏa Sáng trúng Bóng Mực đang drain được tổng +15. Lúc thắng: mỗi đèn sáng +50 + floor(dầu), mỗi lửa +50. **Bỏ thưởng theo giây còn lại.**
- **Thời lượng Đêm:** 240 / 270 / 300 s (trước là 300 / 330 / 360).
- **Sức chứa** không còn cố định 10: = 10 + 2 × số lần thắp thành công, tối đa 20.
- **`lantern_lit`** có thêm trường `relight`.
- **Snapshot:** mỗi đèn thêm `fuel`, `ever_lit`, `relit_count`; `player` thêm `capacity`; Bóng Mực có thêm trạng thái `drain` (và trường `target_lantern_id`).
- **Scenario:** đèn nhận thêm `fuel` và `ever_lit` (đèn `lit` không có `fuel` thì mặc định 100); `player.successful_lights`; `shades[].target_lantern_id`. Một `shades[].state` có giá trị `drain` mà thiếu `target_lantern_id` → exit 2.
- **Bóng Mực `wander`** đi tới đèn yếu gần nhất, nếu không có thì về đèn tắt gần nhất (trước là đi tới một điểm ngẫu nhiên). Hết choáng thì luôn về `wander`.
- **`game.contract.json`:** `contract_version` "1.2", thêm các khóa tuning `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`. `score.per_second_left` = 0, và thêm `per_relight`, `per_stun_drain`, `per_lit_at_dawn`.

### Added

- Thanh dầu trên đèn đang sáng; đèn và thanh dầu nhấp nháy 1 Hz khi dầu < 30.
- Chế độ "Bảng màu dễ phân biệt" (được lưu): viền và mắt Bóng Mực #00B3FF; cảnh báo UI màu trắng kèm ⚠. Đèn tắt bị xẹp 20 % và có vết rách giấy.
- HUD: "Đèn sáng k/n · cần m", số đang mang / sức chứa, gợi ý "E — Châm dầu", mũi tên chỉ cả đèn tắt lẫn đèn yếu.
- ADR [docs/adr/0001](docs/adr/0001-lantern-fuel-and-dawn-win.md).

### Fixed

- Mesh dốc ở Đêm 3 bị nghiêng ngược (fix đưa vào tag `phase-2`).

## [0.2.0] — Phase 2 (Ticket-02, Contract v1.1)

Số liệu chuẩn, 3 Đêm, lướt, bục nhảy, rơi khỏi đảo, Gió Lạc, Bùa Gió, gió, tạm dừng, cài đặt, HUD, bảng màu. Xem [phase-2-spec](docs/notes/phase-2-spec.md).

## [0.1.0] — Phase 1 (PRD-0, Contract v1.0)

Bản chơi được đầu tiên của Đêm 1 cùng chế độ headless.
