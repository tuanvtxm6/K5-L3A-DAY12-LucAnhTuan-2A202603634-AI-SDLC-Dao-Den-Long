# Nhật ký dùng AI

Công cụ: Claude Code (VS Code extension), model Claude Opus 5.5.

## Phase 1

**Prompt chính:** "đọc lab board và codebase" → "ok làm đi, dùng Three.js".

**Cách làm:** đọc cả PRD-0 lẫn Test Contract trước khi viết code. Sau đó chốt kiến trúc: core JS thuần dùng chung cho headless và web. Viết logic và CLI, chạy thử ví dụ trong contract, rồi viết test theo từng luật. Tiếp theo là mutation check, chụp ảnh bản web, viết proof script, dựng harness và cuối cùng là tài liệu.

### Những lần AI sai và cách phát hiện

| # | Sai gì | Phát hiện bằng | Sửa / chỉnh harness |
|---|---|---|---|
| 1 | Dùng script inline để tách `headless.js` → `runner.js`, escape hỏng nên ra `process.stderr.write()` rỗng | Đọc lại file sau khi sinh | Sửa tay. Bài học: sửa nhiều dòng thì dùng Edit, không dùng script sed/node lồng nhau |
| 2 | `node --test tests/` (truyền thư mục) không chạy trên Node 24 | Chạy `npm test` | Đổi sang glob `tests/*.test.js`, ghim Node ≥ 22 trong `engines` và CI |
| 3 | Bộ test ban đầu (24 test, xanh ngay lần đầu) không bắt được lỗi "đèn chưa thắp cũng có vùng an toàn" | Mutation check: cố tình làm hỏng 3 luật | Thêm test `unlit lantern gives no protection`. Verify skill nhắc phải kiểm tra lại khi test xanh quá dễ |
| 4 | Cảnh web quá tối, đom đóm và đèn ở xa gần như không thấy | Xem ảnh chụp Chrome headless | Tăng ánh sáng, cho đom đóm không bị sương che. Thêm bước "nhìn ảnh trước khi khẳng định" vào skill verify |
| 5 | Bản nháp đầu của Stop hook có đoạn đọc stdin vô nghĩa | Đọc lại trước khi chạy | Viết lại bằng `readFileSync(0)`. Đã test cả 3 trạng thái: xanh, đỏ, và chống vòng lặp |
| 6 | Câu "Sáng tạo của tôi" ban đầu dẫn `git diff` làm bằng chứng, trong khi mọi thứ commit cùng lúc nên diff không chứng minh được gì | Tự rà soát README | Đổi sang bằng chứng kiểm được: `grep` cho thấy core không import web, cộng với hash output |

### Token / chi phí

- Đo bằng `/usage` của Claude Code (gói subscription, không tính theo USD) lúc kết thúc Phase 1, ngày 2026-11-20: đã dùng **11 % quota phiên** (5 giờ) và **9 % quota tuần**. Toàn bộ chạy trên Opus, haiku 0 %, cache hit 97 %. Trong 24 giờ qua có 124 request trên 5 phiên, nhưng con số này gồm cả các phiên khác trên máy, nên chỉ dùng % phiên làm số chính.
- Gợi ý của `/usage`: `/clear` khi đổi việc, giảm output Bash dài. Phase 2 sẽ áp dụng: mở phiên mới cho mỗi phase, lọc output test bằng `grep`/`tail`.

## Phase 2

**Prompt chính:** "đọc phase 2 trên lab board rồi làm tiếp", kèm nội dung Ticket-02 được dán vào.

**Cách làm:**
- Lab board giấu nội dung Ticket-02 trong database của artifact. Agent không đọc được nên người dán vào tay.
- Chốt thiết kế trước rồi mới code: số chuẩn → `maps.js` → viết lại `sim.js` theo 12 bước → validate và runner → test (Phase 1 sửa có lý do, Phase 2 mới) → mutation check → web → kiểm tra trên Chrome → proof → tài liệu.

### Những lần AI sai và cách phát hiện

