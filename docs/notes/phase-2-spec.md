# Phase 2 (Ticket-02 "Ba hòn đảo"): spec, acceptance criteria, assumptions

Nguồn: Ticket-02 trên lab board (Contract v1.1). Số liệu chuẩn ở Phần 1 thay mọi số Phase 1 tự chọn: [src/core/tuning.js](../../src/core/tuning.js) và [game.contract.json](../../game.contract.json). Bản đồ chuẩn ở Phần 2 nằm trong [src/core/maps.js](../../src/core/maps.js).

## Thay đổi thiết kế

- `sim.js` được viết lại theo đúng **12 bước** mà ticket yêu cầu: input/pause → bộ đếm → di chuyển và rơi → nhặt → nạp → vùng an toàn → tỏa sáng → Bóng Mực/Gió Lạc → chạm → sinh → thắng/thua → snapshot.
  - Bộ đếm giờ giảm ở đầu tick, nên "bất tử 90 tick" nghĩa là bị chạm lại được đúng sau 90 tick.
- Địa hình là hàm `surface(x, z)`: trả về độ cao mặt đất cao nhất tại điểm đó, hoặc `null` nếu là biển mây.
  - Vách = bậc cao hơn 0,35 m: Mây không đi lên được.
  - Rơi khi đứng trên `null` và Y < −10.
  - Dốc là mặt nghiêng, mỗi tick chỉ cao lên khoảng 0,05 m nên đi lên được.
- Bản web tách thành `world.js` (cảnh), `audio.js` (âm thanh) và `main.js` (luồng màn hình, input, HUD). Không file nào trong `web/` thay đổi luật chơi.

## Acceptance criteria — Phần 3 (mỗi mục có test hoặc scenario)

