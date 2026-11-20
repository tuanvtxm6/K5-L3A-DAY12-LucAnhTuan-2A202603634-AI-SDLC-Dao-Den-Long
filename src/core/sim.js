// Pure game logic (Contract v1.2). No DOM, no Three.js, no wall clock, no Math.random.
// Used by both headless (Node) and web/main.js. Fixed step = 1/60 s.
// step() follows the mandatory Ticket-02 order (+ Ticket-03 fuel in step 2):
//  1 input (pause first) · 2 timers + lantern fuel (decay + drain), then lanterns at fuel <= 0 go out
//  3 move player + fall · 4 pickup motes/charms · 5 interact (light / relight / refuel)
//  6 safe zones · 7 pulse · 8 move shades/drifters · 9 contacts (drifters, then shades by id)
//  10 spawns · 11 win/lose (dawn rule).  (12 snapshot is done by the caller.)
// Lantern fuel is an integer count of 1/60 fuel units (decay 1/s = 1 unit per tick).
// See docs/adr/0001-lantern-fuel-and-dawn-win.md.
import { TUNING, WORLD } from './tuning.js';
import { MAPS } from './maps.js';
import { makeRng } from './rng.js';

const HZ = 60;
const r3 = (v) => Math.round(v * 1000) / 1000 + 0; // + 0 turns -0 into 0
const dXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const secToTicks = (s) => Math.round(s * HZ);
const idNum = (id) => { const m = /(\d+)$/.exec(id); return m ? Number(m[1]) : Infinity; };
const byId = (a, b) => idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const away = (from, to) => { // unit XZ vector from -> to; coincident -> +X
  const dx = to[0] - from[0], dz = to[2] - from[2], d = Math.hypot(dx, dz);
  return d > 1e-9 ? [dx / d, dz / d] : [1, 0];
};

export const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];
export const DEFAULT_INPUT = Object.freeze({
  move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false,
});

export class Game {
  constructor({ seed = 0, night = 1, scenario = null, tuning = TUNING, world = WORLD } = {}) {
    this.map = MAPS[night];
    if (!this.map) throw new Error(`unknown night ${night}`);
    this.night = night;
    this.t = tuning;
    this.w = world;
    this.rng = makeRng(seed);
    this.tick = 0;      // contract tick (counts paused ticks too)
    this.simTick = 0;   // gameplay steps actually simulated
    this.state = 'playing';
    this.paused = false;
    this.result = null;
    this.score = 0;
    this.events = [];
    this.startTicks = secToTicks(tuning[this.map.duration_key]);
    this.shadeSpeed = this.map.shadeSpeed ?? tuning.shade_speed;

    this.player = {
      pos: this.map.start.slice(), vel: [0, 0, 0], grounded: true, facing: [0, 1],
      carried: 0, flames: tuning.flames, invuln: 0, dashCd: 0, dashTicks: 0, dashDir: [0, 1],
      pulseCd: 0, charm: 0, launch: null, fallWait: 0,
    };
    this.prev = Object.fromEntries(BUTTONS.map((b) => [b, false]));
    this.FU = world.fuel_units_per_s;                    // fuel units per 1.0 fuel
    this.FUEL_MAX = tuning.fuel_max * this.FU;
    this.LOW = tuning.low_fuel_threshold * this.FU;
    this.lanterns = this.map.lanterns.map((L) => ({ id: L.id, pos: L.pos.slice(), deposited: 0, lit: false, fu: 0, everLit: false, relit: 0 }));
    this.successfulLights = 0;
    this.motes = [];
    this.nextMote = 1;
    this.shades = [];
    this.nextShade = 1;
    this.usedShadeIds = new Set();
    this.drifters = [];
    this.nextDrifter = 1;
    this.charms = this.map.charms.map((c) => ({ id: c.id, pos: c.pos.slice(), available: true, respawn: 0 }));
    this.randomMotes = true;
    this.randomShades = true;
    this.randomDrifters = true;
    this.windEnabled = this.map.wind;
    this.wind = { active: false, dir: null, ticks: 0, nextDir: null };
    this.justLit = [];

    let motesGiven = false;
    if (scenario) motesGiven = this.#applyScenario(scenario);
    const g = this.map.surface(this.player.pos[0], this.player.pos[2]);
    this.player.grounded = g !== null && Math.abs(this.player.pos[1] - g) < 1e-6;
    if (!motesGiven && this.randomMotes) {
      for (let i = 0; i < this.w.motes_initial; i++) this.#spawnRandomMote();
    }
  }

