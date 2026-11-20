// Browser shell: screen flow (menu -> intro -> play -> result -> next night / dawn), input, pause,
// settings, HUD. All rules live in /src/core/sim.js (same code as headless).
import * as THREE from 'three';
import { Game } from '/src/core/sim.js';
import { TUNING } from '/src/core/tuning.js';
import { MAPS } from '/src/core/maps.js';
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
const settings = { volume: 0.6, sensitivity: 1 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}')); } catch { /* private mode */ }
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch { /* ignore */ } };
audio.setVolume(settings.volume);

// ---------- story ----------
const INTRO = {
  1: 'Mây à, đom đóm sợ bóng tối hơn cháu đấy. Gom chúng lại, thắp năm ngọn đèn bến cảng trước khi trời sáng.',
  2: 'Hai hòn Cau cách nhau một nhịp cầu tre. Bục gỗ sẽ đưa cháu qua biển mây. Coi chừng Gió Lạc, chúng mê ánh sáng cháu mang.',
  3: 'Tháp chuông ở tầng cao nhất. Gió đảo này thất thường. Nghe tiếng lá xào xạc thì đứng vững chân nhé.',
};
const CONTROLS = `<p><kbd>WASD</kbd> đi · <kbd>Space</kbd> nhảy · <kbd>Shift</kbd> lướt · <kbd>E</kbd> nạp đèn · <kbd>Q</kbd> tỏa sáng<br>
  Kéo chuột / <kbd>←</kbd><kbd>→</kbd> xoay camera · <kbd>Esc</kbd>/<kbd>P</kbd> tạm dừng</p>`;

// ---------- flow ----------
let screen = 'menu', game = null, night = 1, wonScores = {}, acc = 0, camYaw = 0, settingsBack = 'menu';
function show(html, buttons = []) {
  $('card').innerHTML = html;
  for (const [label, fn] of buttons) {
    const b = document.createElement('button'); b.textContent = label; b.onclick = fn; $('card').appendChild(b);
  }
  $('overlay').style.display = 'flex';
  $('card').querySelector('button')?.focus();
  document.body.classList.remove('playing');
}
const hide = () => { $('overlay').style.display = 'none'; document.body.classList.add('playing'); };
const total = () => Object.values(wonScores).reduce((a, b) => a + b, 0);

