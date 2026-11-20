// Browser shell: screen flow (menu -> intro -> play -> result -> next night / dawn), input, pause,
// settings, HUD. All rules live in /src/core/sim.js (same code as headless).
import * as THREE from 'three';
import { Game, DEFAULT_INPUT } from '/src/core/sim.js';
import { benchScenario, benchCamera, frameStats } from '/src/core/bench.js';
import { TUNING } from '/src/core/tuning.js';
import { MAPS } from '/src/core/maps.js';
import { addEntry, isoWithOffset, validName } from '/src/core/leaderboard.js';
import { World } from './world.js';
import * as audio from './audio.js';

const HZ = 60;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const world = new World(renderer);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); world.resize(); });

// ---------- settings (persisted) ----------
const ACTIONS = [
  ['up', 'Đi tới'], ['down', 'Đi lùi'], ['left', 'Sang trái'], ['right', 'Sang phải'],
  ['jump', 'Nhảy'], ['dash', 'Lướt'], ['interact', 'Tương tác'], ['pulse', 'Tỏa sáng'], ['pause', 'Tạm dừng'],
];
const DEFAULT_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyQ', pause: 'KeyP' };
const settings = {
  volume: 0.6, sensitivity: 1, colorblind: false, largeText: false,
  reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, keys: { ...DEFAULT_KEYS },
};
try {
  const saved = JSON.parse(localStorage.getItem('ddl-settings') || '{}');
  Object.assign(settings, saved, { keys: { ...DEFAULT_KEYS, ...(saved.keys || {}) } });
} catch { /* private mode */ }
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch { /* ignore */ } };
audio.setVolume(settings.volume);
const applyPrefs = () => {
  document.body.classList.toggle('cb', settings.colorblind); world.setColorblind(settings.colorblind);
  document.body.classList.toggle('big', settings.largeText);
  document.body.classList.toggle('rm', settings.reduceMotion);
};
applyPrefs();
const KEY_NAMES = { Space: 'Space', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
const keyName = (code) => KEY_NAMES[code] || code.replace(/^Key/, '').replace(/^Digit/, '');
function keyConflicts(keys = settings.keys) {
  const by = {};
  for (const [a] of ACTIONS) (by[keys[a]] ||= []).push(a);
  return Object.entries(by).filter(([, list]) => list.length > 1);
}

// ---------- story ----------
const INTRO = {
  1: 'Mây à, đom đóm sợ bóng tối hơn cháu đấy. Gom chúng lại, thắp năm ngọn đèn bến cảng trước khi trời sáng.',
  2: 'Hai hòn Cau cách nhau một nhịp cầu tre. Bục gỗ sẽ đưa cháu qua biển mây. Coi chừng Gió Lạc, chúng mê ánh sáng cháu mang.',
  3: 'Tháp chuông ở tầng cao nhất. Gió đảo này thất thường. Nghe tiếng lá xào xạc thì đứng vững chân nhé.',
};
const controlsHtml = () => {
  const k = (a) => `<kbd>${keyName(settings.keys[a])}</kbd>`;
  return `<p>${k('up')}${k('left')}${k('down')}${k('right')} đi · ${k('jump')} nhảy · ${k('dash')} lướt · ${k('interact')} nạp đèn · ${k('pulse')} tỏa sáng<br>
  Kéo chuột / <kbd>←</kbd><kbd>→</kbd> xoay camera · <kbd>Esc</kbd>/${k('pause')} tạm dừng</p>`;
};

// ---------- leaderboard (disk via scripts/serve.js; localStorage fallback for a static host) ----------
const LB_LOCAL = 'ddl-leaderboard';
async function lbLoad() {
  try { const r = await fetch('/api/leaderboard'); if (r.ok) return (await r.json()).entries; } catch { /* offline */ }
  try { return JSON.parse(localStorage.getItem(LB_LOCAL) || '[]'); } catch { return []; }
}
async function lbSave(entry) {
  try {
    const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) });
    if (r.ok) return await r.json();
  } catch { /* offline */ }
  const res = addEntry(await lbLoad(), { ...entry, achieved_at: isoWithOffset() });
  try { localStorage.setItem(LB_LOCAL, JSON.stringify(res.entries)); } catch { /* ignore */ }
  return res;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
