// Pure game logic. No DOM, no Three.js, no wall clock, no Math.random.
// Used by both headless.js (Node) and web/main.js (browser). Fixed step = 1/60 s.
import { TUNING, WORLD } from './tuning.js';
import { makeRng } from './rng.js';

const HZ = 60;
const r3 = (v) => Math.round(v * 1000) / 1000 + 0; // + 0 turns -0 into 0
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const secToTicks = (s) => Math.round(s * HZ);

export const DEFAULT_INPUT = Object.freeze({
  move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false,
});

export class Game {
  constructor({ seed = 0, scenario = null, tuning = TUNING, world = WORLD } = {}) {
    this.t = tuning;
    this.w = world;
    this.rng = makeRng(seed);
    this.tick = 0;
    this.state = 'playing';
    this.result = null;
    this.score = 0;
    this.events = []; // events of the last step; caller drains

    this.player = { pos: [0, 0, 0], vy: 0, carried: 0, flames: tuning.flames, invulnUntil: 0, pulseReadyAt: 0 };
    this.prevButtons = { jump: false, interact: false, pulse: false };

    this.lanterns = [];
    const n = tuning.lantern_count_night1;
    for (let k = 0; k < n; k++) {
      const a = (k * 2 * Math.PI) / n;
      const R = world.lantern_ring_radius;
      this.lanterns.push({ id: `L${k + 1}`, pos: [r3(R * Math.sin(a)), 0, r3(R * Math.cos(a))], deposited: 0, lit: false });
    }

    this.randomMotes = true;
    this.randomShades = true;
    this.motes = [];
    this.nextMoteNum = 1;
    this.shades = [];
    this.nextShadeNum = 1;
    this.startTicks = secToTicks(tuning.night1_duration_s);
    this.moteTimer = 0;
    this.nextShadeAt = secToTicks(world.shade_first_spawn_s);

    let motesGiven = false;
    if (scenario) motesGiven = this.#applyScenario(scenario);
    if (!motesGiven && this.randomMotes) {
      for (let i = 0; i < world.motes_initial; i++) this.#spawnMote();
    }
  }

