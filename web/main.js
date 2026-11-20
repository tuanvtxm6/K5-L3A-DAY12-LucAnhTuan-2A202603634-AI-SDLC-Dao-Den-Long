// Renderer + input for the browser. All gameplay lives in /src/core/sim.js (same code as headless).
// Everything here is presentation only: it reads game state and never changes rules.
import * as THREE from 'three';
import { Game } from '/src/core/sim.js';
import { TUNING, WORLD } from '/src/core/tuning.js';

const HZ = 60;
const $ = (id) => document.getElementById(id);

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const NIGHT = new THREE.Color(0x120a1e), DAWNISH = new THREE.Color(0x3a2a4a);
scene.background = NIGHT.clone();
scene.fog = new THREE.FogExp2(0x1a0f26, 0.032);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const hemi = new THREE.HemisphereLight(0x8a6cc0, 0x2a1830, 0.9);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9fa8ff, 0.25);
moon.position.set(-20, 40, 10);
scene.add(moon);

// island + sea of clouds
const island = new THREE.Mesh(
  new THREE.CylinderGeometry(WORLD.island_radius, WORLD.island_radius * 0.8, 3, 64),
  new THREE.MeshLambertMaterial({ color: 0x2f4a3a }),
);
island.position.y = -1.5;
scene.add(island);
const shore = new THREE.Mesh(new THREE.RingGeometry(WORLD.island_radius - 1.2, WORLD.island_radius, 64), new THREE.MeshLambertMaterial({ color: 0x5b5a3e }));
shore.rotation.x = -Math.PI / 2; shore.position.y = 0.01;
scene.add(shore);
const clouds = new THREE.Group();
const cloudMat = new THREE.MeshLambertMaterial({ color: 0x3d2f55, transparent: true, opacity: 0.85 });
for (let i = 0; i < 70; i++) {
  const a = (i / 70) * Math.PI * 2, r = WORLD.island_radius + 6 + (i * 37 % 30);
  const puff = new THREE.Mesh(new THREE.SphereGeometry(3 + (i % 5), 10, 8), cloudMat);
  puff.position.set(Math.cos(a) * r, -3 - (i % 3), Math.sin(a) * r);
  puff.scale.y = 0.45;
  clouds.add(puff);
}
scene.add(clouds);
// a few trees for scale
const treeMat = new THREE.MeshLambertMaterial({ color: 0x1f3b2c });
for (let i = 0; i < 26; i++) {
  const a = i * 2.39996, r = 8 + (i * 13 % 28);
  const tree = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.5, 7), treeMat);
  tree.position.set(Math.cos(a) * r, 1.75, Math.sin(a) * r);
  scene.add(tree);
}

// ---------- Mây ----------
function makePlayer() {
  const g = new THREE.Group();
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 12), new THREE.MeshLambertMaterial({ color: 0x3a6ea5 }));
  cloak.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), new THREE.MeshLambertMaterial({ color: 0xf2c9a0 }));
  head.position.y = 1.25;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.38, 20), new THREE.MeshLambertMaterial({ color: 0xd9b26a }));
  hat.position.y = 1.55;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
  lamp.position.set(0.62, 1.2, 0.1);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  string.position.set(0.62, 1.38, 0.1);
  const light = new THREE.PointLight(0xffb347, 6, 9, 1.2);
  light.position.copy(lamp.position);
  g.add(cloak, head, hat, lamp, string, light);
  g.userData = { lamp, light };
  return g;
}
const playerMesh = makePlayer();
scene.add(playerMesh);

// ---------- lanterns ----------
const lanternMeshes = new Map();
function makeLantern() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2), new THREE.MeshLambertMaterial({ color: 0x4a3426 }));
  pole.position.y = 1.6;
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x5a3a2a, emissive: 0xff9a2e, emissiveIntensity: 0 });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 8), lampMat);
  lamp.position.y = 3.6;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.4, 8), new THREE.MeshLambertMaterial({ color: 0x8a2b1f }));
  cap.position.y = 4.25;
  const light = new THREE.PointLight(0xffa040, 0, 18, 1.2);
  light.position.y = 3.6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.12, TUNING.safe_radius, 48),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
  g.add(pole, lamp, cap, light, ring);
  g.userData = { lampMat, light, ring };
  return g;
}

// ---------- motes / shades (pooled by id) ----------
const moteGeo = new THREE.SphereGeometry(0.16, 8, 6);
const moteMat = new THREE.MeshBasicMaterial({ color: 0xfff08a, fog: false });
const moteMeshes = new Map();
const shadeMeshes = new Map();
function makeShade() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x2a0f3d, emissive: 0x3a0a55, emissiveIntensity: 0.5, transparent: true, opacity: 0.92 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), mat);
  body.scale.set(1, 1.2, 1);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd8b0ff });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat);
  const e2 = e1.clone();
  e1.position.set(-0.25, 0.25, 0.7); e2.position.set(0.25, 0.25, 0.7);
  g.add(body, e1, e2);
  g.userData = { mat, eyeMat };
  return g;
}
function syncPool(pool, items, make) {
  const seen = new Set();
  for (const it of items) {
    seen.add(it.id);
    if (!pool.has(it.id)) { const m = make(); pool.set(it.id, m); scene.add(m); }
  }
  for (const [id, m] of pool) if (!seen.has(id)) { scene.remove(m); pool.delete(id); }
}