function lbTable(entries, highlight = null) {
  if (!entries.length) return '<p>Chưa có ai trên bảng.</p>';
  return `<table class="lb"><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm</th><th>Ngày</th></tr>${entries.map((e, i) =>
    `<tr${highlight === i + 1 ? ' class="me"' : ''}><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${esc(e.achieved_at.slice(0, 10))}</td></tr>`).join('')}</table>`;
}
async function leaderboardScreen(highlight = null) {
  screen = 'leaderboard';
  show(`<h2>Bảng xếp hạng</h2>${lbTable(await lbLoad(), highlight)}`, [['Về menu', menu]]);
}

// ---------- flow ----------
let screen = 'menu', game = null, night = 1, wonScores = {}, acc = 0, camYaw = 0, settingsBack = 'menu', sessionSeed = 0;
function show(html, buttons = []) {
  $('card').innerHTML = html;
  for (const [label, fn] of buttons) {
    const b = document.createElement('button'); b.textContent = label; b.onclick = fn; $('card').appendChild(b);
  }
  $('overlay').style.display = 'flex';
  ($('card').querySelector('input[type=text]') || $('card').querySelector('button'))?.focus();
  document.body.classList.remove('playing');
}
const hide = () => { $('overlay').style.display = 'none'; document.body.classList.add('playing'); };
const total = () => Object.values(wonScores).reduce((a, b) => a + b, 0);
const nightsWon = () => Object.keys(wonScores).length;

function newSession() {
  wonScores = {};
  const seedParam = params.get('seed');
  sessionSeed = seedParam !== null ? Number(seedParam) : (Math.random() * 2 ** 31) | 0;
}
function menu() {
  screen = 'menu'; newSession();
  show(`<h1>Đảo Đèn Lồng</h1><p>Sương đen đã nuốt ánh sáng của ba hòn đảo. Mây đội nón lá, cầm đèn nhỏ, đi thắp lại từng Đèn Lồng Lớn.</p>${controlsHtml()}`, [
    ['Bắt đầu: Đêm 1', () => intro(1)], ['Chơi Đêm 2', () => intro(2)], ['Chơi Đêm 3', () => intro(3)],
    ['Bảng xếp hạng', () => leaderboardScreen()], ['Cài đặt', () => openSettings('menu')]]);
}
function intro(n) {
  audio.resume(); audio.startMusic();
  screen = 'intro'; night = n;
  show(`<h2>Đêm ${n}: ${MAPS[n].name}</h2><p class="quote">Ông Đăng: "${INTRO[n]}"</p>
    <p>Giữ ít nhất <b>${Math.ceil(TUNING.win_ratio * MAPS[n].lanterns.length)}/${MAPS[n].lanterns.length}</b> Đèn Lồng sáng tới bình minh (${TUNING[MAPS[n].duration_key]} giây). Đèn cạn dầu sẽ tắt; châm thêm đom đóm để giữ lửa.</p>`, [['Vào đêm (Enter)', () => start(n)]]);
}
function start(n) {
  game = new Game({ seed: sessionSeed + n - 1, night: n });
  world.build(game);
  camYaw = 0; acc = 0; screen = 'play'; lastSecond = null; captionsReset();
  hide();
}
const nameForm = () => `<label class="name">Tên của bạn (3–12 chữ, số hoặc _; gõ tiếng Việt được)
  <input type="text" id="lbName" maxlength="12" autocomplete="off"></label><p id="lbErr" class="err"></p>`;
