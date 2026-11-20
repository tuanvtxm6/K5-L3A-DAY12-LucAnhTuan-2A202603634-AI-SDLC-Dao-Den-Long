// Drives a real Chrome over the DevTools protocol: screenshots per night, console errors, FPS bot, flow checks.
// Usage: node scripts/webcheck.js [outDir]   (starts its own server with a throw-away leaderboard file;
//        GAME_URL=http://... to test a running server instead; CHROME=/path/to/chrome to override)
// Writes <outDir>/night{1,2,3}.png, menu.png and webcheck.json. Exit 1 on console errors or avg FPS < 30.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const outDir = resolve(process.argv[2] || 'docs/proof/phase-4');
let base = process.env.GAME_URL, ownServer = null;
if (!base) {
  process.env.DDL_LEADERBOARD = join(mkdtempSync(join(tmpdir(), 'ddl-lb-')), 'leaderboard.json');
  const { createGameServer } = await import('./serve.js');
  ownServer = createGameServer();
  await new Promise((r) => ownServer.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + ownServer.address().port;
}
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
const quick = !!process.env.FLOW_ONLY; // skip screenshots + FPS bench
if (!quick) await shot(`${base}/`, 'menu.png', 1500);
report.gpu = await evaluate(`(() => { const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'; })()`);
if (!quick) for (const n of [1, 2, 3]) await shot(`${base}/?night=${n}&autostart=1&seed=7`, `night${n}.png`, 2500);
report.bench = {};
for (const n of quick ? [] : [1, 2, 3]) {
  await send('Page.navigate', { url: `${base}/?night=${n}&autostart=1&seed=7&fpsbot=1` });
  let b = null;
  for (let i = 0; i < 40 && !b; i++) { await sleep(500); b = await evaluate('window.__bench || null'); }
  report.bench[`night${n}`] = b;
}
if (!quick) await shot(`${base}/?night=3&autostart=1&seed=7&fpsbot=1`, 'night3-action.png', 6000);

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
  const s = document.getElementById('sens'); s.value = '1.7'; s.dispatchEvent(new Event('input'));
  const cb = document.getElementById('cb'); cb.checked = true; cb.dispatchEvent(new Event('change')); ${click('Xong')}; return __ddl.screen; })()`, 'pause');
await go('?night=1');
await step('settings survive a reload (incl. colour-blind mode applied)', `[(({ volume, sensitivity, colorblind }) => ({ volume, sensitivity, colorblind }))(JSON.parse(localStorage.getItem('ddl-settings'))), document.body.classList.contains('cb'), getComputedStyle(document.body).getPropertyValue('--danger').trim()]`,
  [{ volume: 0.3, sensitivity: 1.7, colorblind: true }, true, '#ffffff']);
await evaluate(`localStorage.removeItem('ddl-settings')`);
await go('?night=1&autostart=1&seed=3');
await step('HUD: hint near lantern + timer red at <= 30 s', `(() => { const g = __ddl.game; g.player.pos = [0, 0, 23.5]; g.startTicks = g.simTick + 30 * 60;
  return new Promise(r => setTimeout(() => r([document.getElementById('hint').textContent, document.getElementById('timer').classList.contains('danger')]), 300)); })()`,
['E — Nạp ánh sáng (0/10)', true]);
await step('win night 1 -> result -> next night intro', `(() => { __ddl.game.lanterns.forEach(L => { L.lit = true; L.fu = 6000; }); __ddl.game.startTicks = __ddl.game.simTick + 1; return new Promise(r => setTimeout(() => {
  const txt = document.querySelector('#card').textContent; ${click('Sang Đêm 2')}; r([/Đêm 1 đã sáng/.test(txt), __ddl.screen, document.querySelector('#card h2').textContent]); }, 300)); })()`,
[true, 'intro', 'Đêm 2: Đảo Cau']);
await go('?night=2&autostart=1&seed=3');
await step('lose (dawn) -> name form + retry same night', `(() => { const g = __ddl.game; g.startTicks = g.simTick + 1; return new Promise(r => setTimeout(() =>
  r([__ddl.screen, !!document.getElementById('lbName'), [...document.querySelectorAll('#card button')].map((b) => b.textContent)]), 300)); })()`,
['result', true, ['Lưu điểm (Enter)', 'Chơi lại Đêm 2', 'Về menu']]);
// ---- P4: leaderboard ----
await step('leaderboard: invalid name rejected', `(() => { document.getElementById('lbName').value = 'ab'; ${click('Lưu điểm')};
  return new Promise(r => setTimeout(() => r([__ddl.screen, document.getElementById('lbErr').textContent.startsWith('⚠')]), 200)); })()`, ['result', true]);
await step('leaderboard: Vietnamese name saved on disk via API, highlighted, ISO time with offset', `(async () => {
  document.getElementById('lbName').value = 'Mây_01'; ${click('Lưu điểm')};
  await new Promise(r => setTimeout(r, 400));
  const row = document.querySelector('table.lb tr.me');
  const api = await (await fetch('/api/leaderboard')).json();
  const iso = /T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$/;
  return [__ddl.screen, row ? row.children[1].textContent : null, api.entries.map((e) => [e.name, e.nights_won, iso.test(e.achieved_at)])]; })()`,
['leaderboard', 'Mây_01', [['Mây_01', 0, true]]]);
await go('');
await step('menu has a Bảng xếp hạng screen', `(async () => { ${click('Bảng xếp hạng')}; await new Promise(r => setTimeout(r, 300));
  return [__ddl.screen, document.querySelectorAll('table.lb tr').length]; })()`, ['leaderboard', 2]);
// ---- P4: accessibility ----
await go('');
await step('rebinding: duplicate key flagged, reset restores defaults, saved', `(async () => { ${click('Cài đặt')};
  document.querySelector('button.key[data-action=jump]').click(); dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
  await new Promise(r => setTimeout(r, 100));
  const warn = document.getElementById('keyWarn').textContent, dup = document.querySelectorAll('button.key.dup').length;
  const saved = JSON.parse(localStorage.getItem('ddl-settings')).keys.jump;
  ${click('Khôi phục phím mặc định')}; await new Promise(r => setTimeout(r, 100));
  return [warn, dup, saved, JSON.parse(localStorage.getItem('ddl-settings')).keys.jump, document.getElementById('keyWarn').textContent]; })()`,
['⚠ Phím E đang trùng: Nhảy và Tương tác', 2, 'KeyE', 'Space', '']);
await step('rebinding offers all 9 actions', `[...document.querySelectorAll('button.key')].map((b) => b.dataset.action)`,
['up', 'down', 'left', 'right', 'jump', 'dash', 'interact', 'pulse', 'pause']);
await go('?night=1&autostart=1&seed=3');
await step('UI text >= 18 px at 1280x720 (visible HUD); large text x1.25', `(async () => {
  const g = __ddl.game; g.player.pos = [0, 0, 23.5]; g.lanterns[1].lit = true; g.lanterns[1].fu = 1000;
  await new Promise(r => setTimeout(r, 400));
  const sizes = [...document.querySelectorAll('.hud, .hud *')]
    .filter((el) => getComputedStyle(el).display !== 'none' && el.textContent.trim() && el.getClientRects().length)
    .map((el) => parseFloat(getComputedStyle(el).fontSize));
  document.body.classList.add('big'); const big = parseFloat(getComputedStyle(document.getElementById('hint')).fontSize); document.body.classList.remove('big');
  return [innerWidth, innerHeight, sizes.length > 5, Math.min(...sizes) >= 18, big]; })()`, [1280, 720, true, true, 22.5]);
await step('captions: low fuel, last 10 s, shade spawn + edge arrow', `(async () => {
  const g = __ddl.game; g.simTick = 298; g.startTicks = g.simTick + 9 * 60;
  await new Promise(r => setTimeout(r, 300));
  const t = document.getElementById('captions').textContent;
  return [/Đèn L2 sắp cạn dầu/.test(t), /10 giây/.test(t), /Bóng Mực xuất hiện/.test(t), getComputedStyle(document.getElementById('spawnArrow')).display]; })()`,
[true, true, true, 'block']);
await go('?night=3&autostart=1&seed=3');
await step('captions: wind warning on night 3', `(async () => { __ddl.game.simTick = 1675; await new Promise(r => setTimeout(r, 300));
  return /Gió sắp thổi/.test(document.getElementById('captions').textContent); })()`, true);
const forceHit = `async () => { const g = __ddl.game; g.player.invuln = 0;
  g.shades.push({ id: 'SX' + g.tick, pos: [g.player.pos[0] + 0.3, 1, g.player.pos[2]], state: 'chase', ticks: 0, push: 0, pushDir: null, dir: null, left: 0, evict: false, wp: null, target: null, drainTicks: 0 });
  for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 10)); if (document.getElementById('flash').style.opacity === '0.35') return [g.player.flames, true]; }
  return [g.player.flames, false]; }`;
await go('?night=1&autostart=1&seed=3');
await step('screen flash on hit (motion allowed)', `(${forceHit})()`, [2, true]);
await evaluate(`localStorage.setItem('ddl-settings', JSON.stringify({ reduceMotion: true }))`);
await go('?night=1&autostart=1&seed=3');
await step('reduce motion (saved): hit still counts, no flash, no blink', `(${forceHit})().then(([f, flashed]) => [document.body.classList.contains('rm'), f, flashed])`, [true, 2, false]);
await evaluate(`localStorage.removeItem('ddl-settings')`);
await go('?night=3&autostart=1&seed=3');
await step('win night 3 -> Bình Minh with total score', `(() => { __ddl.game.lanterns.forEach(L => { L.lit = true; L.fu = 6000; }); __ddl.game.startTicks = __ddl.game.simTick + 1; return new Promise(r => setTimeout(() =>
  r([__ddl.screen, document.querySelector('#card h1').textContent, /Tổng điểm: \\d+/.test(document.querySelector('#card').textContent)]), 300)); })()`, ['dawn', 'Bình Minh', true]);
const { result: ds } = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(outDir, 'dawn.png'), Buffer.from(ds.data, 'base64'));
await go('?night=3&autostart=1&seed=3');
await step('Night 3 ramp meshes slope like the sim surface (both ends within 0.25 m)', `(() => {
  const ramps = __ddl.world.level.children.filter((m) => m.userData.ramp);
  return ramps.length === 2 && ramps.every((m) => { m.updateWorldMatrix(true, false);
    return [-1, 1].every((e) => { const v = new m.position.constructor(e * (m.userData.ramp.len / 2 - 0.3), 0.15, 0); m.localToWorld(v);
      return Math.abs(v.y - __ddl.game.map.surface(v.x, v.z)) < 0.25; }); }); })()`, true);
// P3 visual: lit (full), low-fuel (blinking) and out lanterns side by side
await go('?night=1&autostart=1&seed=3&at=0,0,12&yaw=0');
await evaluate(`(() => { const g = __ddl.game; g.shades = []; const [L1, L2, L5] = [0, 1, 4].map((i) => g.lanterns[i]);
  L1.pos = [-4, 0, 22]; L2.pos = [0, 0, 24]; L5.pos = [4, 0, 22]; L1.lit = true; L1.fu = 6000; L1.everLit = true;
  L2.lit = true; L2.fu = 1200; L2.everLit = true; L5.lit = false; L5.everLit = true; __ddl.world.build(g); })()`);
await sleep(700);
{ const { result: ls } = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, 'lanterns-fuel.png'), Buffer.from(ls.data, 'base64')); }
report.flow = flow;
ownServer?.close();
writeFileSync(join(outDir, 'webcheck.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
ws.close();
proc.kill();
const slow = Object.values(report.bench).some((b) => !b || b.avg_fps < 30);
const flowFail = (report.flow || []).some((f) => !f.ok);
process.exit(errors.length || slow || flowFail ? 1 : 0);
