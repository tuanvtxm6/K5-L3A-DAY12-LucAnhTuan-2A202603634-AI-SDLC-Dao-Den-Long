# Changelog

## [1.0.0] — Phase 4 (Ticket-04 "Bình minh: phát hành v1.0.0", Contract v1.3)

### Breaking changes

- **`game.contract.json`:** `contract_version` "1.3"; thêm `bench_cmd` (`node scripts/bench.js`) và `soak_cmd` (`node --expose-gc scripts/soak.js`). **`run_cmd` đổi từ `npm start` sang `node scripts/serve.js`**, để tham số `--export-leaderboard out.json` được truyền thẳng vào script (npm sẽ nuốt tham số đó).
- **Phím mặc định của Tạm dừng** là `P` (đổi được); `Esc` luôn tạm dừng. Phím `↑ ↓` không còn là phím di chuyển phụ; `← →` vẫn xoay camera.
- **URL debug `?bench=1`** (bot đo FPS của webcheck) đổi tên thành `?fpsbot=1`. `?benchmark=1` là cảnh benchmark chuẩn của ticket.
- **Seed trên web** giờ là seed của cả phiên chơi: Đêm n dùng `seed + n − 1`. Seed này được lưu vào bảng xếp hạng.

### Added

- **Benchmark** (`scripts/bench.js`): mở cửa sổ Chrome thật 1280×720, vsync tắt, chạy cảnh chuẩn (200 Bóng Mực ở trạng thái wander, 100 đom đóm, L1–L3 sáng), camera bay vòng r = 30 m ở Y = 15. Khởi động 3 s, đo `--duration` s, ghi `bench.json` (avg_fps, p1_low_fps, frame_ms_p95, frames, load_ms, peak_mem_mb theo RSS cây tiến trình Chrome).
- **Chế độ bench trong sim** (`new Game({ bench: true })`): tắt sinh thực thể, sát thương, nhặt đom đóm, hao dầu và điều kiện kết thúc Đêm. Bóng Mực vẫn di chuyển theo luật wander. Không ảnh hưởng gì tới output headless.
- **Soak** (`scripts/soak.js`): N Đêm trong một tiến trình, input ngẫu nhiên theo seed, ghi `soak.json` (crashes, results, mem_start_mb/mem_end_mb, duration_s).
- **Bảng xếp hạng cục bộ:** top 10 lưu ở `data/leaderboard.json` qua API của `scripts/serve.js`; nhập tên sau Bình Minh hoặc sau khi thua; có màn hình riêng từ menu; lệnh `--export-leaderboard`.
- **Dễ tiếp cận:** đổi phím cho 9 hành động (báo trùng, khôi phục mặc định); phụ đề và mũi tên cho Bóng Mực xuất hiện, gió sắp thổi, 10 giây cuối, đèn sắp cạn hoặc đã tắt; giảm chuyển động; chữ tối thiểu 18 px, tùy chọn chữ lớn ×1,25.
- **Phát hành:** `scripts/package.js` tạo `dist/dao-den-long-v1.0.0.zip` (chạy được chỉ với Node, không cần `npm install`); thêm `Dockerfile`.
- Rung camera và chớp màn hình khi bị chạm hoặc khi Tỏa Sáng (phần sáng tạo, tắt được).

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