async function saveScore() {
  const name = $('lbName').value.trim();
  if (!validName(name)) { $('lbErr').textContent = '⚠ Tên cần 3–12 ký tự: chữ, số hoặc dấu gạch dưới.'; return; }
  const res = await lbSave({ name, score: total(), nights_won: nightsWon(), seed: sessionSeed });
  leaderboardScreen(res.rank);
}
function result() {
  const won = game.state === 'won';
  audio.sfx[won ? 'win' : 'lose']();
  if (won) wonScores[night] = game.score;
  const litNow = game.lanterns.filter((L) => L.lit).length, need = game.litNeeded();
  const why = { dawn_survived: `Bình minh tới, ${litNow}/${game.lanterns.length} đèn vẫn sáng!`, no_flames: 'Mây đã hết Ngọn Lửa.', dawn: `Bình minh tới nhưng chỉ còn ${litNow}/${game.lanterns.length} đèn sáng (cần ${need}).` }[game.result.reason];
  if (won && night === 3) {
    screen = 'dawn';
    show(`<h1>Bình Minh</h1><p>Ba hòn đảo đã sáng lại. Ông Đăng mỉm cười bên bến cảng.</p>
      <p>Đêm 1: <b>${wonScores[1] ?? 0}</b> · Đêm 2: <b>${wonScores[2] ?? 0}</b> · Đêm 3: <b>${wonScores[3] ?? 0}</b></p>
      <h2>Tổng điểm: ${total()}</h2>${nameForm()}`, [['Lưu điểm (Enter)', saveScore], ['Về menu', menu]]);
    return;
  }
  screen = 'result';
  show(`<h2>${won ? `Đêm ${night} đã sáng!` : `Đêm ${night} chưa thành`}</h2><p>${why}</p>
    <p>Điểm đêm này: <b>${game.score}</b> · Tổng điểm: <b>${total()}</b></p>${won ? '' : nameForm()}`,
    won ? [[`Sang Đêm ${night + 1} (Enter)`, () => intro(night + 1)], ['Về menu', menu]]
      : [['Lưu điểm (Enter)', saveScore], [`Chơi lại Đêm ${night}`, () => intro(night)], ['Về menu', menu]]);
}
function pause() {
  screen = 'pause';
  show('<h2>Tạm dừng</h2>', [['Tiếp tục', resumeGame], ['Chơi lại Đêm', () => start(night)], ['Cài đặt', () => openSettings('pause')], ['Về menu', menu]]);
}
function resumeGame() { screen = 'play'; hide(); }
let capturing = null; // action waiting for a new key
function openSettings(back) {
  settingsBack = back; screen = 'settings';
  const conflicts = keyConflicts();
  const label = Object.fromEntries(ACTIONS);
  show(`<h2>Cài đặt</h2>
    <label>Âm lượng <input type="range" id="vol" min="0" max="1" step="0.05" value="${settings.volume}"></label>
    <label>Độ nhạy chuột <input type="range" id="sens" min="0.2" max="3" step="0.1" value="${settings.sensitivity}"></label>
    <label><input type="checkbox" id="cb" ${settings.colorblind ? 'checked' : ''}> Bảng màu dễ phân biệt (mù màu)</label>
    <label><input type="checkbox" id="rm" ${settings.reduceMotion ? 'checked' : ''}> Giảm chuyển động (tắt rung camera, chớp màn hình)</label>
    <label><input type="checkbox" id="big" ${settings.largeText ? 'checked' : ''}> Chữ lớn (×1.25)</label>
    <h3>Phím điều khiển</h3>
    <div class="keys">${ACTIONS.map(([a, l]) => `<span>${l}</span><button class="key${conflicts.some(([, list]) => list.includes(a)) ? ' dup' : ''}" data-action="${a}">${capturing === a ? 'Nhấn phím…' : keyName(settings.keys[a])}</button>`).join('')}</div>
    <p id="keyWarn" class="err">${conflicts.map(([k, list]) => `⚠ Phím ${keyName(k)} đang trùng: ${list.map((a) => label[a]).join(' và ')}`).join('<br>')}</p>
    <p class="note">Esc luôn mở tạm dừng; ← → xoay camera.</p>`,
  [['Khôi phục phím mặc định', () => { settings.keys = { ...DEFAULT_KEYS }; saveSettings(); openSettings(back); }],
    ['Xong', () => { capturing = null; if (settingsBack === 'pause') pause(); else menu(); }]]);
  $('vol').oninput = (e) => { settings.volume = Number(e.target.value); audio.setVolume(settings.volume); saveSettings(); };
  $('sens').oninput = (e) => { settings.sensitivity = Number(e.target.value); saveSettings(); };
  $('cb').onchange = (e) => { settings.colorblind = e.target.checked; saveSettings(); applyPrefs(); };
  $('rm').onchange = (e) => { settings.reduceMotion = e.target.checked; saveSettings(); applyPrefs(); };
  $('big').onchange = (e) => { settings.largeText = e.target.checked; saveSettings(); applyPrefs(); };
  for (const b of $('card').querySelectorAll('button.key')) b.onclick = () => { capturing = b.dataset.action; openSettings(back); };
}

