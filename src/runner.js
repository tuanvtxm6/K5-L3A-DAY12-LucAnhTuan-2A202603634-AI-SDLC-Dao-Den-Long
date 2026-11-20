// Headless runner per Test Contract v1.1.
// Used by: node src/headless.js --seed <int> --night <1|2|3> [--scenario f.json] [--inputs f.json]
//                      --ticks <int> --out out.jsonl [--snapshot-every 10]
import { readFileSync } from 'node:fs';
import { Game, DEFAULT_INPUT } from './core/sim.js';
import { ValidationError, parseJson, validateInputs, validateScenario } from './core/validate.js';

export class UsageError extends Error {}

export function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) throw new UsageError(`unexpected argument "${k}"`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new UsageError(`missing value for ${k}`);
    a[k.slice(2)] = v;
    i++;
  }
  const int = (name, required, def) => {
    if (a[name] === undefined) {
      if (required) throw new UsageError(`--${name} is required`);
      return def;
    }
    if (!/^-?\d+$/.test(a[name])) throw new UsageError(`--${name} must be an integer`);
    return Number(a[name]);
  };
  const opts = {
    seed: int('seed', true),
    night: int('night', true),
    ticks: int('ticks', true),
    snapshotEvery: int('snapshot-every', false, 10),
    out: a.out,
    scenario: a.scenario,
    inputs: a.inputs,
  };
  if (!opts.out) throw new UsageError('--out is required');
  if (![1, 2, 3].includes(opts.night)) throw new UsageError('--night must be 1, 2 or 3');
  if (opts.ticks < 0) throw new UsageError('--ticks must be >= 0');
  if (opts.snapshotEvery <= 0) throw new UsageError('--snapshot-every must be > 0');
  return opts;
}

function readJsonFile(path, label) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch (e) { throw new ValidationError(`${label}: cannot read ${path} (${e.code})`); }
  return parseJson(text, label);
}

export function run(opts) {
  const scenario = opts.scenario ? validateScenario(readJsonFile(opts.scenario, 'scenario'), opts.night) : null;
  const frames = opts.inputs ? validateInputs(readJsonFile(opts.inputs, 'inputs')) : [];

  const game = new Game({ seed: opts.seed, night: opts.night, scenario });
  const lines = [JSON.stringify(game.snapshot())];
  lines.push(JSON.stringify({ type: 'event', tick: 0, name: 'night_start', data: { night: opts.night } }));
  const cur = { ...DEFAULT_INPUT, move: [0, 0] };
  let fi = 0;
  for (let k = 0; k < opts.ticks && game.state !== 'won' && game.state !== 'lost'; k++) {
    while (fi < frames.length && frames[fi].tick === k) Object.assign(cur, frames[fi++]);
    for (const ev of game.step(cur)) lines.push(JSON.stringify(ev));
    if (game.tick % opts.snapshotEvery === 0) lines.push(JSON.stringify(game.snapshot()));
  }
  lines.push(JSON.stringify({ type: 'end', ticks: game.tick, state: game.state, score: game.score }));
  return lines.join('\n') + '\n';
}