function menu() {
  screen = 'menu'; wonScores = {};
  show(`<h1>Đảo Đèn Lồng</h1><p>Sương đen đã nuốt ánh sáng của ba hòn đảo. Mây đội nón lá, cầm đèn nhỏ, đi thắp lại từng Đèn Lồng Lớn.</p>${CONTROLS}`, [
    ['Bắt đầu: Đêm 1', () => intro(1)], ['Chơi Đêm 2', () => intro(2)], ['Chơi Đêm 3', () => intro(3)],
    ['Cài đặt', () => openSettings('menu')]]);
}
function intro(n) {
  audio.resume(); audio.startMusic();
  screen = 'intro'; night = n;
  show(`<h2>Đêm ${n}: ${MAPS[n].name}</h2><p class="quote">Ông Đăng: "${INTRO[n]}"</p>
    <p>${MAPS[n].lanterns.length} Đèn Lồng Lớn · ${TUNING[MAPS[n].duration_key]} giây tới bình minh</p>`, [['Vào đêm (Enter)', () => start(n)]]);
}
function start(n) {
  const seedParam = params.get('seed');
  game = new Game({ seed: seedParam !== null ? Number(seedParam) : (Math.random() * 2 ** 31) | 0, night: n });
  world.build(game);
  camYaw = 0; acc = 0; screen = 'play'; lastSecond = null;
  hide();
}
function result() {
  const won = game.state === 'won';
  audio.sfx[won ? 'win' : 'lose']();
  if (won) wonScores[night] = game.score;
  const why = { all_lit: 'Mọi đèn đã sáng!', no_flames: 'Mây đã hết Ngọn Lửa.', dawn: 'Bình minh tới mà đảo vẫn chưa sáng.' }[game.result.reason];
  if (won && night === 3) {
    screen = 'dawn';
    show(`<h1>Bình Minh</h1><p>Ba hòn đảo đã sáng lại. Ông Đăng mỉm cười bên bến cảng.</p>
      <p>Đêm 1: <b>${wonScores[1] ?? 0}</b> · Đêm 2: <b>${wonScores[2] ?? 0}</b> · Đêm 3: <b>${wonScores[3] ?? 0}</b></p>
      <h2>Tổng điểm: ${total()}</h2>`, [['Về menu', menu]]);
    return;
  }
  screen = 'result';
  show(`<h2>${won ? `Đêm ${night} đã sáng!` : `Đêm ${night} chưa thành`}</h2><p>${why}</p>
    <p>Điểm đêm này: <b>${game.score}</b> · Tổng điểm: <b>${total()}</b></p>`,
    won ? [[`Sang Đêm ${night + 1} (Enter)`, () => intro(night + 1)], ['Về menu', menu]]
      : [[`Chơi lại Đêm ${night} (Enter)`, () => intro(night)], ['Về menu', menu]]);
}
function pause() {
  screen = 'pause';
  show('<h2>Tạm dừng</h2>', [['Tiếp tục', resumeGame], ['Chơi lại Đêm', () => start(night)], ['Cài đặt', () => openSettings('pause')], ['Về menu', menu]]);
}
function resumeGame() { screen = 'play'; hide(); }
function openSettings(back) {
  settingsBack = back; screen = 'settings';
  show(`<h2>Cài đặt</h2>
    <label>Âm lượng <input type="range" id="vol" min="0" max="1" step="0.05" value="${settings.volume}"></label>
    <label>Độ nhạy chuột <input type="range" id="sens" min="0.2" max="3" step="0.1" value="${settings.sensitivity}"></label>`,
  [['Xong', () => (settingsBack === 'pause' ? pause() : menu())]]);
  $('vol').oninput = (e) => { settings.volume = Number(e.target.value); audio.setVolume(settings.volume); saveSettings(); };
  $('sens').oninput = (e) => { settings.sensitivity = Number(e.target.value); saveSettings(); };
}

// ---------- input ----------
const keys = new Set(), latch = { jump: false, interact: false, pulse: false, dash: false };
const ACTION_KEYS = { Space: 'jump', KeyE: 'interact', KeyQ: 'pulse', ShiftLeft: 'dash', ShiftRight: 'dash' };
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.code === 'F3') { $('fps').style.display = $('fps').style.display === 'none' ? '' : 'none'; return; }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (screen === 'play') pause(); else if (screen === 'pause') resumeGame();
    return;
  }
  if (screen === 'play') {
    if (!keys.has(e.code) && ACTION_KEYS[e.code]) latch[ACTION_KEYS[e.code]] = true;
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
  let x = 0, z = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
  if (keys.has('KeyA')) x += 1; // camera looks along +Z at yaw 0, so screen-left is +X
  if (keys.has('KeyD')) x -= 1;
  const held = (a) => latch[a] || Object.entries(ACTION_KEYS).some(([k, v]) => v === a && keys.has(k));
  return { move: [x, z], cam_yaw_deg: camYaw, jump: held('jump'), interact: held('interact'), pulse: held('pulse'), dash: held('dash') };
}

// ---------- bench / screenshot hooks: ?night=N&autostart=1&bench=1 ----------
const bench = params.has('bench') ? { t0: null, frames: 0, worst: 0 } : null;
function botInput(t) { // scripted run for the FPS benchmark
  const a = t * 0.6;
  return { move: [Math.sin(a), 1], cam_yaw_deg: (t * 20) % 360, jump: Math.floor(t * 2) % 5 === 0, interact: false, pulse: Math.floor(t) % 4 === 0, dash: Math.floor(t * 2) % 3 === 0 };
}