// ---------- input ----------
const keys = new Set(), latch = { jump: false, interact: false, pulse: false, dash: false };
const isKey = (action, code) => settings.keys[action] === code;
addEventListener('keydown', (e) => {
  if (capturing) { // rebinding: Esc cancels, any other key is assigned (duplicates are allowed but flagged)
    e.preventDefault();
    if (e.code !== 'Escape') { settings.keys[capturing] = e.code; saveSettings(); }
    capturing = null; openSettings(settingsBack);
    return;
  }
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code) && screen === 'play') e.preventDefault();
  if (e.code === 'F3') { $('fps').style.display = $('fps').style.display === 'none' ? '' : 'none'; return; }
  if (e.code === 'Escape' || (isKey('pause', e.code) && (screen === 'play' || screen === 'pause'))) {
    if (screen === 'play') pause(); else if (screen === 'pause') resumeGame();
    return;
  }
  if (screen === 'play') {
    for (const a of ['jump', 'interact', 'pulse', 'dash']) if (!keys.has(e.code) && isKey(a, e.code)) latch[a] = true;
    keys.add(e.code);
  } else if (e.code === 'Enter' && document.activeElement?.tagName !== 'BUTTON') {
    $('card').querySelector('button')?.click();
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if (screen === 'play') pause(); });
let dragX = null;
renderer.domElement.addEventListener('pointerdown', (e) => { dragX = e.clientX; });
addEventListener('pointerup', () => { dragX = null; });
addEventListener('pointermove', (e) => {
  if (dragX === null || screen !== 'play') return;
  camYaw -= (e.clientX - dragX) * 0.3 * settings.sensitivity;
  dragX = e.clientX;
});

function readInput(dt) {
  if (keys.has('ArrowLeft')) camYaw += 120 * dt * settings.sensitivity;
  if (keys.has('ArrowRight')) camYaw -= 120 * dt * settings.sensitivity;
  const down = (a) => keys.has(settings.keys[a]);
  let x = 0, z = 0;
  if (down('up')) z += 1;
  if (down('down')) z -= 1;
  if (down('left')) x += 1; // camera looks along +Z at yaw 0, so screen-left is +X
  if (down('right')) x -= 1;
  const held = (a) => latch[a] || down(a);
  return { move: [x, z], cam_yaw_deg: camYaw, jump: held('jump'), interact: held('interact'), pulse: held('pulse'), dash: held('dash') };
}

