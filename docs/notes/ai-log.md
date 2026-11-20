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
- Cách tiết kiệm: đọc lab board một lần rồi trích ra text (13 KB thay vì 180 KB HTML). Không dùng subagent. Test được chạy với output đã lọc (`grep`/`tail`) thay vì log đầy đủ. Ảnh chụp chỉ để kiểm tra phần hiển thị.
