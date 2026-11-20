# Retro: Đảo Đèn Lồng (Day 12 AI SDLC, 4 phase)

Làm một mình cùng Claude Code (Opus 5.5) trong 4 giờ. Sản phẩm cuối là bản v1.0.0: 3 Đêm, contract v1.3, 81 test, 25 scenario headless, 21 bước kiểm tra trên Chrome thật, bench và soak đạt ngưỡng trên máy dev.

## 1. Tổng hợp đánh giá 4 phase

| Phase | Yêu cầu | Đạt | Chưa đạt / rủi ro | Hỏng phase trước? |
|---|---|---|---|---|
| 1 PRD-0 | Đêm 1 chơi được, contract v1.0 | 25 test, 7 scenario, CI Linux + macOS | Chưa có người chơi thử | — |
| 2 Ticket-02 | Số chuẩn, 3 Đêm, 6 tính năng, UI | 54 test, 20 scenario, 11 bước flow, ~165 FPS | Dốc Đêm 3 hiển thị ngược (người chơi thử phát hiện sau khi tag, đã gắn lại tag trước hạn) | 8 test Phase 1 đổi theo số chuẩn, có lý do |
| 3 Ticket-03 | Dầu đèn, `drain`, thắng lúc bình minh | 70 test, 25 scenario, ADR, CHANGELOG | Vết rách trên đèn tắt khó thấy ở xa | 10 test/scenario bị thay, ghi `P3:`, không skip |
| 4 Ticket-04 | Bench, soak, bảng xếp hạng, a11y, phát hành | 81 test, bench 333,8 FPS, soak ×1,11, 21 bước flow | Chưa đo trên máy yếu; Dockerfile chưa build thử; video tự quay | Không đổi luật gameplay |

Giả định đã ghi: A1–A35, B1–B12, C1–C12. Rủi ro lớn nhất với test ẩn là các chỗ ticket không nói rõ: tâm Bóng Mực cao bao nhiêu (A20), thời gian `spawning` (A21), tốc độ `wander` (B1).

## 2. Điều gì hiệu quả

- **Một core JS thuần dùng chung** cho web, headless, soak và bench. Mỗi luật chỉ viết một lần; bằng chứng headless chính là luật bản web đang chạy. Khi Ticket-03 đổi luật cốt lõi, chỉ phải sửa `sim.js` và test.
- **Đơn vị nguyên** (tick, dầu tính theo 1/60). Output tất định trên Windows, Linux và macOS; CI so output byte-by-byte giữa các máy.
- **Đọc contract trước, viết test theo từng AC, rồi mutation check.** Mutation bắt được 5 lỗ hổng test (đèn chưa thắp vẫn chặn Bóng Mực, lướt lại khi đang lướt, rơi bị bất tử chặn, bench vẫn sinh thực thể…) và giúp phân biệt một mutant tương đương.
- **webcheck qua Chrome DevTools Protocol.** Agent tự chơi, chụp ảnh, đo FPS và kiểm tra luồng UI mà không cần người. Nó bắt được lỗi UX thật: phụ đề trùng đẩy mất cảnh báo cạn dầu.
- **Xem ảnh trước khi khẳng định.** Ba lần cảnh quá tối hoặc thiếu chi tiết đều chỉ phát hiện được nhờ nhìn ảnh chụp.

## 3. Điều gì không hiệu quả

- **Một phiên dài cho cả 4 phase.** `/usage` cho thấy 69–83 % chi phí đến từ việc không `/clear`. Ngữ cảnh phình to làm mỗi lượt đắt hơn.
- **Chưa chơi thử bằng tay từng phase.** Lỗi dốc Đêm 3 lọt qua mọi test tự động, vì test chỉ kiểm luật chứ không kiểm hình.
- **Sửa file bằng heredoc và sed lồng nhau** hỏng 4 lần do trích dẫn. Dùng Edit hoặc ghi script ra file ổn định hơn.
- **Test đầu tiên của mỗi tính năng hay tính sai số tick.** Tổng cộng 9 lần, mất thời gian phân tích dù code đúng.

## 4. AI sai ở đâu và phát hiện bằng cách nào

28 lỗi được ghi trong [ai-log.md](ai-log.md). Gom lại:

| Loại | Số lần | Phát hiện bằng | Chỉnh harness |
|---|---|---|---|
| Test tính sai tick / kỳ vọng sai luật | 9 | Test đỏ → phân tích từng cái | AGENTS.md: "kiểm tick arithmetic của test trước" |
| Test yếu (mutant sống) | 6 | Mutation check | Skill verify bắt buộc bước mutation; AGENTS ghi quy tắc mutant tương đương |
| Lỗi hình ảnh (tối, dốc ngược, mesh lệch) | 5 | Xem ảnh; người chơi thử | webcheck có bước hình học (dốc) và chụp ảnh từng trạng thái |
| Công cụ / script (heredoc, tar, awaitPromise, sampling nặng) | 6 | Lệnh lỗi, số đo bất thường (p1_low 94 → 136) | Ghi script ra file thay vì heredoc |
| Bằng chứng ghi nhầm (ghi "recoil" mà không kiểm) | 2 | Tự rà output | Mọi ghi chú trong proof phải có assert đi kèm |

## 5. Harness nào giúp nhiều nhất

1. **`scripts/proof.js` + `scripts/webcheck.js`**: bằng chứng chạy lại được bằng một lệnh, cả headless lẫn trình duyệt.
2. **AGENTS.md**: ngắn (khoảng 30 dòng), được cập nhật qua 4 phase. Các quy tắc về tick, `hasZone()`, "không skip test" và mutant tương đương đều sinh ra từ lỗi thật.
3. **CI Linux + macOS**: chứng minh tính tất định trên máy khác, đúng loại máy giảng viên dùng.
4. **Stop hook**: hầu như không phải chặn lần nào vì test thường xanh trước khi dừng. Giá trị của nó là bảo hiểm, không phải công cụ dùng hằng ngày.

## 6. Token / chi phí

| Phase | Quota phiên 5 giờ (điểm %) | Quota tuần (điểm %) |
|---|---|---|
| 1 | 11 | 9 (tính từ đầu tuần) |
| 2 | 23 | 3 |
| 3 | 19 | 3 |
| 4 | 22 | 2 |
| **Tổng** | **75 % một quota phiên** | 9 % → 17 % |

Toàn bộ chạy trên Opus, cache hit 97–99 %. `/usage` báo 94 % chi phí 24 giờ qua đến từ việc không `/clear`, vì cả 4 phase chạy chung một phiên. Gói subscription nên không có số USD. Cách đã tiết kiệm:
- Lọc output test bằng `grep`.
- Trích lab board ra text (13 KB thay vì 180 KB HTML).
- Ở Phase 3 sửa bằng Edit nhỏ thay vì viết lại file.
- Có chế độ `FLOW_ONLY` cho webcheck.
- Không dùng subagent.

## 7. Nếu làm lại

- Mở **phiên mới cho mỗi phase** (`/clear`), chỉ nạp AGENTS.md, CHANGELOG và spec phase trước.
- **Chơi thử 5 phút bằng tay** trước mỗi tag, và quay video luôn trong lúc đó.
- Hỏi trợ giảng về các giả định rủi ro (A20, A21, B1) ngay khi ticket ra.
- Dùng **instancing** cho Bóng Mực và đom đóm từ Phase 2 để có dư địa FPS trên máy yếu.
- Viết script vá file một lần rồi dùng lại, thay vì heredoc mỗi lần.