// ---------- loop ----------
let last = performance.now(), lastSecond = null, fpsFrames = 0, fpsT = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (screen === 'play') {
    const inp = bench ? botInput(now / 1000) : readInput(dt);
    acc += dt;
    while (acc >= 1 / HZ && game.state === 'playing') {
      acc -= 1 / HZ;
      const p = game.player, wasGrounded = p.grounded;
      for (const ev of game.step(inp)) {
        audio.sfx[ev.name]?.();
        if (ev.name === 'pulse') world.pulse();
      }
      for (const k in latch) latch[k] = false;
      if (wasGrounded && !p.grounded && p.vel[1] > 0 && !p.launch) audio.sfx.jump();
      if (game.wind.nextDir !== null && game.simTick % 1800 === 1680) audio.sfx.wind();
    }
    const sec = Math.ceil(game.timeLeftTicks() / HZ);
    if (sec <= 10 && sec !== lastSecond && sec > 0) audio.sfx.tick();
    lastSecond = sec;
    if (game.state !== 'playing' && !bench) result();
  }
  if (game) { const lit = world.update(game, now / 1000, camYaw); drawHud(lit); }
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
const cells = Array.from({ length: TUNING.carry_capacity }, () => { const c = document.createElement('div'); c.className = 'cell'; $('motes').appendChild(c); return c; });
const v3 = new THREE.Vector3();
function drawHud(lit) {
  const p = game.player;
  $('flames').innerHTML = Array.from({ length: TUNING.flames }, (_, i) => `<div class="flame ${i < p.flames ? '' : 'out'}"></div>`).join('');
  const tl = game.timeLeftTicks() / HZ;
  $('timer').textContent = `${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(Math.floor(tl % 60)).padStart(2, '0')}`;
  $('timer').classList.toggle('danger', tl <= 30);
  $('right').innerHTML = `<span>Đèn <b>${lit}/${game.lanterns.length}</b></span><span>Điểm <b>${game.score}</b>${total() ? ` · Tổng <b>${total()}</b>` : ''}</span>`;
  cells.forEach((c, i) => c.classList.toggle('on', i < p.carried));
  const cd = (label, key, ticks, full, ok) => {
    const pct = full ? Math.round((ticks / full) * 100) : 0;
    return `<div class="cd ${ticks === 0 && ok ? 'ready' : ''}" style="--p:${pct}%"><div>${ticks > 0 ? (ticks / HZ).toFixed(1) : label}<small>${key}</small></div></div>`;
  };
  $('cds').innerHTML = cd('Lướt', 'Shift', p.charm > 0 ? 0 : p.dashCd, TUNING.dash_cooldown_s * HZ, true)
    + cd('Tỏa', 'Q', p.pulseCd, TUNING.pulse_cooldown_s * HZ, p.carried >= TUNING.pulse_cost);
  $('charm').style.display = p.charm > 0 ? '' : 'none';
  $('charm').textContent = `Bùa Gió ${(p.charm / HZ).toFixed(1)}s`;

  // hint near an unlit lantern
  const nearL = game.lanterns.find((L) => !L.lit && Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]) <= TUNING.interact_radius);
  $('hint').style.display = nearL ? '' : 'none';
  if (nearL) $('hint').textContent = `E — Nạp ánh sáng (${nearL.deposited}/${TUNING.lantern_cost})`;

  // arrow toward the nearest unlit lantern when it is off-screen
  let target = null, best = Infinity;
  for (const L of game.lanterns) {
    if (L.lit) continue;
    const d = Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]);
    if (d < best) { best = d; target = L; }
  }
  const arrow = $('arrow');
  arrow.style.display = 'none';
  if (target) {
    v3.set(target.pos[0], target.pos[1] + 3.6, target.pos[2]).project(world.camera);
    const behind = v3.z > 1;
    let x = behind ? -v3.x : v3.x, y = behind ? -v3.y : v3.y;
    if (behind || Math.abs(x) > 0.95 || Math.abs(y) > 0.95) {
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
$('fps').style.display = params.has('fps') || bench ? '' : 'none';
const startNight = Number(params.get('night')) || 1;
if (params.has('autostart')) {
  night = startNight; start(startNight);
  // ?at=x,y,z&yaw=deg places Mây for screenshots (debug only)
  if (params.has('at')) game.player.pos = params.get('at').split(',').map(Number);
  if (params.has('yaw')) camYaw = Number(params.get('yaw'));
} else if (params.has('night')) intro(startNight); else menu();
requestAnimationFrame(frame);