// ---------- captions / visual cues (Ticket-04 §4) + camera shake & flash (off with reduce motion) ----------
let captions = [], spawnCue = null, shakeT = 0, lowSeen = new Set(), windSeen = -1, lastTenSeen = false;
function captionsReset() { captions = []; spawnCue = null; shakeT = 0; lowSeen = new Set(); windSeen = -1; lastTenSeen = false; $('captions').innerHTML = ''; }
function caption(text) {
  const until = performance.now() + 3500;
  const same = captions.find((c) => c.text === text); // identical cue: refresh instead of stacking
  if (same) same.until = until; else captions.push({ text, until });
  captions = captions.slice(-3);
}
function flash(color) {
  if (settings.reduceMotion) return;
  const f = $('flash'); f.style.background = color; f.style.opacity = '0.35';
  setTimeout(() => { f.style.opacity = '0'; }, 120);
}
function onGameEvent(ev) {
  if (ev.name === 'shade_spawned') { caption('⚠ Bóng Mực xuất hiện'); spawnCue = { id: ev.data.id, until: performance.now() + 3500 }; }
  if (ev.name === 'lantern_out') caption(`🏮 Đèn ${ev.data.lantern_id} đã tắt`);
  if (ev.name === 'player_hit') { if (!settings.reduceMotion) shakeT = 0.35; flash('#ff5a5f'); }
  if (ev.name === 'pulse') flash('#ffe9b0');
}
function cuesPerFrame() {
  const w = game.wind, gust = Math.floor(game.simTick / 1800);
  const left = game.timeLeftTicks() / HZ;
  if (left <= 10 && left > 0 && !lastTenSeen) { lastTenSeen = true; caption('⏳ Còn 10 giây tới bình minh'); }
  if (left > 10) lastTenSeen = false;
  if (w.nextDir !== null && !w.active && windSeen !== gust) { windSeen = gust; caption('🍃 Gió sắp thổi'); }
  for (const L of game.lanterns) {
    const low = L.lit && L.fu < TUNING.low_fuel_threshold * 60;
    if (low && !lowSeen.has(L.id)) { lowSeen.add(L.id); caption(`🏮 Đèn ${L.id} sắp cạn dầu`); }
    if (!low) lowSeen.delete(L.id);
  }
  const now = performance.now();
  captions = captions.filter((c) => c.until > now);
  $('captions').innerHTML = captions.map((c) => `<div>${esc(c.text)}</div>`).join('');
}

// ---------- FPS bot for webcheck: ?night=N&autostart=1&fpsbot=1 ----------
const bench = params.has('fpsbot') ? { t0: null, frames: 0, worst: 0 } : null;

// ---------- Ticket-04 benchmark scene: ?benchmark=1&seed=42&duration=30 (driven by scripts/bench.js) ----------
const benchmark = params.has('benchmark')
  ? { seed: Number(params.get('seed') ?? 42), duration: Number(params.get('duration') ?? 30), start: null, dts: [], prev: null }
  : null;
window.__threeRevision = THREE.REVISION;
function startBenchmark() {
  game = new Game({ seed: benchmark.seed, night: 1, scenario: benchScenario(benchmark.seed), bench: true });
  world.build(game);
  screen = 'play'; acc = 0;
  hide();
  window.__benchPhase = 'warmup';
}
function benchmarkFrame(now) {
  const b = benchmark;
  if (b.start === null) { b.start = now; window.__benchFirstFrameEpochMs = Date.now(); }
  const t = (now - b.start) / 1000;
  const [cx, cy, cz] = benchCamera(t);
  world.camera.position.set(cx, cy, cz);
  world.camera.lookAt(0, 0, 0);
  if (t >= 3 && window.__benchPhase === 'warmup') { window.__benchPhase = 'measure'; b.prev = now; return; }
  if (window.__benchPhase !== 'measure') return;
  b.dts.push(now - b.prev); b.prev = now;
  if (now - b.start >= (3 + b.duration) * 1000) {
    window.__benchPhase = 'done';
    window.__benchResult = { ...frameStats(b.dts), first_frame_epoch_ms: window.__benchFirstFrameEpochMs, canvas: [renderer.domElement.width, renderer.domElement.height] };
  }
}
function botInput(t) { // scripted run for the FPS benchmark
  const a = t * 0.6;
  return { move: [Math.sin(a), 1], cam_yaw_deg: (t * 20) % 360, jump: Math.floor(t * 2) % 5 === 0, interact: false, pulse: Math.floor(t) % 4 === 0, dash: Math.floor(t * 2) % 3 === 0 };
}

