# ADR 0001: Đèn có nhiên liệu, thắng lúc bình minh

- **Trạng thái:** Đã chấp nhận (Phase 3, Ticket-03, Contract v1.2)
- **Ngày:** 2026-11-20

## Bối cảnh

Đến Phase 2, đèn chỉ có hai trạng thái: `unlit` → `lit`. Một khi đã sáng, đèn sáng mãi. Người chơi thắng ngay khi mọi đèn sáng (`all_lit`). Playtest cho thấy người chơi giỏi xong Đêm trong 2 phút. Ticket-03 đổi mục tiêu thành "giữ đảo sáng tới bình minh".

## Quyết định

### 1. Mô hình trạng thái đèn

```
            deposit đủ (10 lần đầu / 5 nếu ever_lit)
  unlit ─────────────────────────────────────────────▶ lit (fuel = 100)
    ▲                                                   │  mỗi tick: fuel −= 1/60 + 5/60 × số Bóng Mực đang drain
    │  fuel ≤ 0 (ngay sau bước 2):                       │  interact: châm dầu, fuel = min(100, fuel + 10 × used)
    └── deposited = 0, lantern_out, ever_lit giữ true ◀──┘
```

- Mỗi đèn có thêm các trường `fu` (dầu, tính bằng **số nguyên đơn vị 1/60**), `everLit` và `relit`. Lý do dùng số nguyên: hao 1/s đúng bằng 1 đơn vị mỗi tick, hút 5/s đúng bằng 5 đơn vị. Nhờ vậy không có sai số số thực và output headless tất định trên mọi máy. Chỉ khi xuất ra mới làm tròn tới 1 chữ số thập phân.
- "Đèn có vùng an toàn" được tách khỏi "đèn sáng". Vùng an toàn là một thuộc tính phái sinh, `hasZone = lit && fu ≥ 30·60`. Bóng Mực, cơ chế đẩy và cơ chế chặn đều đọc thuộc tính này, nên luật cũ (đèn sáng luôn chặn Bóng Mực) chỉ phải đổi ở một chỗ.
- Hao dầu và hút dầu nằm ở **bước 2** (bộ đếm), và việc tắt đèn chạy ngay sau đó. Như vậy đèn đã tắt từ trước khi có di chuyển, tương tác hay xét va chạm, đúng như thứ tự mà ticket bổ sung.

### 2. Bóng Mực có thêm trạng thái `drain`

- `wander` không còn đi lang thang ngẫu nhiên nữa. Nó nhắm đèn yếu gần nhất; nếu không có đèn yếu thì về đèn tắt gần nhất; nếu không có cả hai mới đi tới điểm ngẫu nhiên.
- `drain` đứng yên. Thoát khỏi `drain` khi: Mây vào trong 6 m → `chase`; trúng Tỏa Sáng → `stunned`; đèn tắt, được châm lên ≥ 30, hoặc Bóng Mực cách đèn > 2 m → `wander`.
- Hết choáng thì luôn về `wander`.

### 3. Luật thắng

- Bỏ `all_lit`. Xét thắng/thua ở **bước 11**, sau mọi cập nhật của tick.
  - Hết lửa → `no_flames`, luôn được xét trước.
  - Hết giờ: số đèn sáng ≥ ceil(0,6 × n) → `dawn_survived`; ngược lại → `dawn`.
- Điểm thưởng lúc bình minh tính trên **trạng thái ở tick cuối**: mỗi đèn đang sáng được 50 + floor(fuel), cộng 50 cho mỗi Ngọn Lửa. Bỏ thưởng theo thời gian.

### 4. Sức chứa

`capacity() = min(20, 10 + 2 × successfulLights)`. Biến đếm tăng khi thắp lần đầu và khi thắp lại; đèn đặt sẵn bằng scenario không được tính.

## Phương án đã cân nhắc

- **Dầu kiểu số thực** (giây): đơn giản hơn, nhưng sau hàng nghìn tick, phép trừ 1/60 tích lũy sai số, ngưỡng "đúng 30 vẫn còn vùng an toàn" sẽ lệch, và output có thể khác nhau giữa các máy. Không chọn.
- **Thêm trạng thái `weak` cho đèn**: sẽ trùng lặp với `fu`. Chọn thuộc tính phái sinh `#weak()` / `#hasZone()` để chỉ có một nguồn sự thật.

## Hệ quả

- Mọi test và scenario dùng `all_lit` hoặc thắng sớm đều phải thay; danh sách nằm trong [CHANGELOG](../../CHANGELOG.md) và [phase-3-spec](../notes/phase-3-spec.md#regression).
- Một Đêm bây giờ luôn chạy tới hết giờ (hoặc tới khi hết lửa), nên các run headless dài hơn. Đêm 3 tối đa 18 000 tick, chạy 0,6 s.
- Game khó hơn ở cuối Đêm: phải chia đom đóm giữa việc thắp đèn mới và giữ dầu cho đèn cũ. Đây chính là mục tiêu của ticket.
