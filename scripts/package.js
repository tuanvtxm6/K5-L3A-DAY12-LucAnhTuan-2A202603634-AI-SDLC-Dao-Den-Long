// Builds the release bundle dist/dao-den-long-v<version>.zip: everything needed to play and to run
// headless/soak/bench with only Node >= 22 installed (three.js build included, no npm install needed).
//   node scripts/package.js
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const name = `dao-den-long-v${pkg.version}`;
const dist = join(root, 'dist'), out = join(dist, name);
rmSync(dist, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const p of ['web', 'src', 'scripts', 'game.contract.json', 'package.json', 'README.md', 'CHANGELOG.md', 'CREDITS.md', 'LICENSE', 'Dockerfile']) {
  cpSync(join(root, p), join(out, p), { recursive: true });
}
cpSync(join(root, 'node_modules', 'three', 'build'), join(out, 'node_modules', 'three', 'build'), { recursive: true });
cpSync(join(root, 'node_modules', 'three', 'package.json'), join(out, 'node_modules', 'three', 'package.json'));
cpSync(join(root, 'node_modules', 'three', 'LICENSE'), join(out, 'node_modules', 'three', 'LICENSE'));
writeFileSync(join(out, 'START.txt'), [
  `Đảo Đèn Lồng v${pkg.version}`,
  '',
  'Yêu cầu: Node.js >= 22. Chrome/Chromium chỉ cần cho lệnh bench.',
  'Chơi:      node scripts/serve.js   rồi mở http://localhost:5173',
  'Headless:  node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl',
  'Soak:      node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json',
  'Bench:     node scripts/bench.js --seed 42 --duration 30 --out bench.json',
  'Docker:    docker build -t dao-den-long . && docker run -p 5173:5173 dao-den-long',
  '',
].join('\n'));
const zip = join(dist, `${name}.zip`);
// bsdtar (Windows 10+, macOS) writes zip with -a; fall back to `zip` on Linux
const tar = process.platform === 'win32' ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
try { execFileSync(tar, ['-a', '-cf', zip, name], { cwd: dist, stdio: 'ignore' }); }
catch { execFileSync('zip', ['-qr', zip, name], { cwd: dist }); }
console.log(zip);