| AC | Tính năng | Tiêu chí kiểm chứng được | Bằng chứng |
|---|---|---|---|
| AC-dash | Lướt | 14 m/s trong 12 tick theo hướng di chuyển, hoặc hướng mặt nếu đứng yên. Hồi 90 tick tính từ lúc bắt đầu lướt. Nhấn trong lúc đang lướt bị bỏ qua. Lướt trên không giữ nguyên độ cao. Không bất tử khi lướt | phase2.test `AC-dash` ×2, proof #7 |
| AC-pad | Bục nhảy | Đêm 2: bắn lên vy 14, ngang 24 m/s về phía đảo kia, đáp xuống đảo B, không rơi. Phím di chuyển không ghi đè, nhưng vẫn lướt được. Đêm 3: đáp lên tầng 2 (Y = 6) | `AC-pad` ×2, `AC-map3`, proof #9–10 |
| AC-map3 | Đảo Chuông | Vách tầng chặn Mây. Đi theo dốc 30° lên tới Y = 3. Bước ra khỏi tầng thì rơi xuống tầng dưới, không bị phạt. Tháp chuông là khối đặc | `AC-map3` |
| AC-fall | Rơi khỏi đảo | Xảy ra đúng 1 lần, bỏ qua bất tử: −1 lửa, `lost` = toàn bộ đom đóm đang mang. Chờ 60 tick rồi hồi sinh ở điểm xuất phát, bất tử 90 tick. Hết lửa thì thua ngay | `AC-fall` ×3, proof #11 |
| AC-drifter | Gió Lạc | idle → chase khi Mây mang ≥ 5 đom đóm và cách ≤ 15 m. Chạm (≤ 1,2 m) thì cướp min(3, đang mang), chuyển flee 240 tick rồi removed. Tỏa sáng lúc chase → flee mà không cướp. Tỏa sáng lúc flee đang mang đồ → thả hết, 120 tick sau removed. Bất tử không chặn bị cướp. Cướp xét trước Bóng Mực. Sinh ở tick 1200, 2400…, tối đa 2, chỉ ở Đêm 2 và 3 | `AC-drifter` ×4, proof #12 |
| AC-charm | Bùa Gió | Nhặt → `charm_picked` 600 tick: chạy 7,2 m/s, lướt không hồi chiêu (vẫn phải nhấn lại). Bùa xuất hiện lại sau 2700 tick. Nhặt lại thì làm mới thời gian | `AC-charm` ×3, proof #8 |
| AC-nights | Chuỗi 3 Đêm | Menu → giới thiệu Đêm (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. Thắng Đêm 3 → màn Bình Minh có tổng điểm. Thua → chơi lại Đêm đó | webcheck flow 1, 2, 8–10, `AC-nights` |
| AC-pause | Tạm dừng | Esc/P → logic đứng yên. Menu có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu. Headless: `tick` vẫn tăng, `sim_tick`/thời gian/hồi chiêu đứng yên, state `paused` | `AC-pause`, headless.test pause, proof #13, webcheck 3–4 |
| AC-settings | Cài đặt | Âm lượng và độ nhạy chuột được lưu qua lần tải lại | webcheck 5–6 |
| AC-audio | Âm thanh | Nhạc nền + hiệu ứng cho nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s | web-static `AC-audio` (chỉ kiểm có code và được nối; **chưa nghe kiểm bằng tai**) |
| AC-hud | HUD | Lửa trên trái. Đồng hồ trên giữa, đỏ và nhấp nháy khi ≤ 30 s. Đèn k/n và điểm trên phải. Thanh 10 ô dưới giữa. Hồi chiêu Lướt/Tỏa dưới phải. Nhắc "E — Nạp ánh sáng (x/10)" khi đứng gần đèn. Mũi tên chỉ tới đèn chưa sáng gần nhất khi đèn ở ngoài màn hình | webcheck 7, ảnh `night*.png` |
| AC-palette | Bảng màu | Các màu liệt kê lệch ≤ 10 % mỗi kênh RGB. Ánh sáng môi trường = 0,15 + 0,55 × tỉ lệ đèn đã thắp | web-static `AC-palette` |
| AC-perf | Hiệu năng | Headless một Đêm 21 600 tick ≤ 30 s. Web ≥ 30 FPS trung bình ở 1280×720 | proof #19, webcheck bench |
| AC-wind | Gió (Đêm 3) | Mỗi 30 s có một cơn gió 5 s đẩy 2 m/s. Lá bay và tiếng gió báo trước 2 s | `AC-wind`, proof #14 |

Phần 1 và 2 (số liệu, thứ tự tick, bản đồ, lịch sinh, điểm) có test riêng: `AC-shade spawn`, `AC-motes`, `AC-shade states`, `AC-hit`, `AC-drops`, `AC-safe`, `AC-end`, cộng với các test luật ở `sim.test.js`.

## Giả định mới (A20+)

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| A20 | Tâm Bóng Mực cao bao nhiêu | Giữ nguyên Y theo scenario. Bóng Mực tự sinh có tâm Y = 1,0 (như ví dụ snapshot v1.0). Bóng Mực **bay**: không đổi Y, đi xuyên tầng và biển mây, nhưng bị chặn bởi vùng an toàn và tháp chuông. Nhờ luật "chênh cao ≤ 1,5 m", Mây đứng trên tầng 1–2 sẽ an toàn trước Bóng Mực ở tầng 0 |
| A21 | Trạng thái `spawning` | Kéo dài 30 tick: đứng yên, không gây sát thương, vẫn bị Tỏa Sáng trúng |
| A22 | `wander` | Đi 1,5 m/s tới một điểm đom đóm ngẫu nhiên. Phát hiện Mây khi ≤ 12 m → chase. Mất dấu khi > 18 m, hoặc khi Mây đang chờ hồi sinh → wander |
| A23 | Tên trạng thái khi bị đẩy ra khỏi vùng đèn vừa thắp | `recoil` (đi thẳng ra mép trong đúng 30 tick, vô hại) |
| A24 | Xuất phát Đêm 2 / Đêm 3 | Đêm 2: (0, 0, 0). Đêm 3: (0, 0, −25), vì (0, 0, 0) nằm trong tháp chuông. Cả hai quay mặt về +Z |
| A25 | Điểm sương của Gió Lạc | Dùng chung điểm sinh Bóng Mực của Đêm đó. Gió Lạc bay ở Y = 1,5, không bị địa hình chặn. `idle` lượn 2 m/s tới điểm đom đóm ngẫu nhiên |
| A26 | Gió Lạc bị loại bỏ | Vẫn nằm trong mảng `drifters` với state `removed`. Giới hạn "tối đa 2" chỉ đếm con chưa bị loại |
| A27 | Gió Lạc ở trạng thái idle chạm Mây | Vẫn cướp nếu Mây đang mang > 0 (luật chạm không đòi hỏi chase) |
| A28 | Chiều góc trên bản đồ | x = r·cos a, z = r·sin a. Nhờ vậy dốc 30°/150° và các điểm tầng 1 (20°–160°) đều rơi vào nửa z > 0, đúng như ticket mô tả |
| A29 | `snapshot.player.invuln` | Kiểu boolean (đang bất tử hay không). Các trường `_s` là số giây còn lại |
| A30 | Sự kiện `night_start` | Ghi ở tick 0, ngay sau snapshot tick 0 |
| A31 | Trần 30 đom đóm | Đếm cả đom đóm rơi. Điểm trống = điểm chưa có đom đóm tự sinh nằm trên đó. Đêm 1 chỉ có 24 điểm sinh |
| A32 | Đom đóm rơi ra ngoài đảo | Vẫn được tạo, đặt ở độ cao mặt đất gần nhất (hoặc Y của Mây), thực tế không nhặt được |
| A33 | Gió | Hướng được rút ngẫu nhiên lúc bắt đầu báo trước (tick 1680 + 1800k). Cơn gió chạy từ sim tick 1800k, dài 300 tick. Mặc định chỉ bật ở Đêm 3 (`wind_enabled` ghi đè được). Gió cộng 2 m/s vào dịch chuyển, không vào vận tốc |
| A34 | Tăng tốc | Vận tốc đổi tối đa `run/6` mỗi tick: đạt hoặc dừng hẳn trong đúng 0,1 s. Ra khỏi lướt thì vận tốc bị cắt về tốc độ chạy |
| A35 | Ánh sáng web | Ánh sáng môi trường đúng công thức của ticket. Thêm ánh trăng hướng (1,4) và đèn của Mây để nhìn rõ (tự chọn, chỉ là hiển thị) |

## Regression: test Phase 1 bị đổi và lý do

| Test cũ | Đổi gì | Lý do (Ticket-02) |
|---|---|---|
| movement | Không còn "60 tick = 6 m" chính xác; giờ kiểm tốc độ đạt 6 m/s sau 6 tick, và quãng 6 m/s khi đã chạy đều | Tăng tốc/dừng trong ≤ 0,1 s |
| island edge clamp | **Bỏ**, thay bằng `AC-fall` | `fall_enabled = true`, ngoài 40 m là biển mây |
| pickup score | Nhặt không còn được điểm; mỗi đom đóm **nạp** được +10 | Điểm chuẩn hóa |
| capacity / cost / radii / pulse / stun / safe | Đổi sang 10 / 10 / 2,0 m / 3 đom đóm, 5 m (3D), 3 s / 120 tick, đẩy trong 15 tick / 6 m | Số liệu chuẩn |
| shade hit drop | Đom đóm rơi thành đom đóm `dropped` trên mặt đất, TTL 480 tick (trước đây mất hẳn, A2) | Ticket quy định |
| win timing | Thắng được xét ở cuối tick (bước 11), kể cả đúng tick hết giờ | Thứ tự tick bắt buộc |
| contract example | Nhặt ở tick 43 thay vì 40 (do tăng tốc), pulse cần mang ≥ 3 | Số chuẩn |
| scenarios Phase 1 | `tests/scenarios/` được thay bằng bộ v1.1 (bộ cũ vẫn nằm ở tag `phase-1`) | Bộ cũ dựa trên số Phase 1 |

Bằng chứng Phase 1 trong `docs/proof/phase-1/` được **giữ nguyên**, vì nó khớp với mã ở tag `phase-1`. Bằng chứng Phase 2 nằm trong `docs/proof/phase-2/`.