| # | Sai gì | Phát hiện bằng | Sửa / chỉnh harness |
|---|---|---|---|
| 7 | Runner dừng vòng lặp khi `state !== 'playing'`, nên sẽ dừng luôn khi game bị pause | Rà lại runner trước khi chạy | Đổi điều kiện thành "chưa won/lost" và thêm test pause qua CLI |
| 8 | 5 test mới tính sai số tick: bộ đếm giảm ở bước 2, quên rằng Bóng Mực bước tới trước khi hit, đo vị trí khi còn đang bị đẩy | Test đỏ. Phân tích từng cái thì code đúng, test sai | Sửa test. Thêm vào AGENTS.md: "kiểm tick arithmetic của test trước" |
| 9 | Một test kỳ vọng "no_flames thắng all_lit" khi thắp đèn lúc đang bị chạm; thật ra luật vùng an toàn làm Bóng Mực vô hại | Test đỏ, đọc lại ticket | Đổi test thành kiểm tra đúng hành vi đó, cộng một test no_flames riêng |
| 10 | 2 mutant lọt qua: lướt lại khi đang lướt (có bùa), rơi bị bất tử chặn | Mutation check | Thêm 2 test. Skill verify bắt buộc bước mutation |
| 11 | Script webcheck: thiếu `awaitPromise`, helper `key()` không nhúng mã phím | Bước flow FAIL ngay, có thông báo exception | Sửa script; giờ evaluate trả lỗi rõ ràng |
| 12 | Cảnh Đêm 3 quá tối (ambient 0,15 theo chuẩn) | Xem ảnh chụp | Tăng ánh trăng và đèn của Mây (A35) |
| 13 | Proof ghi "state recoil" mà không kiểm | Tự rà output | Thêm assert thật cho trạng thái |
| 14 | Lần chạy perf ghi file JSONL 70 MB vào thư mục proof | `du` trước khi commit | Thêm `.gitignore` cho `runs/perf_*` |
| 15 | Dốc Đêm 3 hiển thị **ngược**: mesh cao ở phía ngoài, trong khi sim cao ở phía trong. Luật vẫn đúng nên vẫn leo được. Lỗi lọt qua vì ảnh chụp không nhìn từ phía chân dốc và không có kiểm tra hình học | **Người chơi thử** sau khi đã gắn tag `phase-2` | Viết bước webcheck so độ cao hai đầu mesh với `map.surface` (FAIL trước, PASS sau), đổi dấu góc nghiêng. Thêm `?at=&yaw=` để chụp đúng chỗ. Gắn lại tag `phase-2` vào commit sửa, trước hạn (SUBMISSION §5 cho phép) |

### Token / chi phí

- Đo bằng `/usage` lúc kết thúc Phase 2 (2026-11-20): **34 % quota phiên** (5 giờ) và **12 % quota tuần**. Lúc kết thúc Phase 1 là 11 % và 9 %, nên **Phase 2 tốn khoảng 23 điểm % quota phiên và 3 điểm % quota tuần**, gấp khoảng 2 lần Phase 1. Lý do: ticket lớn hơn (3 bản đồ, 6 tính năng, web viết lại), cộng thêm vòng kiểm tra trên Chrome.
- `/usage` gợi ý 69 % chi phí 24 giờ qua đến từ việc không `/clear` khi đổi việc. Phase 1 và 2 chạy chung một phiên nên ngữ cảnh dài dần. Phase 3 sẽ mở phiên mới, chỉ nạp AGENTS.md và spec của phase hiện tại.
- Cách tiết kiệm:
  - Nội dung ticket được dán thẳng, không phải dò.
  - Viết code theo khối lớn đã thiết kế sẵn thay vì sửa vặt nhiều vòng.
  - Output test được lọc bằng `grep`.
  - Chỉ xem 4 ảnh chụp có chọn lọc.
  - Không dùng subagent.
- Cách tiết kiệm: đọc lab board một lần rồi trích ra text (13 KB thay vì 180 KB HTML). Không dùng subagent. Test được chạy với output đã lọc (`grep`/`tail`) thay vì log đầy đủ. Ảnh chụp chỉ để kiểm tra phần hiển thị.

## Phase 3

**Prompt chính:** nội dung Ticket-03 được dán vào (change request: đèn có nhiên liệu, thắng lúc bình minh).

**Cách làm:**
- Phase này chỉ có khoảng 30 phút, nên sửa `sim.js` bằng các Edit nhỏ thay vì viết lại.
- Thứ tự: tuning → mô hình đèn → AI Bóng Mực → luật thắng.
- Chạy test cũ trước để thấy test nào bị luật mới làm sai (8 test), rồi sửa từng cái kèm ghi chú `P3:`.
- Viết 15 test mới → mutation check → proof → web (thanh dầu, mù màu) → kiểm tra trên Chrome → ADR, CHANGELOG.

### Những lần AI sai và cách phát hiện

| # | Sai gì | Phát hiện bằng | Sửa / chỉnh harness |
|---|---|---|---|
| 16 | Một phép thay chuỗi trong script không khớp nhưng không báo lỗi, nên test mù màu **không được thêm** mà vẫn tưởng đã thêm | Số test là 69 thay vì 70 | Thêm lại bằng Edit; kiểm tra số test sau mỗi lần thêm |
| 17 | Script chụp ảnh đổi vị trí đèn trong sim sau khi mesh đã dựng xong, nên ảnh chỉ có 1 đèn | Xem ảnh | Gọi `world.build()` sau khi đặt trạng thái |
| 18 | Pha "tắt" của nhịp nháy và vết rách trên đèn tắt gần như không thấy | Xem ảnh | Đổi màu đèn ở pha tắt; thêm vết rách ở cả hai mặt. Vẫn còn khó thấy ở xa (đã ghi) |
| 19 | Proof còn để cứng `time_left 299.5` của Đêm 300 s | Proof FAIL | Tính theo `night1_duration_s` |
| 20 | Mutant "hết choáng xét theo khoảng cách" không bị test bắt | Mutation check | Phân tích thì đây là mutant **tương đương** (bước 8 cùng tick cho kết quả như nhau), nên ghi chú thay vì viết test vô nghĩa. AGENTS.md thêm quy tắc giải thích mutant tương đương |

