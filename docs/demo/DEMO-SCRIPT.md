# Kịch bản video demo (< 5 phút)

Quay màn hình (Windows: `Win + Alt + R` với Xbox Game Bar, hoặc OBS; macOS: `Cmd + Shift + 5`). Nén bằng ffmpeg nếu cần:
`ffmpeg -i input.mp4 -t 300 -c:v libx264 -crf 28 -preset veryfast -c:a aac -b:a 96k demo.mp4`

| Thời điểm | Cảnh | Lệnh / thao tác |
|---|---|---|
| 0:00–0:20 | Giới thiệu: Đảo Đèn Lồng v1.0.0, 3 Đêm, luật giữ đèn sáng tới bình minh | README trên GitHub |
| 0:20–1:50 | **Chơi trực tiếp Đêm 1:** nhặt đom đóm, thắp đèn, châm dầu, Tỏa Sáng một Bóng Mực đang hút dầu, chỉ vào thanh dầu và phụ đề | `npm start` → http://localhost:5173 |
| 1:50–2:20 | Nhảy nhanh sang Đêm 3: leo dốc, dùng bục nhảy lên tầng 2, gió | `?night=3&autostart=1` |
| 2:20–2:45 | Cài đặt: đổi phím (cho thấy cảnh báo trùng phím), mù màu, giảm chuyển động, chữ lớn. Bảng xếp hạng: nhập tên sau khi thua | Esc → Cài đặt |
| 2:45–3:15 | **Test:** `npm test` (81 pass), `npm run proof` (25/25) | Terminal |
| 3:15–3:45 | **Headless + tất định:** chạy 2 lần, so hash | `node src/headless.js --seed 7 --night 2 --ticks 3600 --out a.jsonl` (×2) rồi `certutil -hashfile a.jsonl SHA256` hoặc `sha256sum` |
| 3:45–4:25 | **Bench** (cửa sổ tự mở, 30 s) và **soak** | `node scripts/bench.js --seed 42 --duration 30 --out bench.json` · `node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json` |
| 4:25–4:50 | Harness + lịch sử git: AGENTS.md, skill verify, Stop hook, CI xanh, các tag phase-1…4 | `git log --oneline --decorate`, tab Actions trên GitHub |

Sau khi quay: `gh release upload v1.0.0 demo.mp4` (hoặc commit vào `docs/demo/demo.mp4` nếu < 100 MB), rồi đặt link ở dòng đầu README.