  // ---- setup (no events, no score) ----
  #applyScenario(sc) {
    const p = this.player;
    if (sc.player) {
      if (sc.player.pos) p.pos = sc.player.pos.slice(0, 3).map(Number);
      if (sc.player.carried !== undefined) p.carried = sc.player.carried;
      if (sc.player.flames !== undefined) p.flames = sc.player.flames;
    }
    if (sc.random_motes !== undefined) this.randomMotes = sc.random_motes;
    if (sc.random_shades !== undefined) this.randomShades = sc.random_shades;
    if (sc.lanterns) {
      for (const L of sc.lanterns) {
        const target = this.lanterns.find((x) => x.id === L.id);
        if (!target) continue; // unknown ids are ignored (documented)
        if (L.pos) target.pos = L.pos.slice(0, 3).map(Number);
        if (L.deposited !== undefined) target.deposited = L.deposited;
        if (L.lit !== undefined) {
          target.lit = !!L.lit;
          if (target.lit && L.deposited === undefined) target.deposited = this.t.lantern_cost;
        }
        if (!target.lit && target.deposited >= this.t.lantern_cost) target.lit = true;
      }
    }
    if (sc.time_left_s !== undefined) this.startTicks = secToTicks(sc.time_left_s);
    let motesGiven = false;
    if (sc.motes) {
      motesGiven = true;
      this.motes = [];
      for (const m of sc.motes) {
        const pos = Array.isArray(m) ? m : m.pos;
        this.motes.push({ id: `M${this.nextMoteNum++}`, pos: pos.slice(0, 3).map(Number) });
      }
    }
    if (sc.shades) {
      this.shades = [];
      const used = new Set(sc.shades.filter((s) => s.id).map((s) => String(s.id)));
      for (const s of sc.shades) {
        const id = s.id ? String(s.id) : this.#freshShadeId(used);
        this.shades.push({ id, pos: s.pos.slice(0, 3).map(Number), stunUntil: 0 });
      }
      this.usedShadeIds = used;
    }
    return motesGiven;
  }

  #freshShadeId(used = this.usedShadeIds || new Set()) {
    let id;
    do { id = `S${this.nextShadeNum++}`; } while (used.has(id));
    used.add(id);
    this.usedShadeIds = used;
    return id;
  }

  #randomPointOnIsland(minFromPlayer) {
    const R = this.w.island_radius - 2;
    let x = 0, z = 0;
    for (let i = 0; i < 20; i++) {
      const r = Math.sqrt(this.rng()) * R;
      const a = this.rng() * 2 * Math.PI;
      x = r * Math.cos(a); z = r * Math.sin(a);
      if (Math.hypot(x - this.player.pos[0], z - this.player.pos[2]) >= minFromPlayer) break;
    }
    return [r3(x), 0, r3(z)];
  }

  #spawnMote() {
    this.motes.push({ id: `M${this.nextMoteNum++}`, pos: this.#randomPointOnIsland(3) });
  }

  #spawnShade() {
    let pos = null;
    for (let i = 0; i < 12; i++) {
      const a = this.rng() * 2 * Math.PI;
      const R = this.w.shade_spawn_radius;
      const cand = [r3(R * Math.cos(a)), this.w.shade_hover_y, r3(R * Math.sin(a))];
      if (!this.lanterns.some((L) => L.lit && distXZ(L.pos, cand) <= this.t.safe_radius)) { pos = cand; break; }
    }
    if (!pos) return;
    const id = this.#freshShadeId();
    this.shades.push({ id, pos, stunUntil: 0 });
    this.#emit('shade_spawned', { id });
  }

  // ---- helpers ----
  #emit(name, data) { this.events.push({ type: 'event', tick: this.tick, name, data }); }

  #clampIsland(pos) {
    const R = this.w.island_radius;
    const d = Math.hypot(pos[0], pos[2]);
    if (d > R) { pos[0] *= R / d; pos[2] *= R / d; }
  }

  // Shades may not be within safe_radius of a LIT lantern: push them to the boundary.
  #pushOutOfSafe(pos) {
    const sr = this.t.safe_radius;
    for (const L of this.lanterns) {
      if (!L.lit) continue;
      const dx = pos[0] - L.pos[0], dz = pos[2] - L.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < sr) {
        const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
        pos[0] = L.pos[0] + ux * sr; pos[2] = L.pos[2] + uz * sr;
      }
    }
  }

  #isStunned(s) { return this.tick < s.stunUntil; }

  timeLeftTicks() { return Math.max(0, this.startTicks - this.tick); }

  #finish(result, reason) {
    if (result === 'won') {
      this.score += this.t.score.per_second_left * Math.floor(this.timeLeftTicks() / HZ);
      this.score += this.t.score.per_flame_left * this.player.flames;
    }
    this.state = result;
    this.result = { result, reason };
    this.#emit('game_over', { result, reason });
  }

  // ---- one fixed step: reads the input of tick k, produces state k+1 ----
  step(input = DEFAULT_INPUT) {
    this.events = [];
    if (this.state !== 'playing') return this.events;
    this.tick += 1;
    const t = this.t, w = this.w, p = this.player, dt = 1 / HZ;

    const pressed = (k) => !!input[k] && !this.prevButtons[k];
    const jumpP = pressed('jump'), interactP = pressed('interact'), pulseP = pressed('pulse');
    this.prevButtons = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse };

    // 1. movement (camera-relative, normalized if longer than 1)
    let [mx, mz] = input.move || [0, 0];
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    p.pos[0] += wx * t.player_speed * dt;
    p.pos[2] += wz * t.player_speed * dt;
    this.#clampIsland(p.pos);

    // 2. jump (visual + vertical only; all gameplay distances are XZ)
    if (jumpP && p.pos[1] <= 0) p.vy = w.jump_speed;
    if (p.pos[1] > 0 || p.vy > 0) {
      p.vy -= w.gravity * dt;
      p.pos[1] += p.vy * dt;
      if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
    }

    // 3. pick up motes (automatic, up to capacity)
    for (let i = 0; i < this.motes.length && p.carried < t.carry_capacity; ) {
      if (distXZ(p.pos, this.motes[i].pos) <= t.pickup_radius) {
        this.motes.splice(i, 1);
        p.carried += 1;
        this.score += t.score.per_mote;
        this.#emit('mote_picked', { carried: p.carried });
      } else i++;
    }

    // 4. interact: deposit into nearest unlit lantern in range
    if (interactP && p.carried > 0) {
      let best = null, bestD = Infinity;
      for (const L of this.lanterns) {
        if (L.lit) continue;
        const d = distXZ(p.pos, L.pos);
        if (d <= t.interact_radius && d < bestD) { best = L; bestD = d; }
      }
      if (best) {
        const amount = Math.min(p.carried, t.lantern_cost - best.deposited);
        if (amount > 0) {
          p.carried -= amount;
          best.deposited += amount;
          this.#emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= t.lantern_cost) {
            best.lit = true;
            this.score += t.score.per_lantern;
            this.#emit('lantern_lit', { lantern_id: best.id });
            for (const s of this.shades) this.#pushOutOfSafe(s.pos);
            if (this.lanterns.every((L) => L.lit)) { this.#finish('won', 'all_lit'); return this.events; }
          }
        }
      }
    }

    // 5. pulse: costs carried light, stuns + pushes shades in radius
    if (pulseP && this.tick >= p.pulseReadyAt && p.carried >= t.pulse_cost) {
      p.carried -= t.pulse_cost;
      p.pulseReadyAt = this.tick + secToTicks(t.pulse_cooldown_s);
      const stunned = [];
      for (const s of this.shades) {
        const d = distXZ(p.pos, s.pos);
        if (d > t.pulse_radius) continue;
        const ux = d > 1e-9 ? (s.pos[0] - p.pos[0]) / d : 1;
        const uz = d > 1e-9 ? (s.pos[2] - p.pos[2]) / d : 0;
        s.pos[0] += ux * t.pulse_push_m;
        s.pos[2] += uz * t.pulse_push_m;
        this.#clampIsland(s.pos);
        this.#pushOutOfSafe(s.pos);
        s.stunUntil = this.tick + secToTicks(t.pulse_stun_s);
        stunned.push(s.id);
      }
      this.score += t.score.per_stun * stunned.length;
      this.#emit('pulse', { stunned_ids: stunned });
    }

    // 6. shades chase (stunned ones stay still)
    for (const s of this.shades) {
      if (this.#isStunned(s)) continue;
      const dx = p.pos[0] - s.pos[0], dz = p.pos[2] - s.pos[2];
      const d = Math.hypot(dx, dz);
      const stepLen = Math.min(t.shade_speed * dt, d);
      if (d > 1e-9) { s.pos[0] += (dx / d) * stepLen; s.pos[2] += (dz / d) * stepLen; }
      this.#clampIsland(s.pos);
      this.#pushOutOfSafe(s.pos);
    }

    // 7. shade touches player
    if (this.tick >= p.invulnUntil) {
      for (const s of this.shades) {
        if (this.#isStunned(s) || distXZ(p.pos, s.pos) > t.shade_hit_radius) continue;
        p.flames -= 1;
        const dropped = Math.floor(p.carried * t.hit_drop_ratio);
        p.carried -= dropped;
        p.invulnUntil = this.tick + secToTicks(t.invuln_s);
        this.#emit('player_hit', { by: 'shade', flames: p.flames, dropped });
        if (p.flames <= 0) { this.#finish('lost', 'no_flames'); return this.events; }
        break;
      }
    }

    // 8. random spawns
    if (this.randomMotes && this.motes.length < w.motes_target) {
      if (++this.moteTimer >= secToTicks(w.mote_respawn_s)) { this.moteTimer = 0; this.#spawnMote(); }
    } else this.moteTimer = 0;
    if (this.randomShades && this.tick >= this.nextShadeAt) {
      this.nextShadeAt += secToTicks(w.shade_spawn_every_s);
      if (this.shades.length < w.shade_max) this.#spawnShade();
    }

    // 9. dawn
    if (this.timeLeftTicks() <= 0) this.#finish('lost', 'dawn');
    return this.events;
  }

  snapshot() {
    const p = this.player;
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.tick,
      state: this.state,
      time_left_s: r3(this.timeLeftTicks() / HZ),
      score: this.score,
      player: { pos: p.pos.map(r3), flames: p.flames, carried: p.carried },
      lanterns: this.lanterns.map((L) => ({ id: L.id, pos: L.pos.map(r3), lit: L.lit, deposited: L.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: this.#isStunned(s) ? 'stunned' : 'chase' })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3) })),
    };
  }
}