  // ---------- setup (no events, no score) ----------
  #applyScenario(sc) {
    const p = this.player, w = this.w;
    if (sc.player) {
      const sp = sc.player;
      if (sp.pos) p.pos = sp.pos.slice(0, 3);
      if (sp.carried !== undefined) p.carried = sp.carried;
      if (sp.flames !== undefined) p.flames = sp.flames;
      if (sp.invuln_ticks !== undefined) p.invuln = sp.invuln_ticks;
      if (sp.dash_cd_ticks !== undefined) p.dashCd = sp.dash_cd_ticks;
      if (sp.pulse_cd_ticks !== undefined) p.pulseCd = sp.pulse_cd_ticks;
      if (sp.charm_ticks !== undefined) p.charm = sp.charm_ticks;
      if (sp.successful_lights !== undefined) this.successfulLights = sp.successful_lights;
    }
    if (sc.random_motes !== undefined) this.randomMotes = sc.random_motes;
    if (sc.random_shades !== undefined) this.randomShades = sc.random_shades;
    if (sc.random_drifters !== undefined) this.randomDrifters = sc.random_drifters;
    if (sc.wind_enabled !== undefined) this.windEnabled = sc.wind_enabled;
    for (const L of sc.lanterns || []) {
      const target = this.lanterns.find((x) => x.id === L.id);
      if (!target) continue; // unknown ids ignored (A16)
      if (L.pos) target.pos = L.pos.slice(0, 3);
      if (L.ever_lit !== undefined) target.everLit = L.ever_lit;
      if (L.relit_count !== undefined) target.relit = L.relit_count;
      if (L.deposited !== undefined) target.deposited = L.deposited;
      if (L.lit !== undefined) {
        target.lit = L.lit;
        if (L.lit) {
          if (L.ever_lit === undefined) target.everLit = true; // a lit lantern has been lit (B5)
          target.fu = Math.min(this.FUEL_MAX, Math.round((L.fuel ?? this.t.fuel_max) * this.FU));
          if (L.deposited === undefined) target.deposited = this.#lightCost(target);
        } else target.fu = 0;
      }
      if (!target.lit && target.deposited >= this.#lightCost(target)) {
        target.lit = true; target.everLit = true; target.fu = this.FUEL_MAX;
      }
    }
    if (sc.time_left_s !== undefined) this.startTicks = secToTicks(sc.time_left_s);
    let motesGiven = false;
    if (sc.motes) {
      motesGiven = true;
      for (const m of sc.motes) {
        const o = Array.isArray(m) ? { pos: m } : m;
        const kind = o.kind === 'dropped' ? 'dropped' : 'random';
        const ttl = kind === 'dropped' ? (o.ttl_s !== undefined ? secToTicks(o.ttl_s) : w.drop_ttl_ticks) : null;
        this.motes.push({ id: `M${this.nextMote++}`, pos: o.pos.slice(0, 3), kind, ttl, point: -1 });
      }
    }
    if (sc.shades) {
      for (const s of sc.shades) if (s.id) this.usedShadeIds.add(s.id);
      for (const s of sc.shades) {
        const sh = this.#newShade(s.id || this.#freshShadeId(), s.pos.slice(0, 3), s.state, s.state_ticks_left);
        if (s.target_lantern_id) sh.target = s.target_lantern_id;
        this.shades.push(sh);
      }
      this.shades.sort(byId);
    }
    if (sc.drifters) {
      const used = new Set(sc.drifters.filter((d) => d.id).map((d) => d.id));
      for (const d of sc.drifters) {
        let id = d.id;
        while (!id) { const c = `D${this.nextDrifter++}`; if (!used.has(c)) id = c; }
        const state = d.state || 'idle';
        const ticks = d.state_ticks_left ?? (state === 'flee' ? w.drifter_flee_ticks : 0);
        this.drifters.push({ id, pos: d.pos.slice(0, 3), state, stolen: d.stolen || 0, didSteal: (d.stolen || 0) > 0, ticks, wp: null });
      }
      this.drifters.sort(byId);
    }
    if (sc.charms) {
      const defaults = Object.fromEntries(this.map.charms.map((c) => [c.id, c.pos]));
      this.charms = sc.charms.map((c) => ({
        id: c.id, pos: (c.pos || defaults[c.id]).slice(0, 3),
        available: c.available ?? true, respawn: c.respawn_ticks ?? (c.available === false ? w.charm_respawn_ticks : 0),
      }));
    }
    return motesGiven;
  }

  #freshShadeId() {
    let id;
    do { id = `S${this.nextShade++}`; } while (this.usedShadeIds.has(id));
    this.usedShadeIds.add(id);
    return id;
  }

  #newShade(id, pos, state, ticksLeft) {
    const w = this.w;
    const s = { id, pos, state: null, ticks: 0, push: 0, pushDir: null, dir: null, left: 0, evict: false, wp: null, target: null, drainTicks: 0 };
    if (!state) state = dXZ(pos, this.player.pos) <= w.shade_detect_m ? 'chase' : 'wander';
    s.state = state;
    if (state === 'spawning') s.ticks = ticksLeft ?? w.shade_spawning_ticks;
    if (state === 'stunned') s.ticks = ticksLeft ?? secToTicks(this.t.pulse_stun_s);
    if (state === 'recoil') { s.ticks = ticksLeft ?? w.recoil_ticks; s.left = (w.recoil_m * s.ticks) / w.recoil_ticks; }
    return s;
  }

  #spawnRandomMote() {
    const used = new Set(this.motes.filter((m) => m.point >= 0).map((m) => m.point));
    const free = this.map.moteSpawns.map((_, i) => i).filter((i) => !used.has(i));
    if (!free.length) return false;
    const i = free[Math.floor(this.rng() * free.length)];
    this.motes.push({ id: `M${this.nextMote++}`, pos: this.map.moteSpawns[i].slice(), kind: 'random', ttl: null, point: i });
    return true;
  }

  #dropMotes(n, center) {
    if (n <= 0) return;
    const w = this.w;
    const a0 = this.rng() * 2 * Math.PI;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * 2 * Math.PI) / n;
      const r = w.drop_ring_min_m + this.rng() * (w.drop_ring_max_m - w.drop_ring_min_m);
      const x = r3(center[0] + r * Math.cos(a)), z = r3(center[2] + r * Math.sin(a));
      const g = this.map.surface(x, z);
      this.motes.push({ id: `M${this.nextMote++}`, pos: [x, g ?? Math.max(0, center[1]), z], kind: 'dropped', ttl: w.drop_ttl_ticks, point: -1 });
    }
  }

  #emit(name, data) { this.events.push({ type: 'event', tick: this.tick, name, data }); }

  #lightCost(L) { return L.everLit ? this.t.relight_cost : this.t.lantern_cost; }
  capacity() {
    return Math.min(this.t.capacity_max, this.t.carry_capacity + this.w.capacity_per_light * this.successfulLights);
  }
  fuelOf(L) { return L.lit ? Math.round((L.fu / this.FU) * 10) / 10 : 0; } // 1 decimal for output
  #hasZone(L) { return L.lit && L.fu >= this.LOW; }   // fuel exactly 30 still protects
  #weak(L) { return L.lit && L.fu < this.LOW; }

  // shades are blocked by safe zones (lit lanterns with fuel >= 30) and the bell tower
  #insideObstacle(pos) {
    const R = this.t.safe_radius;
    if (this.lanterns.some((L) => this.#hasZone(L) && dXZ(L.pos, pos) < R - 1e-9)) return true;
    return this.map.tower && Math.hypot(pos[0], pos[2]) < this.w.tower_radius_m - 1e-9;
  }
  #projectOut(pos) {
    const R = this.t.safe_radius;
    for (const L of this.lanterns) {
      if (!this.#hasZone(L) || dXZ(L.pos, pos) >= R) continue;
      const [ux, uz] = away(L.pos, pos);
      pos[0] = L.pos[0] + ux * R; pos[2] = L.pos[2] + uz * R;
    }
    if (this.map.tower && Math.hypot(pos[0], pos[2]) < this.w.tower_radius_m) {
      const [ux, uz] = away([0, 0, 0], pos);
      pos[0] = ux * this.w.tower_radius_m; pos[2] = uz * this.w.tower_radius_m;
    }
  }

  timeLeftTicks() { return Math.max(0, this.startTicks - this.simTick); }

  // ---------- one tick ----------
  step(input = DEFAULT_INPUT) {
    this.events = [];
    if (this.state === 'won' || this.state === 'lost') return this.events;
    this.tick += 1;

    // 1. input; pause first
    const pressed = {};
    for (const b of BUTTONS) { pressed[b] = !!input[b] && !this.prev[b]; this.prev[b] = !!input[b]; }
    if (pressed.pause) {
      this.paused = !this.paused;
      this.state = this.paused ? 'paused' : 'playing';
      this.#emit(this.paused ? 'paused' : 'resumed', {});
    }
    if (this.paused) return this.events;
    this.simTick += 1;

    this.#timers();                    // 2
    this.#movePlayer(input, pressed);  // 3
    this.#pickup();                    // 4
    this.#interact(pressed.interact);  // 5
    this.#safeZones();                 // 6
    this.#pulse(pressed.pulse);        // 7
    this.#moveShades();                // 8
    this.#moveDrifters();
    this.#contacts();                  // 9
    this.#spawns();                    // 10
    this.#checkEnd();                  // 11
    return this.events;
  }

  // 2. counters
  #timers() {
    const p = this.player, w = this.w;
    for (const k of ['dashCd', 'pulseCd', 'invuln', 'charm', 'dashTicks']) if (p[k] > 0) p[k] -= 1;
    if (p.fallWait > 0 && --p.fallWait === 0) { // respawn
      p.pos = this.map.start.slice(); p.vel = [0, 0, 0]; p.grounded = true; p.launch = null;
      p.dashTicks = 0; p.invuln = secToTicks(this.t.invuln_s);
    }
    for (const s of this.shades) {
      if (s.ticks > 0 && --s.ticks === 0) {
        // Ticket-03: stun ends -> wander. Spawning/recoil end -> by distance (A21/A22).
        s.state = s.state === 'stunned' ? 'wander' : dXZ(s.pos, p.pos) <= w.shade_detect_m ? 'chase' : 'wander';
        s.evict = false; s.push = 0; s.left = 0; s.dir = null;
      }
    }
    // lantern fuel: decay + drain (integer units), then lanterns at fuel <= 0 go out
    const t = this.t;
    for (const L of this.lanterns) {
      if (!L.lit) continue;
      const drainers = this.shades.filter((s) => s.state === 'drain' && s.target === L.id);
      L.fu -= Math.round(t.fuel_decay_per_s) + Math.round(t.drain_per_s) * drainers.length;
      for (const s of drainers) {
        if (++s.drainTicks % HZ === 0) {
          this.#emit('fuel_drain', { lantern_id: L.id, shade_id: s.id, fuel: Math.max(0, this.fuelOf(L)) });
        }
      }
    }
    for (const L of this.lanterns) {
      if (!L.lit || L.fu > 0) continue;
      L.lit = false; L.fu = 0; L.deposited = 0;
      this.#emit('lantern_out', { lantern_id: L.id });
      for (const s of this.shades) if (s.state === 'drain' && s.target === L.id) { s.state = 'wander'; s.target = null; }
    }
    for (const d of this.drifters) if (d.state === 'flee' && d.ticks > 0 && --d.ticks === 0) d.state = 'removed';
    this.motes = this.motes.filter((m) => m.ttl === null || --m.ttl > 0);
    for (const c of this.charms) if (!c.available && c.respawn > 0 && --c.respawn === 0) c.available = true;
    const wd = this.wind;
    if (wd.active && --wd.ticks <= 0) { wd.active = false; wd.dir = null; }
    if (this.windEnabled) {
      const ph = this.simTick % w.wind_every_ticks;
      if (ph === w.wind_every_ticks - w.wind_warn_ticks) wd.nextDir = r3(this.rng() * 360);
      if (ph === 0) {
        wd.active = true; wd.ticks = w.wind_duration_ticks;
        wd.dir = wd.nextDir ?? r3(this.rng() * 360); wd.nextDir = null;
      }
    }
  }

  // 3. player movement, jump pads, wind, fall
  #canEnter(x, z, y) {
    const g = this.map.surface(x, z);
    return g === null || g <= y + this.w.step_up_m;
  }

  #movePlayer(input, pressed) {
    const p = this.player, t = this.t, w = this.w, dt = 1 / HZ;
    if (p.fallWait > 0) return;
    let [mx, mz] = input.move || [0, 0];
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
    const dx = mx * Math.cos(th) + mz * Math.sin(th);
    const dz = -mx * Math.sin(th) + mz * Math.cos(th);
    const dl = Math.hypot(dx, dz);
    if (dl > 1e-9) p.facing = [dx / dl, dz / dl];

    if (pressed.dash && p.dashTicks === 0 && (p.dashCd === 0 || p.charm > 0)) {
      p.dashTicks = secToTicks(t.dash_duration_s);
      p.dashDir = p.facing.slice();
      p.dashCd = p.charm > 0 ? 0 : secToTicks(t.dash_cooldown_s);
      this.#emit('dash', {});
    }
    if (pressed.jump && p.grounded && !p.launch && p.dashTicks === 0) { p.vel[1] = w.jump_speed; p.grounded = false; }

    const run = p.charm > 0 ? w.charm_speed : t.player_speed;
    if (p.dashTicks > 0) {
      p.vel[0] = p.dashDir[0] * t.dash_speed; p.vel[2] = p.dashDir[1] * t.dash_speed; p.vel[1] = 0;
    } else if (p.launch) {
      p.vel[0] = p.launch[0]; p.vel[2] = p.launch[1];
    } else {
      let vx = p.vel[0], vz = p.vel[2];
      const sp = Math.hypot(vx, vz);
      if (sp > run) { vx *= run / sp; vz *= run / sp; } // leaving a dash
      const tx = dx * run, tz = dz * run, maxDv = run / (w.accel_time_s * HZ);
      const ex = tx - vx, ez = tz - vz, el = Math.hypot(ex, ez);
      if (el <= maxDv) { vx = tx; vz = tz; } else { vx += (ex / el) * maxDv; vz += (ez / el) * maxDv; }
      p.vel[0] = vx; p.vel[2] = vz;
    }
    if (!p.grounded && p.dashTicks === 0) p.vel[1] -= w.gravity * dt;

    let wx = 0, wz = 0;
    if (this.wind.active) {
      const a = (this.wind.dir * Math.PI) / 180;
      wx = Math.cos(a) * w.wind_speed; wz = Math.sin(a) * w.wind_speed;
    }
    const nx = p.pos[0] + (p.vel[0] + wx) * dt, nz = p.pos[2] + (p.vel[2] + wz) * dt;
    const y = p.pos[1];
    if (this.#canEnter(nx, nz, y)) { p.pos[0] = nx; p.pos[2] = nz; }
    else if (this.#canEnter(nx, p.pos[2], y)) { p.pos[0] = nx; p.vel[2] = 0; }
    else if (this.#canEnter(p.pos[0], nz, y)) { p.pos[2] = nz; p.vel[0] = 0; }
    else { p.vel[0] = 0; p.vel[2] = 0; }
    p.pos[1] += p.vel[1] * dt;

    const g = this.map.surface(p.pos[0], p.pos[2]);
    if (p.grounded) {
      if (g !== null && Math.abs(g - p.pos[1]) <= w.step_up_m) { p.pos[1] = g; p.vel[1] = 0; }
      else p.grounded = false;
    } else if (g !== null && p.vel[1] <= 0 && p.pos[1] <= g) {
      p.pos[1] = g; p.vel[1] = 0; p.grounded = true; p.launch = null;
    }

    if (p.grounded && !p.launch) {
      for (const pad of this.map.pads) {
        if (dXZ(p.pos, pad.pos) > 1 || Math.abs(p.pos[1] - pad.pos[1]) > 1e-6) continue;
        let dir = pad.dir;
        if (!dir) { const [ux, uz] = away(pad.pos, [pad.toward[0], 0, pad.toward[1]]); dir = [ux, uz]; }
        p.launch = [dir[0] * pad.speed, dir[1] * pad.speed];
        p.vel = [p.launch[0], pad.vy, p.launch[1]];
        p.grounded = false;
        break;
      }
    }

    if (t.fall_enabled && p.pos[1] < w.fall_y) {
      const lost = p.carried;
      p.carried = 0; p.flames -= 1;
      p.vel = [0, 0, 0]; p.launch = null; p.dashTicks = 0;
      p.fallWait = w.fall_wait_ticks;
      this.#emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    }
  }

  // 4. motes and charms
  #pickup() {
    const p = this.player, t = this.t, w = this.w;
    if (p.fallWait > 0) return;
    const cap = this.capacity();
    for (let i = 0; i < this.motes.length && p.carried < cap; ) {
      const m = this.motes[i];
      if (dXZ(p.pos, m.pos) <= t.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= w.pickup_dy_m) {
        this.motes.splice(i, 1);
        p.carried += 1;
        this.#emit('mote_picked', { carried: p.carried });
      } else i++;
    }
    for (const c of this.charms) {
      if (!c.available || dXZ(p.pos, c.pos) > t.pickup_radius || Math.abs(p.pos[1] - c.pos[1]) > w.pickup_dy_m) continue;
      c.available = false; c.respawn = w.charm_respawn_ticks;
      p.charm = w.charm_ticks;
      this.#emit('charm_picked', { charm_id: c.id, charm_ticks: w.charm_ticks });
    }
  }

  // 5. interact: nearest lantern that can take light (unlit, or lit and not full); tie -> smaller id
  #interact(press) {
    const p = this.player, t = this.t;
    this.justLit = [];
    if (!press || p.fallWait > 0 || p.carried <= 0) return;
    let best = null, bestD = Infinity;
    for (const L of [...this.lanterns].sort(byId)) {
      if (L.lit && L.fu >= this.FUEL_MAX) continue; // full lantern is not selectable
      const d = dXZ(p.pos, L.pos);
      if (d <= t.interact_radius && d < bestD) { best = L; bestD = d; }
    }
    if (!best) return;
    if (best.lit) { // refuel
      const per = t.fuel_per_mote * this.FU;
      const used = Math.min(p.carried, Math.ceil((this.FUEL_MAX - best.fu) / per));
      if (used <= 0) return;
      best.fu = Math.min(this.FUEL_MAX, best.fu + used * per);
      p.carried -= used;
      this.score += t.score.per_mote * used;
      this.#emit('refuel', { lantern_id: best.id, amount: used, fuel: this.fuelOf(best) });
      if (best.fu >= this.LOW) this.justLit.push(best); // zone (re)activates -> evict (B6)
      return;
    }
    const cost = this.#lightCost(best);
    const amount = Math.min(p.carried, cost - best.deposited);
    if (amount <= 0) return;
    p.carried -= amount;
    best.deposited += amount;
    this.score += t.score.per_mote * amount;
    this.#emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
    if (best.deposited >= cost) {
      const relight = best.everLit;
      best.lit = true; best.everLit = true; best.fu = this.FUEL_MAX;
      if (relight) best.relit += 1;
      this.successfulLights += 1;
      this.score += relight ? t.score.per_relight : t.score.per_lantern;
      this.#emit('lantern_lit', { lantern_id: best.id, relight });
      this.justLit.push(best);
    }
  }

  // 6. a lantern lit (or refuelled to >= 30) this tick evicts shades inside its zone over <= 30 ticks
  #safeZones() {
    const R = this.t.safe_radius;
    for (const L of this.justLit) {
      for (const s of this.shades) {
        const d = dXZ(L.pos, s.pos);
        if (d >= R) continue;
        const [ux, uz] = away(L.pos, s.pos);
        Object.assign(s, { state: 'recoil', evict: true, ticks: this.w.evict_ticks, dir: [ux, uz], left: R - d, push: 0 });
      }
    }
  }

  // 7. pulse
  #pulse(press) {
    const p = this.player, t = this.t, w = this.w;
    if (!press || p.fallWait > 0 || p.pulseCd > 0 || p.carried < t.pulse_cost) return;
    p.carried -= t.pulse_cost;
    p.pulseCd = secToTicks(t.pulse_cooldown_s);
    const c = [p.pos[0], p.pos[1] + w.pulse_center_dy_m, p.pos[2]];
    const in3d = (pos) => Math.hypot(pos[0] - c[0], pos[1] - c[1], pos[2] - c[2]) <= t.pulse_radius;
    const stunned = [];
    for (const s of [...this.shades].sort(byId)) {
      if (!in3d(s.pos)) continue;
      this.score += s.state === 'drain' ? t.score.per_stun_drain : t.score.per_stun; // 15 total if it was draining
      const [ux, uz] = away(c, s.pos);
      Object.assign(s, { state: 'stunned', ticks: secToTicks(t.pulse_stun_s), push: t.pulse_push_m, pushDir: [ux, uz], evict: false, left: 0, dir: null, drainTicks: 0 });
      stunned.push(s.id);
    }
    this.#emit('pulse', { stunned_ids: stunned });
    for (const d of this.drifters) {
      if (d.state === 'removed' || !in3d(d.pos)) continue;
      if (d.state === 'chase') { d.state = 'flee'; d.ticks = w.drifter_flee_ticks; }
      else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        const g = this.map.surface(d.pos[0], d.pos[2]) ?? 0;
        for (let i = 0; i < amount; i++) {
          this.motes.push({ id: `M${this.nextMote++}`, pos: [r3(d.pos[0]), g, r3(d.pos[2])], kind: 'dropped', ttl: w.drop_ttl_ticks, point: -1 });
        }
        d.stolen = 0;
        d.ticks = w.drifter_drop_remove_ticks;
        this.#emit('drifter_drop', { drifter_id: d.id, amount });
      }
    }
  }

  #randomWaypoint() {
    const pts = this.map.moteSpawns;
    return pts[Math.floor(this.rng() * pts.length)];
  }

  // 8. shades
  #moveShades() {
    const p = this.player, w = this.w, dt = 1 / HZ;
    const stunTicks = secToTicks(this.t.pulse_stun_s);
    const step = (s, ux, uz, len, blockStops) => {
      const nx = s.pos[0] + ux * len, nz = s.pos[2] + uz * len;
      if (blockStops && this.#insideObstacle([nx, 0, nz])) return false;
      s.pos[0] = nx; s.pos[2] = nz;
      if (!blockStops) this.#projectOut(s.pos);
      return true;
    };
    for (const s of this.shades) {
      const dist = dXZ(s.pos, p.pos);
      const visible = p.fallWait === 0;
      if (s.state === 'wander' && visible && dist <= w.shade_detect_m) s.state = 'chase';
      else if (s.state === 'chase' && (!visible || dist > w.shade_lose_m)) s.state = 'wander';
      else if (s.state === 'drain') {
        const L = this.lanterns.find((x) => x.id === s.target);
        if (visible && dist <= w.drain_break_m) { s.state = 'chase'; s.drainTicks = 0; }
        else if (!L || !this.#weak(L) || dXZ(s.pos, L.pos) > w.drain_range_m) { s.state = 'wander'; s.drainTicks = 0; }
      }

      if (s.state === 'stunned') {
        const k = s.ticks - (stunTicks - w.stun_push_ticks);
        if (k >= 1 && s.push > 0) {
          const len = s.push / k;
          if (step(s, s.pushDir[0], s.pushDir[1], len, true)) s.push -= len; else s.push = 0;
        }
      } else if (s.state === 'recoil') {
        if (!s.dir) s.dir = away(p.pos, s.pos);
        if (s.ticks >= 1 && s.left > 0) {
          const len = s.left / s.ticks;
          if (s.evict) { s.pos[0] += s.dir[0] * len; s.pos[2] += s.dir[1] * len; s.left -= len; }
          else if (step(s, s.dir[0], s.dir[1], len, true)) s.left -= len; else s.left = 0;
        }
      } else if (s.state === 'chase') {
        const len = Math.min(this.shadeSpeed * dt, dist);
        if (len > 0) { const [ux, uz] = away(s.pos, p.pos); step(s, ux, uz, len, false); }
      } else if (s.state === 'wander') {
        const L = this.#wanderTarget(s);
        if (L) {
          s.target = L.id;
          const d = dXZ(s.pos, L.pos);
          if (d > w.drain_range_m) {
            const [ux, uz] = away(s.pos, L.pos);
            step(s, ux, uz, Math.min(w.shade_wander_speed * dt, d), false);
          }
          if (this.#weak(L) && dXZ(s.pos, L.pos) <= w.drain_range_m) { s.state = 'drain'; s.drainTicks = 0; }
        } else {
          s.target = null;
          if (!s.wp || dXZ(s.pos, s.wp) < 0.5) s.wp = this.#randomWaypoint();
          const len = Math.min(w.shade_wander_speed * dt, dXZ(s.pos, s.wp));
          const [ux, uz] = away(s.pos, s.wp);
          step(s, ux, uz, len, false);
        }
      }
    }
  }

  // wander goal: nearest weak lit lantern (fuel < 30; a scenario target that is weak wins), else nearest unlit
  #wanderTarget(s) {
    const nearest = (pred) => {
      let best = null, bestD = Infinity;
      for (const L of [...this.lanterns].sort(byId)) {
        if (!pred(L)) continue;
        const d = dXZ(s.pos, L.pos);
        if (d < bestD) { best = L; bestD = d; }
      }
      return best;
    };
    const given = this.lanterns.find((x) => x.id === s.target);
    if (given && this.#weak(given)) return given;
    return nearest((L) => this.#weak(L)) || nearest((L) => !L.lit);
  }

  #moveDrifters() {
    const p = this.player, w = this.w, dt = 1 / HZ;
    for (const d of this.drifters) {
      if (d.state === 'removed') continue;
      const dist = dXZ(d.pos, p.pos);
      const lure = p.fallWait === 0 && p.carried >= w.drifter_chase_carried && dist <= w.drifter_chase_m;
      if (d.state === 'idle' && lure && !d.didSteal) d.state = 'chase';
      else if (d.state === 'chase' && !lure) d.state = 'idle';
      let ux, uz, len;
      if (d.state === 'chase') { [ux, uz] = away(d.pos, p.pos); len = Math.min(w.drifter_speed * dt, dist); }
      else if (d.state === 'flee') { [ux, uz] = away(p.pos, d.pos); len = w.drifter_speed * dt; }
      else {
        if (!d.wp || dXZ(d.pos, d.wp) < 0.5) d.wp = this.#randomWaypoint();
        [ux, uz] = away(d.pos, d.wp); len = Math.min(w.drifter_idle_speed * dt, dXZ(d.pos, d.wp));
      }
      d.pos[0] += ux * len; d.pos[2] += uz * len;
    }
  }

  // 9. contacts: drifters steal first, then the first shade (by id) hits
  #contacts() {
    const p = this.player, t = this.t, w = this.w;
    if (p.fallWait > 0) return;
    for (const d of this.drifters) {
      if ((d.state !== 'idle' && d.state !== 'chase') || d.didSteal || p.carried <= 0) continue;
      if (dXZ(d.pos, p.pos) > w.drifter_contact_m) continue;
      const amount = Math.min(w.drifter_steal_max, p.carried);
      p.carried -= amount;
      Object.assign(d, { stolen: amount, didSteal: true, state: 'flee', ticks: w.drifter_flee_ticks });
      this.#emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
    }
    if (p.invuln > 0) return;
    for (const s of [...this.shades].sort(byId)) {
      if (s.state !== 'chase' && s.state !== 'wander') continue;
      if (dXZ(s.pos, p.pos) > t.shade_hit_radius || Math.abs(p.pos[1] - s.pos[1]) > w.hit_dy_m) continue;
      p.flames -= 1;
      const dropped = Math.floor(p.carried * t.hit_drop_ratio);
      p.carried -= dropped;
      this.#dropMotes(dropped, p.pos);
      p.invuln = secToTicks(t.invuln_s);
      Object.assign(s, { state: 'recoil', ticks: w.recoil_ticks, left: w.recoil_m, dir: away(p.pos, s.pos), evict: false });
      this.#emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      break;
    }
  }

  // 10. scheduled spawns (new entities act from the next tick)
  #spawns() {
    const w = this.w, st = this.simTick;
    if (this.randomMotes && st % w.mote_every_ticks === 0 && this.motes.length < w.motes_cap) this.#spawnRandomMote();
    if (this.randomShades) {
      let n = 0;
      if (st === w.shade_first_spawn_tick) n = 2;
      else if (st > w.shade_first_spawn_tick && (st - w.shade_first_spawn_tick) % this.map.shadeEvery === 0) n = 1;
      const taken = [];
      for (let i = 0; i < n && this.shades.length < this.map.shadeMax; i++) {
        const ok = this.map.shadeSpawns.filter((pt, j) => !taken.includes(j)
          && dXZ(pt, this.player.pos) >= w.shade_spawn_min_dist_m && !this.#insideObstacle(pt));
        if (!ok.length) break;
        const pt = ok[Math.floor(this.rng() * ok.length)];
        taken.push(this.map.shadeSpawns.indexOf(pt));
        const id = this.#freshShadeId();
        this.shades.push(this.#newShade(id, [pt[0], w.shade_hover_y, pt[2]], 'spawning'));
        this.#emit('shade_spawned', { id });
      }
      this.shades.sort(byId);
    }
    if (this.map.drifters && this.randomDrifters && st % w.drifter_every_ticks === 0) {
      const active = this.drifters.filter((d) => d.state !== 'removed').length;
      if (active < w.drifter_max) {
        const pts = this.map.shadeSpawns;
        const pt = pts[Math.floor(this.rng() * pts.length)];
        this.drifters.push({ id: `D${this.nextDrifter++}`, pos: [pt[0], w.drifter_hover_y, pt[2]], state: 'idle', stolen: 0, didSteal: false, ticks: 0, wp: null });
      }
    }
  }

  litNeeded() { return Math.ceil(this.t.win_ratio * this.lanterns.length); }

  // 11. after every update of the tick: no flames -> lost (always first); at dawn (time up) -> won
  //     dawn_survived if lit lanterns >= ceil(0.6 x total), else lost dawn. No early win (Ticket-03).
  #checkEnd() {
    const p = this.player, t = this.t;
    let result = null, reason = null;
    if (p.flames <= 0) { result = 'lost'; reason = 'no_flames'; }
    else if (this.timeLeftTicks() <= 0) {
      const lit = this.lanterns.filter((L) => L.lit).length;
      [result, reason] = lit >= this.litNeeded() ? ['won', 'dawn_survived'] : ['lost', 'dawn'];
    }
    if (!result) return;
    if (result === 'won') {
      for (const L of this.lanterns) if (L.lit) this.score += t.score.per_lit_at_dawn + Math.floor(L.fu / this.FU);
      this.score += t.score.per_flame_left * p.flames;
    }
    this.state = result;
    this.result = { result, reason };
    this.#emit('game_over', { result, reason });
  }

  snapshot() {
    const p = this.player;
    const sec = (ticks) => r3(ticks / HZ);
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      night: this.night,
      state: this.state,
      time_left_s: sec(this.timeLeftTicks()),
      score: this.score,
      wind: { active: this.wind.active, dir_deg: this.wind.dir },
      player: {
        pos: p.pos.map(r3), vel: p.vel.map(r3), grounded: p.grounded, invuln: p.invuln > 0,
        flames: p.flames, carried: p.carried, capacity: this.capacity(),
        dash_cd_s: sec(p.dashCd), pulse_cd_s: sec(p.pulseCd), charm_s: sec(p.charm),
      },
      lanterns: this.lanterns.map((L) => ({
        id: L.id, pos: L.pos.map(r3), lit: L.lit, deposited: L.deposited,
        fuel: this.fuelOf(L), ever_lit: L.everLit, relit_count: L.relit,
      })),
      shades: this.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.state, target_lantern_id: s.target })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3), kind: m.kind, ttl_s: m.ttl === null ? null : sec(m.ttl) })),
      drifters: this.drifters.map((d) => ({ id: d.id, pos: d.pos.map(r3), state: d.state, stolen: d.stolen })),
      charms: this.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: sec(c.respawn) })),
    };
  }
}
