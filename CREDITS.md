# Credits

## Thư viện

- **three.js** r170 (npm `three@0.170.0`), MIT License, © 2010–2024 three.js authors. https://threejs.org. Được đóng gói lại trong Release, kèm file LICENSE gốc.

## Asset

- **Mô hình 3D:** không dùng file asset ngoài. Đảo, Mây, đèn lồng, Bóng Mực, Gió Lạc, bùa và tháp chuông đều dựng bằng hình khối có sẵn của three.js ngay trong code ([web/world.js](web/world.js)).
- **Âm thanh và nhạc:** không dùng file âm thanh. Tất cả được tổng hợp bằng WebAudio API trong [web/audio.js](web/audio.js) (sóng sine/triangle/sawtooth, nhiễu lọc băng cho tiếng gió).
- **Phông chữ:** phông hệ thống (`system-ui`), không nhúng phông.
- **Biểu tượng trong phụ đề** (⚠ 🍃 ⏳ 🏮): ký tự Unicode/emoji của hệ điều hành.

## Nội dung gốc

- Nhân vật, bối cảnh và tên gọi (Mây, Ông Đăng, Đảo Đèn Lồng, Đảo Bến, Đảo Cau, Đảo Chuông, Bóng Mực, Gió Lạc, Bùa Gió) là bản gốc của lab Day 12 AI SDLC. Lời thoại của Ông Đăng do mình viết cùng AI.

## Công cụ AI

- **Claude Code** (Anthropic), model **Claude Opus 5.5**, trong VS Code. Đã dùng để viết code (logic, render, test, script đo), tài liệu và lời thoại. Không có hình ảnh hay âm thanh nào do AI tạo thành file. Chi tiết từng phase nằm trong [docs/notes/ai-log.md](docs/notes/ai-log.md).
