# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4)_ · **Phase hiện tại:** 2 (Ticket-02, Contract v1.1) · Đề lab: [docs/lab/](docs/lab/LAB-README.md)

Game 3D góc nhìn thứ ba viết bằng Three.js. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại các Đèn Lồng Lớn trên **3 hòn đảo**, tránh Bóng Mực và Gió Lạc trong sương đen. Mọi luật chơi nằm trong một module JS thuần ([src/core/sim.js](src/core/sim.js)). Bản web và chế độ headless dùng chung module đó, nên điều đã kiểm chứng ở headless cũng chính là luật mà bản web chạy.

## Cài đặt và chạy (macOS / Linux, cần Node ≥ 22)

```bash
npm install
npm start          # mở http://localhost:5173
```

Kiểm thử: `npm test` (54 test) · Bằng chứng headless: `npm run proof` · Kiểm tra trên trình duyệt: `npm run webcheck` (cần Chrome và server đang chạy).

## Điều khiển

| Phím | Việc |
|---|---|
| `W A S D` / `↑ ↓` | Đi theo hướng camera |
| Kéo chuột / `← →` | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| `Space` | Nhảy (chỉ khi đang chạm đất) |
| `Shift` | Lướt: 14 m/s trong 0,2 s, hồi chiêu 1,5 s |
| `E` | Nạp ánh sáng vào đèn ở gần (≤ 2 m) |
| `Q` | Tỏa Sáng: tốn 3 đom đóm, làm choáng Bóng Mực trong 5 m |
| `Esc` / `P` | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| `F3` | Hiện FPS |

## Ba Đêm

| Đêm | Đảo | Đèn | Thời gian | Điểm mới |
|---|---|---|---|---|
| 1 | Đảo Bến: đảo tròn 40 m | 5 | 300 s | |
| 2 | Đảo Cau: 2 đảo nối bằng cầu tre | 6 | 330 s | Bục nhảy, Gió Lạc, Bùa Gió |
| 3 | Đảo Chuông: 3 tầng, dốc, tháp chuông | 7 | 360 s | Gió mạnh mỗi 30 s, Bóng Mực 4,5 m/s |

Menu → giới thiệu Đêm (lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. Thắng Đêm 3 thì tới màn **Bình Minh** với tổng điểm. Thua thì chơi lại Đêm đó.

## Luật chơi và điểm (số chuẩn Ticket-02)

- Đi qua đom đóm để nhặt, mang tối đa **10** con. Mỗi đèn cần **10** đom đóm, nạp nhiều lần được.
- Có **3 Ngọn Lửa**, hồi đầy đầu mỗi Đêm. Bóng Mực chạm thì mất 1 lửa và rơi một nửa số đom đóm ra mặt đất (nhặt lại được trong 8 s), sau đó bất tử 1,5 s.
- Rơi khỏi đảo thì mất 1 lửa và toàn bộ đom đóm, sau 1 s hồi sinh ở điểm xuất phát.
- Đèn đã thắp tạo vùng an toàn 6 m mà Bóng Mực không vào được.
- **Gió Lạc** cướp 3 đom đóm khi Mây mang từ 5 con trở lên. Tỏa Sáng trúng nó thì nó thả lại những gì đã cướp.
- **Bùa Gió** cho 10 s chạy 7,2 m/s và lướt không hồi chiêu.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm **nạp** vào đèn | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng | +5 |
| Khi thắng: mỗi giây còn lại | +2 |
| Khi thắng: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game là tổng điểm các Đêm đã thắng. Mọi con số nằm trong [src/core/tuning.js](src/core/tuning.js) và trùng khớp với [game.contract.json](game.contract.json). Giả định cho những chỗ ticket chưa nói rõ: [Phase 1](docs/notes/phase-1-assumptions.md), [Phase 2](docs/notes/phase-2-spec.md).

## Test Contract v1.1 (headless)

```bash
node src/headless.js --seed 1 --night 2 --ticks 600 --out out.jsonl \
  [--scenario tests/scenarios/drifter.scenario.json] [--inputs tests/scenarios/drifter.inputs.json] [--snapshot-every 10]
```

- `--night` nhận 1, 2 hoặc 3. Logic chạy cố định 60 tick/giây, không cần cửa sổ hay GPU. Một Đêm 3 đầy đủ (21 600 tick, snapshot mỗi tick) chạy hết 0,58 s.
- Exit `0` khi chạy xong, `2` khi file inputs/scenario sai định dạng, `1` khi tham số CLI sai.
- Tất định: cùng seed, scenario và inputs cho ra output giống hệt từng byte. CI chạy trên Linux và macOS rồi so output với bản đã commit.

## Bằng chứng

| Phase | Kết quả | Chi tiết |
|---|---|---|
| 1 | 25/25 test, 7/7 scenario (số Phase 1, tag `phase-1`) | [docs/proof/phase-1/](docs/proof/phase-1/README.md) |
| 2 | 54/54 test, 20/20 scenario, 11/11 bước flow trên Chrome, ~165 FPS ở 1280×720 | [docs/proof/phase-2/](docs/proof/phase-2/README.md) |

## Sáng tạo của tôi

Tất cả nằm ở lớp hiển thị ([web/](web/)), không đụng vào `src/core`, nên output headless không đổi.

- **Đảo sáng dần:** sương tan bớt theo số đèn đã thắp. Đèn chưa thắp ấm dần theo lượng ánh sáng đã nạp. Đèn đã thắp có vòng sáng đánh dấu vùng an toàn.
- **Ông Đăng** dẫn chuyện ở màn giới thiệu mỗi Đêm.
- **Âm thanh tổng hợp bằng WebAudio** (không dùng file asset): nhạc nền ngũ cung và tiếng gió dùng nhiễu lọc.
- Gió Lạc là dải lụa uốn lượn, và hiện đốm sáng khi đang giữ đom đóm vừa cướp.

Bằng chứng phần lõi vẫn đúng: `grep -rnE "^import .*web/" src/` không ra kết quả. Proof 20/20, test 54/54, và output headless tất định ở cả 3 Đêm.

## Harness AI

| Thành phần | Dùng khi |
|---|---|
| [AGENTS.md](AGENTS.md) (CLAUDE.md import lại) | Mọi phiên: lệnh, cấu trúc, thứ tự tick, quy tắc test |
| [.claude/skills/verify](.claude/skills/verify/SKILL.md) | Sau khi đổi luật, bản đồ, CLI hoặc UI; trước khi gắn tag |
| [Stop hook](.claude/settings.json) → [scripts/stop-gate.js](scripts/stop-gate.js) | Tự động: chặn agent kết thúc khi `npm test` đỏ |
| [scripts/webcheck.js](scripts/webcheck.js) | Agent tự chạy game trong Chrome thật: ảnh, kiểm tra flow, FPS |
| [CI](.github/workflows/ci.yml) | Mỗi lần push: test, proof, kiểm tra tất định trên Linux và macOS |
