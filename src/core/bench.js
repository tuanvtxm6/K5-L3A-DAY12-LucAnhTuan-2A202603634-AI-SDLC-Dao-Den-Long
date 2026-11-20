// Ticket-04 standard benchmark scene (same for every build): night 1, 200 wandering shades spread
// over the island, 100 motes (above the gameplay cap), L1-L3 lit with fuel 100. Seeded, deterministic.
import { makeRng } from './rng.js';

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;

export function benchScenario(seed = 42, { shades = 200, motes = 100, radius = 38 } = {}) {
  const rng = makeRng(seed);
  const disk = (y) => { // uniform over the disk
    const r = Math.sqrt(rng()) * radius, a = rng() * 2 * Math.PI;
    return [r3(r * Math.cos(a)), y, r3(r * Math.sin(a))];
  };
  return {
    player: { pos: [0, 0, 0] },
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    shades: Array.from({ length: shades }, (_, i) => ({ id: `S${i + 1}`, pos: disk(1), state: 'wander' })),
    motes: Array.from({ length: motes }, () => disk(0)),
    lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: 100 })),
  };
}

// Camera path of the bench: circle r=30 at Y=15 around (0,0,0), starts at angle 0 (30,15,0),
// counter-clockwise seen from above (+X toward +Z, the map convention), one lap per 15 s.
export function benchCamera(tSec) {
  const a = (2 * Math.PI * tSec) / 15;
  return [30 * Math.cos(a), 15, 30 * Math.sin(a)];
}

// Frame statistics exactly as Ticket-04 defines them (dts in ms).
export function frameStats(dts) {
  const n = dts.length;
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(n - k);
  const p95 = sorted[Math.min(n - 1, Math.ceil(0.95 * n) - 1)];
  return {
    frames: n,
    avg_fps: (1000 * n) / sum,
    p1_low_fps: 1000 / (worst.reduce((a, b) => a + b, 0) / k),
    frame_ms_p95: p95,
  };
}
