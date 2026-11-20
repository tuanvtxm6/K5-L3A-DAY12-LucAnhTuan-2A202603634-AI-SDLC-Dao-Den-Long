// Three.js scene: terrain per night (from the same map data as the sim) + entity rendering.
// Reads game state only; never changes it.
import * as THREE from 'three';
import { TUNING } from '/src/core/tuning.js';

// Ticket-02 standard palette
export const C = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lit: 0xffb347, core: 0xffe9b0, off: 0x5b5f6e, moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shade: 0x120a1a, rim: 0x7a3cff, stunned: 0x3a3450, coat: 0xe8e2d0, scarf: 0xc8102e,
  gold: 0xf2c14e, drifter: 0x8fa3b8,
};
const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
const MAT = {
  grass: lambert(C.grass), sand: lambert(C.sand), wood: lambert(C.wood), cliff: lambert(0x56656f),
  sea: lambert(C.sea), gold: lambert(C.gold, { emissive: C.gold, emissiveIntensity: 0.3 }),
};
const GEO = {
  moteCore: new THREE.SphereGeometry(0.12, 8, 6), moteHalo: new THREE.SphereGeometry(0.3, 10, 8),
  shade: new THREE.SphereGeometry(0.75, 16, 12), eye: new THREE.SphereGeometry(0.09, 8, 6),
};