### Token / chi phí

- Đo bằng `/usage` khi kết thúc Phase 3 (2026-11-20): **53 % quota phiên**, **15 % quota tuần**. Phase 3 tốn khoảng **19 điểm % quota phiên** (từ 34 % lên 53 %) và **3 điểm % quota tuần**, ít hơn Phase 2 (23 điểm) dù đây là change request, nhờ sửa bằng Edit nhỏ thay vì viết lại.
- `/usage` cho thấy 83 % chi phí 24 giờ qua vẫn đến từ việc không `/clear`, vì cả 3 phase chạy chung một phiên với ngữ cảnh ngày càng dài. Đây là điểm cần sửa nhất cho Phase 4: mở phiên mới, chỉ nạp AGENTS.md, CHANGELOG và spec Phase 3.
- Cách tiết kiệm: không đọc lại file lớn, chỉ Edit đúng hàm cần đổi. Output test luôn được lọc. Webcheck có `FLOW_ONLY=1` để bỏ qua bước đo FPS khi chỉ cần kiểm tra luồng.

## Phase 4

**Prompt chính:** nội dung Ticket-04 được dán vào (bench, soak, bảng xếp hạng, a11y, phát hành).

**Cách làm:**
- Core trước: cờ bench trong sim, `bench.js` (cảnh chuẩn + thống kê), `leaderboard.js`, soak.
- Sau đó: bench chạy Chrome thật qua CDP → server có API bảng xếp hạng → UI (bảng xếp hạng, đổi phím, phụ đề, giảm chuyển động, cỡ chữ) → webcheck thêm 10 bước.
- Tiếp theo: test Phase 4 + mutation → chạy bench/soak thật → gói Release → tài liệu và retro.

### Những lần AI sai và cách phát hiện

| # | Sai gì | Phát hiện bằng | Sửa / chỉnh harness |
|---|---|---|---|
| 21 | Hai lần ghi file bằng heredoc trong bash bị lỗi trích dẫn (chuỗi có backtick và regex) | Lệnh lỗi | Ghi khối code bằng Write rồi ghép bằng script node |
| 22 | Lấy mẫu RSS bằng PowerShell `Get-CimInstance` mỗi 0,5 s làm giật khung hình | `p1_low_fps` thấp bất thường (94) | Lọc chỉ lấy chrome.exe, giãn ra 2 s → 136,5 |
| 23 | Tác vụ nền báo server đã dừng nhưng tiến trình vẫn giữ cổng 5173 | `EADDRINUSE` | Tìm PID qua `netstat` rồi tắt |
| 24 | `package.js` gọi `tar` của Git Bash (GNU, không tạo được zip) | Lỗi `zip ENOENT` | Dùng `System32\tar.exe` trên Windows |
| 25 | Phụ đề trùng nội dung chồng lên nhau, đẩy mất cảnh báo cạn dầu (lỗi UX thật) | webcheck FAIL | Phụ đề trùng chỉ gia hạn thời gian hiển thị |
| 26 | Test tính sai hạng (13 thay vì 11, vì quên rằng chỉ giữ 10 mục) | Test đỏ | Sửa test |
| 27 | Mutant "bench vẫn sinh thực thể" sống, vì cảnh chuẩn đã tắt sẵn cờ random | Mutation check | Thêm test bench trên cảnh mặc định |
| 28 | Bóng Mực trong bench chuyển sang chase khi thấy Mây (luật A22) | Chạy thử cảnh bench | Bench giữ wander (C1) + mutation test |

### Token / chi phí

- Đo bằng `/usage` khi kết thúc Phase 4 (2026-11-20): **75 % quota phiên**, **17 % quota tuần**, 100 % Opus, cache hit 99 %. Phase 4 tốn khoảng **22 điểm % quota phiên** (từ 53 % lên 75 %) và **2 điểm % quota tuần**.
- **Tổng cả lab:** khoảng 75 % một quota phiên 5 giờ (11 + 23 + 19 + 22 điểm), và quota tuần tăng từ 9 % lên 17 % qua Phase 2–4. `/usage` báo 94 % chi phí 24 giờ qua đến từ việc không `/clear`: cả 4 phase chạy chung một phiên. Đây là bài học lớn nhất về token (xem [retro](retro.md)).
- Cách tiết kiệm: tái dùng webcheck và proof sẵn có; `FLOW_ONLY=1` khi chỉ cần kiểm tra luồng; chạy bench 5 s để thử trước khi chạy thật 30 s.