// pulse ring effect
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);
let pulseFx = 0;

// ---------- tiny synth sounds (creative extra, presentation only) ----------
let actx = null;
function beep(freq, dur = 0.15, type = 'sine', vol = 0.08) {
  try {
    actx ??= new AudioContext();
    const o = actx.createOscillator(), gn = actx.createGain();
    o.type = type; o.frequency.value = freq;
    gn.gain.setValueAtTime(vol, actx.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(gn).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
  } catch { /* audio is optional */ }
}
const SOUNDS = {
  mote_picked: () => beep(880 + Math.random() * 120, 0.12),
  deposit: () => beep(523, 0.2, 'triangle'),
  lantern_lit: () => { beep(523, 0.5, 'triangle'); setTimeout(() => beep(784, 0.6, 'triangle'), 120); },
  pulse: () => beep(330, 0.35, 'sawtooth', 0.04),
  player_hit: () => beep(110, 0.4, 'square', 0.06),
  shade_spawned: () => beep(90, 0.6, 'sine', 0.05),
};

// ---------- input ----------
const keys = new Set();
let camYaw = 0, dragX = null;
const pressedOnce = { jump: false, interact: false, pulse: false };
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (phase !== 'playing' && (e.code === 'Enter' || e.code === 'KeyR')) startGame();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('pointerdown', (e) => { dragX = e.clientX; });
addEventListener('pointerup', () => { dragX = null; });
addEventListener('pointermove', (e) => {
  if (dragX === null) return;
  camYaw -= (e.clientX - dragX) * 0.3; // drag right -> turn right
  dragX = e.clientX;
});
$('overlay').addEventListener('click', () => { if (phase !== 'playing') startGame(); });

function readInput(dt) {
  if (keys.has('ArrowLeft')) camYaw += 120 * dt;
  if (keys.has('ArrowRight')) camYaw -= 120 * dt;
  let x = 0, z = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
  if (keys.has('KeyA')) x += 1; // with yaw 0 the camera looks along +Z, so screen-left is +X
  if (keys.has('KeyD')) x -= 1;
  return {
    move: [x, z], cam_yaw_deg: camYaw,
    jump: keys.has('Space'), interact: keys.has('KeyE'), pulse: keys.has('KeyQ'),
  };
}

// ---------- game loop ----------
let game = null, phase = 'menu', acc = 0, last = performance.now();
function startGame() {
  const seedParam = new URLSearchParams(location.search).get('seed');
  game = new Game({ seed: seedParam !== null ? Number(seedParam) : (Math.random() * 2 ** 31) | 0 });
  for (const pool of [moteMeshes, shadeMeshes]) { for (const m of pool.values()) scene.remove(m); pool.clear(); }
  for (const m of lanternMeshes.values()) scene.remove(m);
  lanternMeshes.clear();
  for (const L of game.lanterns) {
    const m = makeLantern(); m.position.set(L.pos[0], 0, L.pos[2]);
    lanternMeshes.set(L.id, m); scene.add(m);
  }
  camYaw = 0; acc = 0; phase = 'playing';
  $('overlay').style.display = 'none';
}

function showCard(html) { $('card').innerHTML = html; $('overlay').style.display = 'flex'; }
const CONTROLS = `<p><kbd>W A S D</kbd> đi · <kbd>Space</kbd> nhảy · <kbd>E</kbd> nạp đèn · <kbd>Q</kbd> tỏa sáng</p>
  <p>Kéo chuột hoặc <kbd>←</kbd> <kbd>→</kbd> để xoay camera</p>`;
showCard(`<h1>Đảo Đèn Lồng</h1><p>Sương đen đã nuốt hết ánh sáng của Đảo Bến.</p>
  <p>Gom đom đóm, mang về thắp lại <b>${TUNING.lantern_count_night1} Đèn Lồng Lớn</b> trước bình minh. Tránh Bóng Mực.</p>
  ${CONTROLS}<p class="go">Nhấn Enter hoặc nhấp để bắt đầu</p>`);

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (phase === 'playing') {
    const inp = readInput(dt);
    acc += dt;
    while (acc >= 1 / HZ && game.state === 'playing') {
      acc -= 1 / HZ;
      for (const ev of game.step(inp)) {
        SOUNDS[ev.name]?.();
        if (ev.name === 'pulse') pulseFx = 1;
      }
    }
    if (game.state !== 'playing') {
      phase = 'over';
      const won = game.state === 'won';
      const why = { all_lit: 'Mọi đèn đã sáng!', no_flames: 'Mây đã hết lửa.', dawn: 'Bình minh tới mà đảo vẫn chưa sáng.' }[game.result.reason];
      showCard(`<h1>${won ? 'Đảo đã sáng!' : 'Chưa thành công'}</h1><p>${why}</p>
        <p>Điểm: <b>${game.score}</b></p>${CONTROLS}<p class="go">Nhấn R hoặc nhấp để chơi lại</p>`);
    }
  }
  if (game) draw(now / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function draw(t) {
  const p = game.player;
  // player
  playerMesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const yawR = (camYaw * Math.PI) / 180;
  playerMesh.rotation.y = yawR;
  const blink = game.tick < p.invulnUntil && Math.floor(t * 12) % 2 === 0;
  playerMesh.visible = !blink;
  playerMesh.userData.light.intensity = 0.6 + p.carried * 0.5;
  // camera behind the player (forward = (sin yaw, cos yaw))
  const fx = Math.sin(yawR), fz = Math.cos(yawR);
  camera.position.set(p.pos[0] - fx * 9, p.pos[1] + 5, p.pos[2] - fz * 9);
  camera.lookAt(p.pos[0] + fx * 2, p.pos[1] + 1.2, p.pos[2] + fz * 2);

  // lanterns: glow grows with deposited light; island brightens with each lit lantern
  let lit = 0;
  for (const L of game.lanterns) {
    const u = lanternMeshes.get(L.id).userData;
    const f = L.lit ? 1 : L.deposited / TUNING.lantern_cost;
    u.lampMat.emissiveIntensity = L.lit ? 2.2 + Math.sin(t * 3) * 0.2 : 0.15 + f * 0.8;
    u.light.intensity = L.lit ? 30 : f * 4;
    u.ring.material.opacity = L.lit ? 0.35 : 0;
    if (L.lit) lit++;
  }
  const k = lit / game.lanterns.length;
  hemi.intensity = 0.9 + k * 1.2;
  scene.fog.density = 0.032 - k * 0.022;
  scene.background.copy(NIGHT).lerp(DAWNISH, k);

  // motes
  syncPool(moteMeshes, game.motes, () => new THREE.Mesh(moteGeo, moteMat));
  for (const m of game.motes) {
    const mesh = moteMeshes.get(m.id);
    const ph = m.id.length + Number(m.id.slice(1));
    mesh.position.set(m.pos[0] + Math.sin(t * 1.3 + ph) * 0.15, 0.8 + Math.sin(t * 2 + ph) * 0.25, m.pos[2] + Math.cos(t * 1.1 + ph) * 0.15);
  }
  // shades
  syncPool(shadeMeshes, game.shades, makeShade);
  for (const s of game.shades) {
    const g = shadeMeshes.get(s.id);
    const stunned = game.tick < s.stunUntil;
    g.position.set(s.pos[0], 1 + Math.sin(t * 2 + s.pos[0]) * 0.15, s.pos[2]);
    g.lookAt(p.pos[0], 1, p.pos[2]);
    g.userData.mat.opacity = stunned ? 0.45 : 0.92;
    g.userData.eyeMat.color.set(stunned ? 0xffe9a8 : 0xd8b0ff);
  }
  // pulse ring
  if (pulseFx > 0) {
    pulseFx = Math.max(0, pulseFx - 0.04);
    const r = TUNING.pulse_radius * (1 - pulseFx);
    pulseRing.scale.set(r, r, 1);
    pulseRing.position.set(p.pos[0], 0.1, p.pos[2]);
    pulseRing.material.opacity = pulseFx;
  }
  drawHud(lit);
}

function drawHud(lit) {
  const p = game.player;
  const pips = (n, max) => Array.from({ length: max }, (_, i) => `<span class="pip ${i < n ? 'on' : ''}"></span>`).join('');
  const tl = game.timeLeftTicks() / HZ;
  const mm = Math.floor(tl / 60), ss = String(Math.floor(tl % 60)).padStart(2, '0');
  const cd = Math.max(0, (p.pulseReadyAt - game.tick) / HZ);
  const pulse = p.carried < TUNING.pulse_cost ? 'cần đom đóm' : cd > 0 ? `${cd.toFixed(1)}s` : 'sẵn sàng';
  $('hud').innerHTML = `Lửa: ${pips(p.flames, TUNING.flames)}<br>
    Đom đóm: <b>${p.carried}/${TUNING.carry_capacity}</b><br>
    Đèn đã thắp: <b>${lit}/${game.lanterns.length}</b><br>
    Điểm: <b>${game.score}</b><br>
    Bình minh sau: <b>${mm}:${ss}</b><br>
    Tỏa sáng (Q): <b>${pulse}</b>`;
  // context hint near an unlit lantern
  const near = game.lanterns.find((L) => !L.lit && Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]) <= TUNING.interact_radius);
  const hint = $('hint');
  if (near) {
    hint.style.display = 'block';
    hint.textContent = p.carried > 0 ? `E: nạp ánh sáng vào đèn ${near.id} (${near.deposited}/${TUNING.lantern_cost})`
      : `Đèn ${near.id} cần ${TUNING.lantern_cost - near.deposited} đom đóm nữa`;
  } else hint.style.display = 'none';
}

// ?autostart=1 skips the menu (used for screenshots); ?seed=N makes a web run reproducible
if (new URLSearchParams(location.search).has('autostart')) startGame();
requestAnimationFrame(frame);
