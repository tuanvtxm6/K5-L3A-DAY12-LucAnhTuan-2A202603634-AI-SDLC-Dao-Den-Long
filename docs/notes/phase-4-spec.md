# Phase 4 (Ticket-04 "Bình minh: phát hành v1.0.0"): spec, acceptance criteria, assumptions

## Acceptance criteria

| AC | Yêu cầu | Kiểm chứng | Bằng chứng |
|---|---|---|---|
| AC-bench scene | Đêm 1; 200 Bóng Mực ở trạng thái wander rải đều (seed 42); 100 đom đóm; L1–L3 sáng dầu 100. Tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm | phase4.test `AC-bench scene`, `AC-bench rules` ×2 | [bench-scene.png](../proof/phase-4/bench-scene.png) |
| AC-bench camera | r = 30, Y = 15, bắt đầu ở (30, 15, 0), ngược chiều kim đồng hồ nhìn từ trên, 15 s một vòng, luôn nhìn vào (0,0,0) | `AC-bench camera` | |
| AC-bench stats | avg_fps = 1000N/Σdt; p1_low = 1000/mean(k frame chậm nhất, k = max(1, ceil(0,01N))); p95 của dt | `AC-bench stats` | |
| AC-bench run | Cửa sổ 1280×720, vsync tắt, khởi động 3 s, đo `--duration` s, thoát mã 0, ghi bench.json đủ trường | chạy thật | [bench.json](../proof/phase-4/bench.json) |
| AC-soak | N Đêm trong một tiến trình, xoay vòng 1 → 2 → 3, seed + i, input ngẫu nhiên theo seed; crashes = 0; mem_end ≤ 1,2 × mem_start | `AC-soak` (4 Đêm, chạy 2 lần) + chạy thật 10 Đêm | [soak.json](../proof/phase-4/soak.json) |
| AC-lb | Tên 3–12 ký tự `[A-Za-z0-9_]`, tiếng Việt được chấp nhận; mục lưu name/score/nights_won/achieved_at (ISO 8601 có múi giờ)/seed; top 10; điểm giảm dần, bằng điểm thì ai đạt trước đứng trên; lưu trên đĩa; màn hình từ menu; lệnh export | `AC-lb` ×4, webcheck (lưu, highlight, API, màn hình menu) | |
| AC-a11y keys | Đổi phím 9 hành động, báo trùng phím, khôi phục mặc định, được lưu | webcheck "rebinding …" ×2 | |
| AC-a11y cues | Phụ đề và chỉ báo cho Bóng Mực xuất hiện (+ mũi tên mép màn hình), gió sắp thổi, 10 s cuối, đèn fuel < 30 | webcheck "captions …" ×2 | |
| AC-a11y motion | Giảm chuyển động tắt rung camera và chớp màn hình (được lưu) | webcheck "screen flash …", "reduce motion …"; web-static | |
| AC-a11y text | Chữ UI ≥ 18 px ở 1280×720; chữ lớn ×1,25 | webcheck đo font-size đã render; web-static quét CSS | |
| AC-package | Clone sạch → ≤ 3 lệnh → chơi được; Release có bản chạy được | Zip giải nén ở thư mục sạch → `node scripts/serve.js` trả 200 và headless chạy được | |
| AC-contract | v1.3, có bench_cmd, soak_cmd; v1.0–v1.2 giữ nguyên | headless.test, proof 25/25 | |

## Giả định (C#)

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| C1 | "Bóng Mực vẫn di chuyển theo luật wander" trong khi Mây đứng ở (0,0,0) | Trong bench, Bóng Mực **không** chuyển sang chase khi thấy Mây (đây là luật phát hiện A22 của mình, không phải luật wander). Như vậy cảnh đo không có đám Bóng Mực dồn vào giữa |
| C2 | "Rải đều trên đảo" | Phân bố đều theo diện tích trên đĩa bán kính 38 m (r = √u · 38), cùng một RNG seed 42 cho cả 200 Bóng Mực và 100 đom đóm |
| C3 | Chiều "ngược chiều kim đồng hồ khi nhìn từ trên" | Cùng quy ước góc với bản đồ (A28): từ +X quay về +Z. Sau 3,75 s camera ở (0, 15, 30) |
| C4 | `load_ms` | Từ lúc tiến trình `bench.js` khởi động (`Date.now() − process.uptime()`) tới frame đầu tiên của cảnh bench (`Date.now()` trong trang) |
| C5 | `peak_mem_mb` cho bản web | Tổng RSS của cây tiến trình Chrome (browser, GPU, renderer…) lấy mẫu trong lúc đo: `ps` mỗi 0,5 s trên macOS/Linux, `Get-CimInstance` mỗi 2 s trên Windows (nặng hơn nên lấy thưa hơn) |
| C6 | Cửa sổ 1280×720 | Cửa sổ `--window-size=1280,720`, và viewport bị ép đúng 1280×720 qua `Emulation.setDeviceMetricsOverride` để canvas đúng kích thước dù cửa sổ có viền |
| C7 | Soak "Đêm thứ i dùng seed 7 + i" | i đếm từ 0, nên Đêm đầu dùng đúng seed 7 truyền vào |
| C8 | Input soak | Luồng RNG riêng `makeRng(seed ^ 0x5eed5eed)`. Mỗi 30 tick rút một hướng; mỗi tick rút theo thứ tự nhảy (5 %), lướt (3 %), tỏa sáng (2 %), tương tác (10 %) |
| C9 | mem_start / mem_end | Gọi `gc()` hai lần (cần `--expose-gc`, đã có trong `soak_cmd`) rồi mới đọc `process.memoryUsage().rss` |
| C10 | "Lưu trên đĩa cục bộ" cho một game web | Server cục bộ (`scripts/serve.js`) ghi `data/leaderboard.json`. Nếu trang được host tĩnh không có server thì dùng localStorage (cũng lưu trên đĩa của trình duyệt) |
| C11 | Điểm khi thua | score = tổng các Đêm **đã thắng** trong phiên; nights_won = số Đêm đã thắng |
| C12 | Tên tiếng Việt | Chuẩn hóa NFC, đếm theo code point, chấp nhận `\p{L}\p{M}\p{N}_` |

## Regression

| Test cũ | Xử lý | Lý do |
|---|---|---|
| headless.test `contract version 1.2` | 1.3 + kiểm tra có `bench_cmd`, `soak_cmd` | §6 |
| webcheck "lose (dawn) -> retry" | Màn thua có thêm ô nhập tên; nút đầu tiên giờ là "Lưu điểm" | §3 |
| webcheck "settings survive a reload" | Chỉ so các khóa cũ (cài đặt có thêm keys, reduceMotion, largeText) | §4 |
| webcheck URL `bench=1` | Đổi thành `fpsbot=1` | Tránh nhầm với cảnh benchmark chuẩn |

Không có luật gameplay nào của Phase 1–3 bị đổi. Proof headless 25/25 vẫn pass.
