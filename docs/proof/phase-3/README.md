# Bằng chứng Phase 3

Chạy lại ở tag `phase-3`:

```bash
npm install && npm test && npm run proof
npm start   # rồi ở terminal khác:
npm run webcheck
```

| Loại | Kết quả | Chứng minh | File |
|---|---|---|---|
| Unit + CLI test | **70/70 pass** | 15 test luật Ticket-03 mới, test Phase 1–2 còn hiệu lực, contract v1.2 | [tests/](../../../tests/) |
| Scenario headless | **25/25 pass** | Thắng lúc bình minh, hết dầu và thắp lại, châm dầu, hút dầu, sức chứa, ngưỡng thắng Đêm 2, cùng toàn bộ hồi quy Phase 1–2 | [RESULTS.md](RESULTS.md), [runs/](runs/) |
| Mutation check | 9/10 mutant bị bắt; 1 mutant tương đương | Đã thử: vùng an toàn cần > 30; thắp lại tốn 10; thắng cần > ngưỡng; hút dầu không cộng dồn; Tỏa Sáng không có thưởng drain; sức chứa không tăng; đèn sáng không châm được; giữ `deposited` khi tắt; `fuel_drain` mỗi 30 tick. Mutant "hết choáng xét theo khoảng cách" là **tương đương**: bước 8 của cùng tick cho kết quả như nhau | [ai-log](../../notes/ai-log.md) |
| Chrome thật (CDP) | 11/11 bước flow, 0 lỗi console | Thắng/thua theo luật bình minh, chế độ mù màu được lưu và áp dụng sau khi tải lại (`--danger` = #ffffff) | [webcheck.json](webcheck.json) |
| FPS 1280×720 | 164,5 / 165,0 / 165,0 trung bình, frame tệ nhất 29,9 ms | Bot chạy liên tục 10 s mỗi Đêm, RTX 4050 Laptop | [webcheck.json](webcheck.json) |
| Headless perf | Đêm 3 đầy đủ, 18 000 tick, chạy 769 ms | Giới hạn ≤ 30 s | RESULTS #24 |
| Ảnh đèn | Phải: đầy dầu (có vòng an toàn + thanh dầu). Giữa: dầu 20 (không có vòng, đang ở pha tắt của nhịp 1 Hz). Trái: đã tắt (xẹp 20 %) | AC-colorblind, thanh dầu | [lanterns-fuel.png](lanterns-fuel.png) |

## Chưa kiểm chứng / giới hạn

- Vết rách giấy trên đèn tắt **khó thấy ở khoảng cách xa**; dấu hiệu nhận ra rõ nhất là đèn bị xẹp và tối.
- Chưa chơi trọn một Đêm theo luật mới bằng tay, nên độ khó (dầu hao 1/s, hút 5/s) chưa được cân chỉnh.
- Giả định B1 (wander 1,5 m/s) và B3 (cách đếm `fuel_drain`) có thể khác với kịch bản ẩn.
- Âm thanh cho `lantern_out` và `refuel` chưa có; vẫn dùng âm có sẵn của `deposit`.
