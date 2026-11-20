# Phase 1 — Yêu cầu, giả định, tiêu chí nghiệm thu

Nguồn: PRD-0 + Test Contract v1.0 trên lab board.

## Giả định (chỗ PRD-0 chưa quy định)

| # | Chỗ mơ hồ | Giả định | Lý do |
|---|---|---|---|
| A1 | "Mất máu" | Máu = **lửa** (`flames` = 3). Mỗi lần bị chạm mất 1 | Contract dùng `flames` |
| A2 | Bị chạm thì đom đóm đi đâu | Rơi `floor(carried × 0.5)` con và **mất hẳn**, không rơi xuống đất | Đơn giản, tránh nhặt lại ngay. Đổi được nếu ticket yêu cầu |
| A3 | Đom đóm nạp vào đèn thế nào | Nhấn `interact` trong ≤ 2,5 m, nạp `min(carried, cost − deposited)` vào đèn **chưa thắp gần nhất**. Nạp nhiều lần được | Contract có `deposited` riêng cho từng đèn |
| A4 | Nhặt đom đóm | Tự động khi ≤ `pickup_radius`, chỉ khi `carried < capacity`. Nhiều con cùng tick thì xử lý theo thứ tự id | Không cần nút riêng |
| A5 | Tỏa sáng tốn gì | Tốn 1 đom đóm đang mang. Có hồi chiêu 1 s. Không đủ ánh sáng thì không có sự kiện | "tốn ánh sáng" |
| A6 | "Bóng Mực sợ đèn" | Chỉ đèn **đã thắp** có vùng an toàn 5 m. Bóng Mực bị đẩy ra mép vùng đó | Đèn tắt thì không có ánh sáng để sợ |
| A7 | Bóng Mực bị choáng | Đứng yên, không gây sát thương trong 3 s. Bị đẩy lùi 4 m ngay khi trúng xung | Contract có `pulse_stun_s`, `pulse_push_m` |
| A8 | Điểm thời gian và lửa | Chỉ cộng **khi thắng**: 2 × số giây còn lại (làm tròn xuống) + 50 × số lửa | Thưởng cho thắng nhanh |
| A9 | Thua theo thời gian | Hết đêm (300 s) mà chưa thắp hết đèn thì `lost` / `dawn` | Contract có reason `dawn` |
| A10 | Rơi khỏi đảo | Không có (`fall_enabled=false`). Đảo bán kính 40 m, mép đảo chặn lại | Phase 1 không yêu cầu |
| A11 | Sinh ngẫu nhiên | Lúc đầu có 20 đom đóm. Khi còn ít hơn 20 thì cứ 2 s sinh thêm 1 con. Bóng Mực đầu tiên xuất hiện ở giây 10, sau đó cứ 20 s thêm 1 con, tối đa 4, sinh ở bán kính 36 m | Đủ 25 đom đóm để thắp hết đèn |
| A12 | Vị trí mặc định của đèn | L1…L5 trên vòng tròn bán kính 20 m, L1 ở (0, 0, 20), các đèn cách nhau 72° | |
| A13 | Thứ tự xử lý trong một bước | di chuyển → nhảy → nhặt → nạp → tỏa sáng → Bóng Mực di chuyển → kiểm tra chạm → sinh ngẫu nhiên → bình minh | Ghi rõ để test tái lập được |
| A14 | `move` vượt [−1, 1] | Kẹp từng thành phần về [−1, 1] rồi mới chuẩn hóa. **Không** báo exit 2 | Khoan dung với đầu vào số |
| A15 | Lỗi định dạng | JSON hỏng, tick không tăng nghiêm ngặt, sai kiểu dữ liệu, thiếu `frames`, không đọc được file → exit 2. Sai tham số CLI → exit 1 | Contract: "sai định dạng → 2" |
| A16 | Scenario có `lanterns[].id` lạ | Bỏ qua. `lit: true` mà không có `deposited` thì coi như `deposited = lantern_cost` | |
| A17 | Snapshot | Chỉ ghi ở tick chia hết cho N (kể cả tick 0), không ghi thêm snapshot cuối. Có thêm mảng `motes` (khuyến nghị) | |
| A18 | Nhảy | Vận tốc nhảy 7 m/s, trọng lực 20 m/s². Chỉ ảnh hưởng trục Y; mọi khoảng cách tính trên XZ nên nhảy **không** né được Bóng Mực | Contract đo trên XZ |
| A19 | Hướng `move` trên bản web | `W` = +z (phía trước camera), `A` = +x. Với yaw 0 camera nhìn theo +Z, nên +X nằm bên trái màn hình | Khớp công thức xoay của contract |

## Tiêu chí nghiệm thu (đối chiếu bằng chứng)

| Yêu cầu PRD-0 / Contract | Kiểm chứng | Bằng chứng |
|---|---|---|
| Đi lại, camera 3D, nhảy | test `movement`, `jump`, ảnh web | sim.test.js, `web-play.png` |
| Nhặt đom đóm | test `pickup`, scenario 1 | RESULTS #1 |
| Nạp → thắp đèn | test `deposit`, scenario 1 | RESULTS #1 |
| Bóng Mực đuổi, chạm mất máu | test `shade hit`, `chase`, scenario 2 | RESULTS #2 |
| Tỏa sáng xua Bóng Mực | test `pulse*`, `stunned`, scenario 4 | RESULTS #4 |
| Bóng Mực sợ đèn | test `safe_radius`, `unlit`, scenario 5 | RESULTS #5 |
| Thắng / thua / điểm | test `win`, `dawn`, scenario 1, 2, 3 | RESULTS #1–3 |
| HUD, chơi lại | ảnh web, chơi thử | `web-play.png`, video Phase 4 |
| Headless: định dạng, mô hình tick, exit 2, tất định | headless.test.js, scenario 6, 7 | RESULTS #6–7 |
