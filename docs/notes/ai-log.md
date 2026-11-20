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