export class World {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(C.sky);
    this.scene.fog = new THREE.FogExp2(C.fog, 0.02);
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
    this.hemi = new THREE.HemisphereLight(0x9fb4ff, 0x203040, 0.15);
    this.moon = new THREE.DirectionalLight(0xb8c4ff, 1.4); // own choice: readable night
    this.moon.position.set(-30, 50, 20);
    this.scene.add(this.hemi, this.moon);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), MAT.sea);
    sea.rotation.x = -Math.PI / 2; sea.position.y = -14;
    this.scene.add(sea);
    this.level = null;
    this.player = this.#makePlayer();
    this.scene.add(this.player);
    this.pools = { motes: new Map(), shades: new Map(), drifters: new Map() };
    this.pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), basic(C.core, { transparent: true, opacity: 0, side: THREE.DoubleSide }));
    this.pulseRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.pulseRing);
    this.pulseFx = 0;
    this.leaves = this.#makeLeaves();
    this.scene.add(this.leaves);
  }

  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }

  // ---------- level ----------
  build(game) {
    if (this.level) this.scene.remove(this.level);
    for (const pool of Object.values(this.pools)) { for (const m of pool.values()) this.scene.remove(m); pool.clear(); }
    const g = new THREE.Group();
    const map = game.map;
    if (map.night === 1) this.#island(g, 0, 0, 40);
    if (map.night === 2) {
      this.#island(g, 0, 0, 28); this.#island(g, 70, 0, 28);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), MAT.wood);
      bridge.position.set(35, -0.15, 0); g.add(bridge);
      for (let x = 26.5; x < 44; x += 1.2) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.32, 4.05), lambert(0x4d3420));
        plank.position.set(x, -0.14, 0); g.add(plank);
      }
    }
    if (map.night === 3) this.#bellIsland(g);
    for (const pad of map.pads) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 24), MAT.gold);
      disc.position.set(pad.pos[0], pad.pos[1] + 0.06, pad.pos[2]); g.add(disc);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), basic(C.core));
      glow.rotation.x = -Math.PI / 2; glow.position.set(pad.pos[0], pad.pos[1] + 0.13, pad.pos[2]); g.add(glow);
    }
    this.lanterns = new Map();
    for (const L of game.lanterns) {
      const m = this.#makeLantern(); m.position.set(...L.pos); g.add(m); this.lanterns.set(L.id, m);
    }
    this.charms = new Map();
    for (const c of game.charms) {
      const m = this.#makeCharm(); m.position.set(c.pos[0], c.pos[1] + 1, c.pos[2]); g.add(m); this.charms.set(c.id, m);
    }
    this.level = g;
    this.scene.add(g);
  }

  #island(g, x, z, r) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 2, 64), [MAT.cliff, MAT.grass, MAT.cliff]);
    top.position.set(x, -1, z); g.add(top);
    const under = new THREE.Mesh(new THREE.ConeGeometry(r * 0.92, r * 0.5, 32), MAT.cliff);
    under.rotation.x = Math.PI; under.position.set(x, -2 - r * 0.25, z); g.add(under);
    const beach = new THREE.Mesh(new THREE.RingGeometry(r - 1.5, r, 64), MAT.sand);
    beach.rotation.x = -Math.PI / 2; beach.position.set(x, 0.01, z); g.add(beach);
    // a few trees (decor only, not obstacles in the sim, so keep them near the beach)
    for (let i = 0; i < Math.round(r / 3); i++) {
      const a = i * 2.39996, rr = r - 3 - (i % 3);
      const tree = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3, 7), lambert(0x1f4436));
      tree.position.set(x + Math.cos(a) * rr, 1.5, z + Math.sin(a) * rr); g.add(tree);
    }
  }

  #bellIsland(g) {
    this.#island(g, 0, 0, 45);
    // tier 1: half annulus r 12..24, z > 0, Y = 3
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 24, Math.PI, 2 * Math.PI, false);
    sh.absarc(0, 0, 12, 2 * Math.PI, Math.PI, true);
    const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false, curveSegments: 32 }), [MAT.grass, MAT.cliff]);
    t1.rotation.x = -Math.PI / 2; // shape y<0 -> world z>0, extrusion -> +Y
    g.add(t1);
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), [MAT.cliff, MAT.grass, MAT.cliff]);
    t2.position.y = 3; g.add(t2);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 8, 24), MAT.wood);
    tower.position.y = 10; g.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2, 24), lambert(0x8a2b1f));
    roof.position.y = 15; g.add(roof);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), MAT.gold);
    bell.position.y = 13.2; g.add(bell);
    for (const deg of [30, 150]) { // ramps: r 30 (Y 0) -> r 24 (Y 3), 3 m wide
      const a = (deg * Math.PI) / 180, len = Math.hypot(6, 3);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 3), MAT.sand);
      ramp.position.set(27 * Math.cos(a), 1.5 - 0.15, 27 * Math.sin(a));
      ramp.rotation.order = 'YXZ';
      ramp.rotation.y = -a;
      // local +X points outward after rotation.y, so tilt it DOWN: high end (Y=3) at r=24, low end at r=30
      ramp.rotation.z = -Math.atan2(3, 6);
      ramp.userData.ramp = { len };
      g.add(ramp);
    }
  }

  // ---------- actors ----------
  #makePlayer() {
    const g = new THREE.Group();
    const coat = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 12), lambert(C.coat, { emissive: C.coat, emissiveIntensity: 0.25 }));
    coat.position.y = 0.55;
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 16), lambert(C.scarf));
    scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.08;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), lambert(0xf2c9a0));
    head.position.y = 1.28;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.38, 20), lambert(C.sand));
    hat.position.y = 1.58;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), basic(C.lit));
    lamp.position.set(0.62, 1.22, 0);
    const light = new THREE.PointLight(C.lit, 10, 14, 1.2);
    light.position.copy(lamp.position);
    g.add(coat, scarf, head, hat, lamp, light);
    g.userData = { light };
    return g;
  }

  #makeLantern() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2), MAT.wood);
    pole.position.y = 1.6;
    const lampMat = new THREE.MeshLambertMaterial({ color: C.off, emissive: C.lit, emissiveIntensity: 0 });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 8), lampMat);
    lamp.position.y = 3.6;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), basic(C.core));
    core.position.y = 3.6; core.visible = false;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.4, 8), lambert(0x8a2b1f));
    cap.position.y = 4.25;
    const light = new THREE.PointLight(C.lit, 0, 22, 1.2);
    light.position.y = 3.6;
    const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.12, TUNING.safe_radius, 48), basic(C.lit, { transparent: true, opacity: 0 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
    g.add(pole, lamp, core, cap, light, ring);
    g.userData = { lampMat, core, light, ring };
    return g;
  }

  #makeCharm() {
    const g = new THREE.Group();
    const border = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.92, 0.04), MAT.gold);
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.06), basic(C.scarf));
    g.add(border, paper);
    return g;
  }

  #makeShade() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(GEO.shade, lambert(C.shade, { emissive: C.shade }));
    body.scale.set(1, 1.15, 1);
    const rim = new THREE.Mesh(GEO.shade, basic(C.rim, { side: THREE.BackSide }));
    rim.scale.set(1.12, 1.28, 1.12);
    const eyeMat = basic(0xd8c8ff);
    const e1 = new THREE.Mesh(GEO.eye, eyeMat), e2 = new THREE.Mesh(GEO.eye, eyeMat);
    e1.position.set(-0.24, 0.22, 0.68); e2.position.set(0.24, 0.22, 0.68);
    g.add(rim, body, e1, e2);
    g.userData = { body };
    return g;
  }

  #makeDrifter() {
    const geo = new THREE.PlaneGeometry(0.35, 2.4, 1, 10);
    const m = new THREE.Mesh(geo, lambert(C.drifter, { side: THREE.DoubleSide, transparent: true, opacity: 0.85, emissive: C.drifter, emissiveIntensity: 0.25 }));
    m.userData = { base: geo.attributes.position.array.slice() };
    const loot = new THREE.Mesh(GEO.moteHalo, basic(C.moteHalo, { transparent: true, opacity: 0.6 }));
    loot.position.y = -1; m.add(loot); m.userData.loot = loot;
    return m;
  }

  #makeMote() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(GEO.moteCore, basic(C.moteCore, { fog: false })));
    g.add(new THREE.Mesh(GEO.moteHalo, basic(C.moteHalo, { transparent: true, opacity: 0.3, fog: false })));
    return g;
  }

  #makeLeaves() {
    const n = 160, pos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9ccf6a, size: 0.25, transparent: true, opacity: 0 }));
    pts.userData.seed = Array.from({ length: n }, (_, i) => [((i * 7919) % 100) / 100, ((i * 104729) % 100) / 100, ((i * 1299709) % 100) / 100]);
    return pts;
  }

  #sync(pool, items, make) {
    const seen = new Set();
    for (const it of items) {
      seen.add(it.id);
      if (!pool.has(it.id)) { const m = make(); pool.set(it.id, m); this.scene.add(m); }
    }
    for (const [id, m] of pool) if (!seen.has(id)) { this.scene.remove(m); pool.delete(id); }
  }

  pulse() { this.pulseFx = 1; }

  // ---------- per frame ----------
  update(game, t, camYaw) {
    const p = game.player;
    // player
    const pm = this.player;
    pm.visible = p.fallWait === 0 && !(p.invuln > 0 && Math.floor(t * 12) % 2 === 0);
    pm.position.set(...p.pos);
    pm.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
    pm.userData.light.intensity = 6 + p.carried * 1.2;

    // camera: behind the player along camYaw (forward = (sin, cos))
    const yr = (camYaw * Math.PI) / 180, fx = Math.sin(yr), fz = Math.cos(yr);
    const cy = Math.max(p.pos[1], -2);
    this.camera.position.set(p.pos[0] - fx * 9, cy + 5, p.pos[2] - fz * 9);
    this.camera.lookAt(p.pos[0] + fx * 2, cy + 1.2, p.pos[2] + fz * 2);

    // lanterns + environment light 0.15 + 0.55 * progress
    let lit = 0;
    for (const L of game.lanterns) {
      const u = this.lanterns.get(L.id).userData;
      const f = L.lit ? 1 : L.deposited / TUNING.lantern_cost;
      u.lampMat.color.set(L.lit ? C.lit : C.off);
      u.lampMat.emissiveIntensity = L.lit ? 1.6 + Math.sin(t * 3) * 0.15 : f * 0.7;
      u.core.visible = L.lit;
      u.light.intensity = L.lit ? 40 : f * 6;
      u.ring.material.opacity = L.lit ? 0.35 : 0;
      if (L.lit) lit++;
    }
    const k = lit / game.lanterns.length;
    this.hemi.intensity = 0.15 + 0.55 * k;
    this.scene.fog.density = 0.02 - 0.01 * k;

    for (const c of game.charms) {
      const m = this.charms.get(c.id);
      if (!m) continue;
      m.visible = c.available;
      m.rotation.y = t * 1.5;
      m.position.y = c.pos[1] + 1 + Math.sin(t * 2) * 0.15;
    }

    // motes
    this.#sync(this.pools.motes, game.motes, () => this.#makeMote());
    for (const m of game.motes) {
      const g = this.pools.motes.get(m.id);
      const ph = Number(m.id.slice(1));
      g.position.set(m.pos[0] + Math.sin(t * 1.3 + ph) * 0.12, m.pos[1] + 0.7 + Math.sin(t * 2 + ph) * 0.2, m.pos[2] + Math.cos(t * 1.1 + ph) * 0.12);
      g.visible = !(m.kind === 'dropped' && m.ttl < 120 && Math.floor(t * 8) % 2 === 0);
    }

    // shades
    this.#sync(this.pools.shades, game.shades, () => this.#makeShade());
    for (const s of game.shades) {
      const g = this.pools.shades.get(s.id);
      g.position.set(s.pos[0], s.pos[1] + Math.sin(t * 2 + s.pos[0]) * 0.12, s.pos[2]);
      g.lookAt(p.pos[0], s.pos[1], p.pos[2]);
      g.userData.body.material.color.set(s.state === 'stunned' ? C.stunned : C.shade);
      const sc = s.state === 'spawning' ? Math.max(0.2, 1 - s.ticks / 30) : 1;
      g.scale.setScalar(sc);
    }

    // drifters: waving ribbons
    this.#sync(this.pools.drifters, game.drifters, () => this.#makeDrifter());
    for (const d of game.drifters) {
      const m = this.pools.drifters.get(d.id);
      m.visible = d.state !== 'removed';
      m.position.set(d.pos[0], d.pos[1] + 0.4, d.pos[2]);
      m.rotation.y = t * 0.8 + Number(d.id.slice(1));
      const arr = m.geometry.attributes.position.array, base = m.userData.base;
      for (let i = 0; i < arr.length; i += 3) arr[i] = base[i] + Math.sin(t * 6 + base[i + 1] * 2.5) * 0.25;
      m.geometry.attributes.position.needsUpdate = true;
      m.userData.loot.visible = d.stolen > 0;
    }

    // pulse ring
    if (this.pulseFx > 0) {
      this.pulseFx = Math.max(0, this.pulseFx - 0.05);
      const r = TUNING.pulse_radius * (1 - this.pulseFx) + 0.1;
      this.pulseRing.scale.set(r, r, 1);
      this.pulseRing.position.set(p.pos[0], p.pos[1] + 0.8, p.pos[2]);
      this.pulseRing.material.opacity = this.pulseFx;
    }

    // wind leaves: visible during the 2 s warning and the gust
    const w = game.wind, dirDeg = w.active ? w.dir : w.nextDir;
    const lv = this.leaves;
    lv.material.opacity = dirDeg === null ? Math.max(0, lv.material.opacity - 0.02) : Math.min(0.9, lv.material.opacity + 0.03);
    if (lv.material.opacity > 0 && dirDeg !== null) {
      const a = (dirDeg * Math.PI) / 180, ux = Math.cos(a), uz = Math.sin(a);
      const arr = lv.geometry.attributes.position.array;
      lv.userData.seed.forEach(([s1, s2, s3], i) => {
        const along = ((t * (w.active ? 6 : 3) + s1 * 40) % 40) - 20, side = (s2 - 0.5) * 30;
        arr[i * 3] = p.pos[0] + ux * along - uz * side;
        arr[i * 3 + 1] = p.pos[1] + 0.3 + s3 * 4 + Math.sin(t * 3 + i) * 0.3;
        arr[i * 3 + 2] = p.pos[2] + uz * along + ux * side;
      });
      lv.geometry.attributes.position.needsUpdate = true;
    }
    return lit;
  }
}
