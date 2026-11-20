// Ticket-04 soak test: N nights headless in ONE process (night 1 -> 2 -> 3 -> 1 ...), night i (0-based)
// uses seed + i, random seeded input. Usage:
//   node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json
import { writeFileSync } from 'node:fs';
import { Game } from '../src/core/sim.js';
import { makeRng } from '../src/core/rng.js';
import { TUNING } from '../src/core/tuning.js';
import { MAPS } from '../src/core/maps.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith('--') ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const seed = Number(args.seed ?? 7), nights = Number(args.nights ?? 10), out = args.out ?? 'soak.json';
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) { console.error('usage: --seed <int> --nights <int> --out <file>'); process.exit(1); }

const rssMb = () => Math.round((process.memoryUsage().rss / 2 ** 20) * 10) / 10;
const settle = () => { if (global.gc) { global.gc(); global.gc(); } };

const t0 = performance.now();
const results = [];
let crashes = 0, memStart = null, ticksTotal = 0;
for (let i = 0; i < nights; i++) {
  const night = (i % 3) + 1, s = seed + i;
  let game = null;
  try {
    game = new Game({ seed: s, night });
    if (i === 0) { settle(); memStart = rssMb(); } // after the first night is loaded
    const rng = makeRng((s ^ 0x5eed5eed) >>> 0);   // input stream, separate from the game's RNG
    const maxTicks = Math.round(TUNING[MAPS[night].duration_key] * 60) + 60;
    let move = [0, 0];
    for (let k = 0; k < maxTicks && game.state !== 'won' && game.state !== 'lost'; k++) {
      if (k % 30 === 0) { const a = rng() * 2 * Math.PI; move = [Math.cos(a), Math.sin(a)]; }
      game.step({
        move, cam_yaw_deg: 0, pause: false,
        jump: rng() < 0.05, dash: rng() < 0.03, pulse: rng() < 0.02, interact: rng() < 0.10,
      });
      ticksTotal++;
    }
    results.push(game.state === 'won' || game.state === 'lost' ? game.state : 'unfinished');
  } catch (e) {
    crashes++;
    results.push('crash');
    console.error(`night ${i} (map ${night}, seed ${s}) crashed: ${e.stack}`);
  }
  game = null; // reset: drop every reference to the finished night
}
settle();
const report = {
  nights, crashes, results,
  mem_start_mb: memStart, mem_end_mb: rssMb(),
  duration_s: Math.round((performance.now() - t0) / 100) / 10,
  // extra context (not required by the contract)
  seed, ticks: ticksTotal, gc_exposed: !!global.gc, node: process.version,
};
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
process.exit(0);