// ---------- loop ----------
let last = performance.now(), lastSecond = null, fpsFrames = 0, fpsT = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (screen === 'play') {
    const inp = benchmark ? DEFAULT_INPUT : bench ? botInput(now / 1000) : readInput(dt);
    acc += dt;
    while (acc >= 1 / HZ && game.state === 'playing') {
      acc -= 1 / HZ;
      const p = game.player, wasGrounded = p.grounded;
      for (const ev of game.step(inp)) {
        if (!benchmark) { audio.sfx[ev.name]?.(); onGameEvent(ev); }
        if (ev.name === 'pulse') world.pulse();
      }
      for (const k in latch) latch[k] = false;
      if (wasGrounded && !p.grounded && p.vel[1] > 0 && !p.launch) audio.sfx.jump();
      if (game.wind.nextDir !== null && game.simTick % 1800 === 1680) audio.sfx.wind();
    }
    const sec = Math.ceil(game.timeLeftTicks() / HZ);
    if (sec <= 10 && sec !== lastSecond && sec > 0) audio.sfx.tick();
    lastSecond = sec;
    if (game.state !== 'playing' && !bench && !benchmark) result();
  }
  if (game) { const lit = world.update(game, now / 1000, camYaw); drawHud(lit); }
  if (game && screen === 'play' && !benchmark) {
    cuesPerFrame();
    if (shakeT > 0 && !settings.reduceMotion) { // small camera shake on hit (off with reduce motion)
      shakeT -= dt; const a = Math.max(0, shakeT) * 0.8;
      world.camera.position.x += Math.sin(now * 0.09) * a; world.camera.position.y += Math.cos(now * 0.13) * a;
    }
  }
  if (benchmark && game) benchmarkFrame(now);
  renderer.render(world.scene, world.camera);

  fpsFrames++;
  if (now - fpsT >= 1000) { $('fps').textContent = `${Math.round((fpsFrames * 1000) / (now - fpsT))} FPS`; fpsFrames = 0; fpsT = now; }
  if (bench && screen === 'play') {
    if (bench.t0 === null) bench.t0 = now + 2000; // 2 s warm-up
    else if (now >= bench.t0) { bench.frames++; bench.worst = Math.max(bench.worst, dt); }
    if (now - bench.t0 >= 10000 && !window.__bench) {
      window.__bench = { avg_fps: (bench.frames * 1000) / (now - bench.t0), worst_frame_ms: bench.worst * 1000, frames: bench.frames, w: innerWidth, h: innerHeight };
    }
  }
  requestAnimationFrame(frame);
}

