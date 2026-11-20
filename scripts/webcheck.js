// Drives a real Chrome over the DevTools protocol: screenshots per night, console errors, FPS benchmark.
// Usage: npm start (other terminal), then: node scripts/webcheck.js [outDir]   (CHROME=/path/to/chrome to override)
// Writes <outDir>/night{1,2,3}.png, menu.png and webcheck.json. Exit 1 on console errors or avg FPS < 30.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const outDir = resolve(process.argv[2] || 'docs/proof/phase-2');
const base = process.env.GAME_URL || 'http://localhost:5173';
const chrome = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((p) => existsSync(p));
if (!chrome) { console.error('Chrome not found; set CHROME=/path'); process.exit(1); }
mkdirSync(outDir, { recursive: true });

const port = 9333;
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, '--window-size=1280,720',
  '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ddl-chrome-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('chrome did not start');
}

const ws = new WebSocket(await connect());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map(), errors = [];
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => { const r = (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result; return r?.exceptionDetails ? `EXCEPTION: ${r.exceptionDetails.exception?.description}` : r?.result?.value; };
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

async function shot(url, file, waitMs) {
  await send('Page.navigate', { url });
  await sleep(waitMs);
  const { result } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, file), Buffer.from(result.data, 'base64'));
}

const report = { url: base, errors };
await shot(`${base}/`, 'menu.png', 1500);
report.gpu = await evaluate(`(() => { const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'; })()`);
for (const n of [1, 2, 3]) await shot(`${base}/?night=${n}&autostart=1&seed=7`, `night${n}.png`, 2500);
report.bench = {};
for (const n of [1, 2, 3]) {
  await send('Page.navigate', { url: `${base}/?night=${n}&autostart=1&seed=7&bench=1` });
  let b = null;
  for (let i = 0; i < 40 && !b; i++) { await sleep(500); b = await evaluate('window.__bench || null'); }
  report.bench[`night${n}`] = b;
}
await shot(`${base}/?night=3&autostart=1&seed=7&bench=1`, 'night3-action.png', 6000);

// ---- screen flow, pause, settings persistence, HUD rules ----
const flow = [];
const step = async (name, js, want) => {
  const got = await evaluate(js);
  flow.push({ name, got, ok: JSON.stringify(got) === JSON.stringify(want) });
};
const go = async (q, ms = 1200) => { await send('Page.navigate', { url: `${base}/${q}` }); await sleep(ms); };
const click = (label) => `[...document.querySelectorAll('#card button')].find(b => b.textContent.includes(${JSON.stringify(label)})).click()`;
const key = (code) => `dispatchEvent(new KeyboardEvent('keydown', { code: ${JSON.stringify(code)} }))`;
await go('?night=1');
await step('menu -> night intro shows island + Ông Đăng', `[__ddl.screen, document.querySelector('#card h2').textContent, /Ông Đăng/.test(document.querySelector('#card').textContent)]`, ['intro', 'Đêm 1: Đảo Bến', true]);
await step('intro -> play', `${click('Vào đêm')}; __ddl.screen`, 'play');
await sleep(300);
await step('Esc pauses, logic frozen', `(() => { ${key('Escape')}; const t = __ddl.game.simTick; return new Promise(r => setTimeout(() => r([__ddl.screen, __ddl.game.simTick === t]), 500)); })()`, ['pause', true]);
const { result: ps } = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(outDir, 'pause.png'), Buffer.from(ps.data, 'base64'));
await step('pause menu buttons', `[...document.querySelectorAll('#card button')].map(b => b.textContent)`, ['Tiếp tục', 'Chơi lại Đêm', 'Cài đặt', 'Về menu']);
await step('settings saved', `(() => { ${click('Cài đặt')}; const v = document.getElementById('vol'); v.value = '0.3'; v.dispatchEvent(new Event('input'));
  const s = document.getElementById('sens'); s.value = '1.7'; s.dispatchEvent(new Event('input')); ${click('Xong')}; return __ddl.screen; })()`, 'pause');
await go('?night=1');
await step('settings survive a reload', `JSON.parse(localStorage.getItem('ddl-settings'))`, { volume: 0.3, sensitivity: 1.7 });
await go('?night=1&autostart=1&seed=3');
await step('HUD: hint near lantern + timer red at <= 30 s', `(() => { const g = __ddl.game; g.player.pos = [0, 0, 23.5]; g.startTicks = g.simTick + 30 * 60;
  return new Promise(r => setTimeout(() => r([document.getElementById('hint').textContent, document.getElementById('timer').classList.contains('danger')]), 300)); })()`,
['E — Nạp ánh sáng (0/10)', true]);
await step('win night 1 -> result -> next night intro', `(() => { __ddl.game.lanterns.forEach(L => { L.lit = true; }); return new Promise(r => setTimeout(() => {
  const txt = document.querySelector('#card').textContent; ${click('Sang Đêm 2')}; r([/Đêm 1 đã sáng/.test(txt), __ddl.screen, document.querySelector('#card h2').textContent]); }, 300)); })()`,
[true, 'intro', 'Đêm 2: Đảo Cau']);
await go('?night=2&autostart=1&seed=3');
await step('lose (dawn) -> retry same night', `(() => { const g = __ddl.game; g.startTicks = g.simTick + 1; return new Promise(r => setTimeout(() =>
  r([__ddl.screen, [...document.querySelectorAll('#card button')][0].textContent]), 300)); })()`, ['result', 'Chơi lại Đêm 2 (Enter)']);
await go('?night=3&autostart=1&seed=3');
await step('win night 3 -> Bình Minh with total score', `(() => { __ddl.game.lanterns.forEach(L => { L.lit = true; }); return new Promise(r => setTimeout(() =>
  r([__ddl.screen, document.querySelector('#card h1').textContent, /Tổng điểm: \\d+/.test(document.querySelector('#card').textContent)]), 300)); })()`, ['dawn', 'Bình Minh', true]);
const { result: ds } = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(outDir, 'dawn.png'), Buffer.from(ds.data, 'base64'));
report.flow = flow;
writeFileSync(join(outDir, 'webcheck.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
ws.close();
proc.kill();
const slow = Object.values(report.bench).some((b) => !b || b.avg_fps < 30);
const flowFail = (report.flow || []).some((f) => !f.ok);
process.exit(errors.length || slow || flowFail ? 1 : 0);
