// Ticket-04 benchmark. Opens a real 1280x720 Chrome window (vsync off), runs the standard bench scene
// (web/?benchmark=1), warms up 3 s, measures --duration s, writes bench.json, exits 0.
//   node scripts/bench.js --seed 42 --duration 30 --out bench.json [--headless]
// Needs Google Chrome / Chromium (set CHROME=/path if it is not found).
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, platform, release, tmpdir, totalmem, type, arch } from 'node:os';
import { join } from 'node:path';
import { createGameServer } from './serve.js';

const processStartMs = Date.now() - process.uptime() * 1000; // load_ms is measured from here
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const seed = Number(opt('--seed', 42)), duration = Number(opt('--duration', 30)), out = opt('--out', 'bench.json');
const headless = argv.includes('--headless') || process.env.BENCH_HEADLESS === '1';
const fail = (msg) => { console.error(`bench: ${msg}`); process.exit(1); };
if (!Number.isInteger(seed) || !(duration > 0)) fail('usage: --seed <int> --duration <s> --out <file>');

const chrome = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((p) => existsSync(p));
if (!chrome) fail('Chrome/Chromium not found; set CHROME=/path/to/chrome');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = createGameServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/?benchmark=1&seed=${seed}&duration=${duration}`;

const debugPort = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), 'ddl-bench-'));
const proc = spawn(chrome, [
  ...(headless ? ['--headless=new'] : []),
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
  '--window-size=1280,720', '--window-position=40,40', '--new-window',
  '--disable-gpu-vsync', '--disable-frame-rate-limit', // vsync off / uncapped rAF
  '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  'about:blank',
], { stdio: 'ignore' });

// ---- RSS of the whole browser process tree (MB) ----
function treeRssMb(rootPid) {
  try {
    let rows;
    if (platform() === 'win32') {
      rows = execFileSync('powershell', ['-NoProfile', '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | ForEach-Object { \"$($_.ProcessId) $($_.ParentProcessId) $($_.WorkingSetSize)\" }"], { encoding: 'utf8' })
        .trim().split(/\r?\n/).map((l) => l.trim().split(/\s+/).map(Number)).map(([p, pp, b]) => [p, pp, b / 2 ** 20]);
    } else {
      rows = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,rss='], { encoding: 'utf8' })
        .trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number)).map(([p, pp, kb]) => [p, pp, kb / 1024]);
    }
    const kids = new Map();
    for (const [p, pp] of rows) { if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(p); }
    const rss = new Map(rows.map(([p, , m]) => [p, m]));
    let total = 0;
    const stack = [rootPid], seen = new Set();
    while (stack.length) { const p = stack.pop(); if (seen.has(p)) continue; seen.add(p); total += rss.get(p) || 0; stack.push(...(kids.get(p) || [])); }
    return total;
  } catch { return null; }
}

// ---- CDP ----
let wsUrl = null;
for (let i = 0; i < 100 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch { /* starting */ }
  if (!wsUrl) await sleep(150);
}
if (!wsUrl) { proc.kill(); fail('could not connect to Chrome'); }
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let msgId = 0;
const pending = new Map(), pageErrors = [];
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++msgId; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.value;
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
const version = await send('Browser.getVersion');
await send('Page.navigate', { url });

let result = null, peak = null, lastSample = 0;
const sampleEvery = platform() === 'win32' ? 2000 : 500; // PowerShell is heavy: sample less often there
const deadline = Date.now() + (duration + 60) * 1000;
while (!result && Date.now() < deadline) {
  await sleep(250);
  const phase = await evaluate('window.__benchPhase || null');
  if (phase === 'measure' && Date.now() - lastSample >= sampleEvery) {
    lastSample = Date.now();
    const m = treeRssMb(proc.pid); if (m !== null) peak = Math.max(peak ?? 0, m);
  }
  if (phase === 'done') result = await evaluate('window.__benchResult');
  if (pageErrors.length) break;
}
const gpu = await evaluate(`(() => { const gl = document.createElement('canvas').getContext('webgl2');
  const e = gl && gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; })()`);
const threeRev = await evaluate('window.__threeRevision');
await send('Browser.close').catch(() => {});
ws.close();
proc.kill();
server.close();
try { rmSync(profile, { recursive: true, force: true }); } catch { /* chrome may still hold files */ }
if (!result) fail(pageErrors.length ? `page error: ${pageErrors[0]}` : 'timed out waiting for the bench result');

const contract = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
const r1 = (v) => Math.round(v * 10) / 10;
const report = {
  contract_version: contract.contract_version,
  avg_fps: r1(result.avg_fps),
  p1_low_fps: r1(result.p1_low_fps),
  frame_ms_p95: r1(result.frame_ms_p95),
  frames: result.frames,
  load_ms: Math.round(result.first_frame_epoch_ms - processStartMs),
  peak_mem_mb: peak === null ? null : Math.round(peak),
  vsync_off: true,
  renderer: `three.js r${threeRev} WebGL2 on ${version.product} (${headless ? 'headless' : 'windowed'}); GPU: ${gpu}`,
  os: `${type()} ${release()} ${arch()}; ${cpus()[0].model.trim()}; ${Math.round(totalmem() / 2 ** 30)} GB RAM`,
  // context (not required): canvas size, seed, duration, how memory was measured
  canvas: result.canvas, seed, duration_s: duration,
  peak_mem_note: 'RSS (working set on Windows) summed over the Chrome process tree, sampled during the measured window (every 0.5 s; 2 s on Windows)',
};
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exit(0);
