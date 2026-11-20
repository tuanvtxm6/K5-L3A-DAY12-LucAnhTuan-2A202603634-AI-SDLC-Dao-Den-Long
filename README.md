# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4)_ · **Phase hiện tại:** 1 (PRD-0) · Đề lab: [docs/lab/](docs/lab/LAB-README.md)

Game 3D góc nhìn thứ ba viết bằng Three.js. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại 5 Đèn Lồng Lớn trên Đảo Bến và tránh Bóng Mực trong sương đen. Toàn bộ luật chơi nằm trong một module JS thuần ([src/core/sim.js](src/core/sim.js)). Bản web và chế độ headless dùng chung module này, nên điều đã kiểm chứng ở headless cũng chính là luật mà bản web chạy.

## Cài đặt và chạy (macOS / Linux, cần Node ≥ 22)

```bash
npm install
npm start          # mở http://localhost:5173
```

Kiểm thử: `npm test` (25 test) · Bằng chứng: `npm run proof` · Headless: xem phần [Test Contract](#test-contract-headless).

## Điều khiển

| Phím | Việc |
|---|---|
| `W A S D` / `↑ ↓` | Đi theo hướng camera |
| Kéo chuột / `← →` | Xoay camera |
| `Space` | Nhảy |
| `E` | Nạp ánh sáng vào đèn ở gần (≤ 2,5 m) |
| `Q` | Tỏa sáng: tốn 1 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 6 m |
| `Enter` / `R` | Bắt đầu / chơi lại |

## Luật chơi và cách tính điểm

- Đi qua đom đóm (≤ 1 m) để nhặt, mang tối đa **5** con.
- Mỗi đèn cần **5** đom đóm, có thể nạp làm nhiều lần. Thắp đủ **5 đèn** thì thắng.
- Bóng Mực đuổi theo Mây với tốc độ 3,5 m/s (Mây chạy 6 m/s). Bị chạm thì mất **1 lửa** và rơi **50 %** số đom đóm đang mang, sau đó được miễn nhiễm 1,5 s. Hết **3 lửa** thì thua.
- Bóng Mực không vào được vùng **5 m** quanh đèn **đã thắp**.
- Đêm dài **300 s**. Tới bình minh mà chưa thắp hết đèn thì thua.

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực bị làm choáng | +20 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi lửa còn lại | +50 |

Mọi con số ở trên đều nằm trong [src/core/tuning.js](src/core/tuning.js) và được khai báo y hệt trong [game.contract.json](game.contract.json); test kiểm tra hai nơi này luôn khớp nhau. Các giả định cho những chỗ PRD-0 còn mơ hồ được ghi ở [docs/notes/phase-1-assumptions.md](docs/notes/phase-1-assumptions.md).

`fall_enabled = false`: đảo có bờ chặn, người chơi và Bóng Mực không rơi ra ngoài được, nên không có sự kiện `player_hit` với `by: "fall"`.

## Test Contract (headless)

```bash
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario tests/scenarios/win_all_lit.scenario.json] [--inputs tests/scenarios/win_all_lit.inputs.json] [--snapshot-every 10]
```

- Không cần cửa sổ hay GPU. Một đêm 18 000 tick, snapshot mỗi tick, chạy khoảng 0,26 s (i5-13500HX, Node 24).
- Exit `0` khi chạy xong, `2` khi file inputs/scenario sai định dạng, `1` khi tham số CLI sai.
- Tất định: cùng seed, scenario và inputs cho ra output giống hệt từng byte. CI chạy trên Linux và macOS và so output với bản đã commit.

## Bằng chứng

| Phase | Kết quả | Chi tiết |
|---|---|---|
| 1 | 25/25 test, 7/7 scenario | [docs/proof/phase-1/](docs/proof/phase-1/README.md) |

## Sáng tạo của tôi

Các phần thêm chỉ nằm ở lớp hiển thị ([web/main.js](web/main.js)), không đụng vào `src/core`, nên output headless không đổi.

- **Đảo sáng dần:** mỗi đèn được thắp làm trời sáng hơn và sương tan bớt. Đèn chưa thắp phát sáng theo tỉ lệ đã nạp, đèn đã thắp có vòng sáng đánh dấu vùng an toàn.
- **Chiếc đèn trên nón lá của Mây** sáng hơn theo số đom đóm đang mang.
- **Âm thanh tổng hợp bằng WebAudio** (không dùng file asset) cho các sự kiện nhặt, nạp, thắp, tỏa sáng, bị chạm và Bóng Mực xuất hiện. Kèm theo đó là vòng sáng khi tỏa sáng và Bóng Mực mờ đi khi bị choáng.

Bằng chứng phần lõi vẫn đúng: headless không tải file nào trong `web/` (`grep -rnE "^import .*web/" src/` không ra kết quả). Test vẫn 25/25, `npm run proof` vẫn 7/7, và output tất định có hash `a17196fed5878156` (seed 7).

## Cấu trúc

```text
src/core/      sim.js (luật), tuning.js (số), rng.js, validate.js
src/           headless.js, runner.js
web/           index.html, main.js (Three.js renderer + input)
tests/         *.test.js, scenarios/
scripts/       serve.js, proof.js, stop-gate.js (hook)
docs/notes/    giả định, nhật ký AI, đánh giá
docs/proof/    bằng chứng từng phase
AGENTS.md, CLAUDE.md, .claude/ (skill verify, Stop hook), .github/workflows/ci.yml
```

## Harness AI

| Thành phần | Dùng khi |
|---|---|
| [AGENTS.md](AGENTS.md) (CLAUDE.md import lại) | Mọi phiên: lệnh, cấu trúc, quy tắc tick/contract |
| [.claude/skills/verify](.claude/skills/verify/SKILL.md) | Sau khi đổi luật/tuning/CLI, trước khi gắn tag |
| [Stop hook](.claude/settings.json) → [scripts/stop-gate.js](scripts/stop-gate.js) | Tự động: chặn agent kết thúc khi `npm test` đỏ |
| [CI](.github/workflows/ci.yml) | Mỗi lần push: test, proof, kiểm tra output tất định trên Linux và macOS |
