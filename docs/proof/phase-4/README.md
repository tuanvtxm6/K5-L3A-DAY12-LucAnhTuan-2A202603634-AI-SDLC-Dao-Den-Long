# Bằng chứng Phase 4

Chạy lại ở tag `phase-4`:

```bash
npm install && npm test && npm run proof
node scripts/bench.js --seed 42 --duration 30 --out bench.json
node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json
npm run webcheck
```

| Yêu cầu | Kết quả | Ngưỡng | File |
|---|---|---|---|
| Bench avg_fps | **333,8** | ≥ 60 | [bench.json](bench.json) |
| Bench p1_low_fps | **136,5** | ≥ 30 | |
| Bench frame_ms_p95 | 3,8 ms | | |
| Bench load_ms | **641** | ≤ 10 000 | |
| Bench peak_mem_mb | 985 (RSS cả cây tiến trình Chrome) | | |
| Bench frames | 10 014 trong 30 s, canvas 1280×720, vsync tắt | | [bench-scene.png](bench-scene.png) |
| Soak crashes | **0** / 10 Đêm | = 0 | [soak.json](soak.json) |
| Soak bộ nhớ | 57,8 → 63,9 MB (**×1,11**) | ≤ ×1,2 | |
| Unit + CLI test | **81/81** | | [tests/](../../../tests/) |
| Scenario headless (hồi quy Phase 1–3) | **25/25** | | [RESULTS.md](RESULTS.md) |
| Chrome thật (CDP) | **21/21** bước, 0 lỗi console: bảng xếp hạng, đổi phím, phụ đề, giảm chuyển động, cỡ chữ, cùng toàn bộ flow cũ | | [webcheck.json](webcheck.json) |
| Mutation | 6/6 mutant bị bắt (thứ tự bằng điểm, độ dài tên, top 10, bench hao dầu, bench sinh thực thể, bench Bóng Mực chuyển sang chase) | | |
| Release zip | Giải nén ở thư mục sạch → `node scripts/serve.js` trả 200, three.js tải được, headless chạy được | | |

Cấu hình máy đo: Windows 11 (10.0.26200), Intel i5-13500HX, RTX 4050 Laptop (ANGLE D3D11), 32 GB RAM, Chrome 157, Node 24.21, chế độ nguồn mặc định khi cắm sạc.

## Chưa kiểm chứng / giới hạn

- **Máy chấm** của giảng viên có thể yếu hơn nhiều (GPU tích hợp). Cảnh bench có khoảng 1 000 draw call (mỗi Bóng Mực 4 mesh). Chưa đo trên GPU tích hợp, và chưa tối ưu bằng instancing.
- **Dockerfile chưa được build thử**, vì Docker daemon trên máy dev không chạy.
- **Video demo** do người làm bài tự quay; máy dev không có ffmpeg để quay tự động. Kịch bản quay: [docs/demo/DEMO-SCRIPT.md](../../demo/DEMO-SCRIPT.md).
- `peak_mem_mb` trên Windows là working set, lấy mẫu mỗi 2 s, nên có thể bỏ sót đỉnh ngắn.