// ---------- HUD ----------
const cells = Array.from({ length: TUNING.capacity_max }, () => { const c = document.createElement('div'); c.className = 'cell'; $('motes').appendChild(c); return c; });
{ const t = document.createElement('span'); t.id = 'capText'; $('motes').appendChild(t); }
const v3 = new THREE.Vector3();
function drawHud(lit) {
  const p = game.player;
  $('flames').innerHTML = Array.from({ length: TUNING.flames }, (_, i) => `<div class="flame ${i < p.flames ? '' : 'out'}"></div>`).join('');
  const tl = game.timeLeftTicks() / HZ;
  $('timer').textContent = `${tl <= 30 && settings.colorblind ? '⚠ ' : ''}${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(Math.floor(tl % 60)).padStart(2, '0')}`;
  $('timer').classList.toggle('danger', tl <= 30);
  $('right').innerHTML = `<span>Đèn sáng <b>${lit}/${game.lanterns.length}</b> · cần <b>${game.litNeeded()}</b></span><span>Điểm <b>${game.score}</b>${total() ? ` · Tổng <b>${total()}</b>` : ''}</span>`;
  const cap = game.capacity();
  cells.forEach((c, i) => { c.classList.toggle('on', i < p.carried); c.style.display = i < cap ? '' : 'none'; });
  $('capText').textContent = `${p.carried}/${cap}`;
  const cd = (label, key, ticks, full, ok) => {
    const pct = full ? Math.round((ticks / full) * 100) : 0;
    return `<div class="cd ${ticks === 0 && ok ? 'ready' : ''}" style="--p:${pct}%"><div>${ticks > 0 ? (ticks / HZ).toFixed(1) : label}<small>${key}</small></div></div>`;
  };
  $('cds').innerHTML = cd('Lướt', 'Shift', p.charm > 0 ? 0 : p.dashCd, TUNING.dash_cooldown_s * HZ, true)
    + cd('Tỏa', 'Q', p.pulseCd, TUNING.pulse_cooldown_s * HZ, p.carried >= TUNING.pulse_cost);
  $('charm').style.display = p.charm > 0 ? '' : 'none';
  $('charm').textContent = `Bùa Gió ${(p.charm / HZ).toFixed(1)}s`;

  // hint near an unlit lantern
  const nearL = game.lanterns.find((L) => (!L.lit || L.fu < 6000) && Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]) <= TUNING.interact_radius);
  $('hint').style.display = nearL ? '' : 'none';
  const ik = keyName(settings.keys.interact);
  if (nearL) $('hint').textContent = nearL.lit ? `${ik} — Châm dầu (${Math.floor(nearL.fu / 60)}/${TUNING.fuel_max})`
    : `${ik} — Nạp ánh sáng (${nearL.deposited}/${nearL.everLit ? TUNING.relight_cost : TUNING.lantern_cost})`;

  // arrow toward the nearest unlit lantern when it is off-screen
  let target = null, best = Infinity;
  for (const L of game.lanterns) {
    if (L.lit && L.fu >= TUNING.low_fuel_threshold * 60) continue; // unlit or running low
    const d = Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]);
    if (d < best) { best = d; target = L; }
  }
  edgeArrow($('arrow'), target ? [target.pos[0], target.pos[1] + 3.6, target.pos[2]] : null);
  // shade-spawn cue: arrow toward the new shade for 3.5 s (Ticket-04 §4)
  const sh = spawnCue && spawnCue.until > performance.now() && game.shades.find((s) => s.id === spawnCue.id);
  edgeArrow($('spawnArrow'), sh ? sh.pos : null, true);
}

function edgeArrow(arrow, pos, always = false) {
  arrow.style.display = 'none';
  if (pos) {
    v3.set(pos[0], pos[1], pos[2]).project(world.camera);
    const behind = v3.z > 1;
    let x = behind ? -v3.x : v3.x, y = behind ? -v3.y : v3.y;
    if (always || behind || Math.abs(x) > 0.95 || Math.abs(y) > 0.95) {
      if (behind && Math.abs(x) < 1e-3 && Math.abs(y) < 1e-3) y = -1;
      const m = Math.max(Math.abs(x), Math.abs(y));
      x = (x / m) * 0.88; y = (y / m) * 0.82;
      const sx = ((x + 1) / 2) * innerWidth, sy = ((1 - y) / 2) * innerHeight;
      const ang = Math.atan2(x, y);
      arrow.style.display = 'block';
      arrow.style.transform = `translate(${sx - 14}px, ${sy - 15}px) rotate(${ang}rad)`;
    }
  }
}

// read-only-ish handle for scripts/webcheck.js (flow tests); gameplay never reads it
window.__ddl = { get game() { return game; }, get screen() { return screen; }, world };

// ---------- boot ----------
$('fps').style.display = params.has('fps') || bench || benchmark ? '' : 'none';
const startNight = Number(params.get('night')) || 1;
if (benchmark) startBenchmark();
else if (params.has('autostart')) {
  newSession(); night = startNight; start(startNight);
  // ?at=x,y,z&yaw=deg places Mây for screenshots (debug only)
  if (params.has('at')) game.player.pos = params.get('at').split(',').map(Number);
  if (params.has('yaw')) camYaw = Number(params.get('yaw'));
} else if (params.has('night')) { newSession(); intro(startNight); } else menu();
requestAnimationFrame(frame);
