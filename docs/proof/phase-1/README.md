# Bằng chứng Phase 1

Chạy lại mọi bằng chứng ở tag `phase-1`:

```bash
npm install && npm test && npm run proof
```

| Loại | Chứng minh | File |
|---|---|---|
| Test đơn vị theo luật (17) | Từng luật PRD-0 và tuning: di chuyển, nhảy, nhặt, nạp, thắng, chạm, tỏa sáng, vùng an toàn, bình minh, sinh ngẫu nhiên | [tests/sim.test.js](../../../tests/sim.test.js) |
| Test CLI (8) | Contract: tuning khớp, định dạng JSONL, mô hình tick, tất định, exit 2 | [tests/headless.test.js](../../../tests/headless.test.js) |
| Scenario headless (7) | Hành vi end-to-end qua đúng `headless_cmd` | [RESULTS.md](RESULTS.md), [runs/](runs/) |
| Mutation check | Test bắt được lỗi thật: cố tình làm hỏng 3 luật (`<=`→`<` khi nhặt, bỏ miễn nhiễm, vùng an toàn cho cả đèn chưa thắp), lần nào test cũng đỏ. Lần đầu mutant thứ 3 **lọt qua**, nên mình thêm test `unlit lantern gives no protection` | ghi trong [ai-log](../../notes/ai-log.md) |
| Ảnh bản web | Menu, HUD (lửa, đom đóm, đèn, điểm, thời gian, tỏa sáng), đảo, đom đóm, đèn | [web-menu.png](web-menu.png), [web-play.png](web-play.png) |
| Hiệu năng | Một đêm 18 000 tick, snapshot mỗi tick: 260–266 ms (3 lần chạy; i5-13500HX, Node 24.21, Windows 11) | lệnh ở dưới |

Ảnh được chụp bằng Chrome headless (SwiftShader):
`chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=4000 --screenshot=web-play.png "http://localhost:5173/?autostart=1&seed=7"`

Đo hiệu năng: `echo '{"random_shades":false}' > ns.json && time node src/headless.js --seed 1 --night 1 --scenario ns.json --inputs tests/scenarios/default_walk.inputs.json --ticks 18000 --out perf.jsonl --snapshot-every 1`

## Chưa kiểm chứng ở Phase 1

- Chưa có người thật chơi trọn một ván từ đầu tới thắng trên bản web. Logic thắng đã được chứng minh qua headless (scenario 1), nhưng độ khó cân bằng tới đâu thì chưa đo.
- Chưa có clip hay GIF của bản web (để dành cho video ở Phase 4).
- Chưa thử chạy trên macOS/Linux bằng máy thật. CI đã được cấu hình cho ubuntu và macos, sẽ chạy khi push.
