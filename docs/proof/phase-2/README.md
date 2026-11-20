# Bằng chứng Phase 2

Chạy lại ở tag `phase-2`:

```bash
npm install && npm test && npm run proof
npm start   # rồi ở terminal khác:
npm run webcheck
```

| Loại | Kết quả | Chứng minh | File |
|---|---|---|---|
| Unit + CLI test | **54/54 pass** | Luật Phase 1 với số chuẩn, mọi tính năng Ticket-02, contract v1.1, bảng màu, âm thanh | [tests/](../../../tests/) |
| Scenario headless | **20/20 pass** | Mỗi tính năng mới ≥ 1 scenario chạy qua đúng `headless_cmd`; tất định ở cả 3 Đêm | [RESULTS.md](RESULTS.md), [runs/](runs/) |
| Mutation check | 7/7 mutant bị bắt | Cố tình làm hỏng: nhặt bỏ qua độ cao, bùa vẫn có hồi chiêu lướt, recoil/spawning vẫn đánh được, lướt lại khi đang lướt, hồi sinh sớm 1 tick, rơi bị chặn bởi bất tử, pause không đóng băng logic. Hai mutant (lướt lại, rơi khi bất tử) **lọt qua lần đầu**, nên đã thêm test | [ai-log](../../notes/ai-log.md) |
| Chrome thật (CDP) | 11/11 bước flow pass, 0 lỗi console | Chuỗi Đêm, pause, cài đặt được lưu, HUD đỏ ≤ 30 s, nhắc nạp đèn, thắng/thua/Bình Minh, mesh dốc Đêm 3 khớp độ cao trong sim | [webcheck.json](webcheck.json) |
| FPS 1280×720 | 164,5 / 165,0 / 164,7 FPS trung bình (Đêm 1/2/3), frame tệ nhất 30,4 ms | Có bot chạy, nhảy, lướt, tỏa sáng liên tục trong 10 s mỗi Đêm. Chrome headless, ANGLE D3D11, RTX 4050 Laptop, i5-13500HX | [webcheck.json](webcheck.json) |
| Headless perf | 21 600 tick (Đêm 3 đầy đủ, snapshot mỗi tick) trong 578 ms | Giới hạn của ticket là ≤ 30 s | RESULTS #19 |
| Ảnh | Menu, Đêm 1/2/3, Đêm 3 lúc đang chơi, dốc Đêm 3 nhìn từ chân dốc, pause, Bình Minh | Bản đồ, HUD, bảng màu | `*.png` |

## Chưa kiểm chứng / giới hạn

- **Âm thanh** mới chỉ được kiểm là có code và được nối với sự kiện; chưa ai nghe kiểm bằng tai.
- **FPS** đo trên máy có GPU rời. Máy chấm chung có thể yếu hơn; chưa đo trên máy chỉ có GPU tích hợp.
- **Chơi trọn 3 Đêm bằng tay** chưa làm. Luồng thắng/thua được kiểm bằng cách gắn trạng thái qua `window.__ddl`, nên độ khó thật vẫn chưa được đo.
- Các giả định A20–A35 có thể khác với kịch bản ẩn của giảng viên. Rủi ro cao nhất: A20 (Bóng Mực bay, giữ nguyên Y), A21 (spawning 30 tick), A26 (Gió Lạc removed vẫn nằm trong mảng).
