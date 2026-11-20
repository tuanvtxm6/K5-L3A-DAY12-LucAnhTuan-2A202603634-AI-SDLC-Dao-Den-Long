// CLI-level tests: exactly what the grader runs (game.contract.json headless_cmd).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TUNING } from '../src/core/tuning.js';

const root = new URL('..', import.meta.url);
const contract = JSON.parse(readFileSync(new URL('game.contract.json', root), 'utf8'));
const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
let n = 0;
const file = (obj, raw) => { const p = join(dir, `f${n++}.json`); writeFileSync(p, raw ?? JSON.stringify(obj)); return p; };

function headless(args) {
  const out = join(dir, `o${n++}.jsonl`);
  const [cmd, ...pre] = contract.headless_cmd.split(' ');
  const r = spawnSync(cmd, [...pre, ...args, '--out', out], { cwd: root, encoding: 'utf8' });
  let lines = [];
  try { lines = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l)); } catch { /* no output */ }
  return { code: r.status, stderr: r.stderr, lines, raw: lines.length ? readFileSync(out, 'utf8') : '' };
}

test('contract file: version, commands, tuning matches the code', () => {
  assert.equal(contract.contract_version, '1.1');
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd']) assert.equal(typeof contract[k], 'string');
  assert.deepEqual(contract.tuning, TUNING);
});

test('output format: snapshot at 0 and every N, events, final end line', () => {
  const r = headless(['--seed', '1', '--night', '1', '--ticks', '95', '--snapshot-every', '20']);
  assert.equal(r.code, 0, r.stderr);
  const snaps = r.lines.filter((l) => l.type === 'snapshot');
  assert.deepEqual(snaps.map((s) => s.tick), [0, 20, 40, 60, 80]);
  for (const s of snaps) {
    assert.equal(s.sim_tick, s.tick);
    for (const k of ['night', 'state', 'time_left_s', 'score', 'wind', 'player', 'lanterns', 'shades', 'motes_active', 'motes', 'drifters', 'charms']) assert.ok(k in s, k);
    assert.equal(s.time_left_s, Math.round((TUNING.night1_duration_s - s.tick / 60) * 1000) / 1000);
  }
  assert.deepEqual(r.lines[1], { type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
  assert.deepEqual(r.lines.at(-1), { type: 'end', ticks: 95, state: 'playing', score: 0 });
});

test('default snapshot-every is 10', () => {
  const r = headless(['--seed', '1', '--night', '1', '--ticks', '30']);
  assert.deepEqual(r.lines.filter((l) => l.type === 'snapshot').map((s) => s.tick), [0, 10, 20, 30]);
});

test('determinism: same seed/scenario/inputs -> identical bytes; other seed differs', () => {
  const inputs = file({ frames: [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 40 }, { tick: 300, move: [-1, 0] }, { tick: 600, pulse: true }, { tick: 601, pulse: false }] });
  const args = ['--night', '1', '--inputs', inputs, '--ticks', '3000'];
  const a = headless(['--seed', '42', ...args]), b = headless(['--seed', '42', ...args]), c = headless(['--seed', '43', ...args]);
  assert.equal(a.code, 0);
  assert.ok(a.lines.some((l) => l.name === 'shade_spawned'), 'random spawns exercised');
  assert.equal(a.raw, b.raw);
  assert.notEqual(a.raw, c.raw);
});

test('contract v1.0 example under v1.1 numbers: event ticks follow the tick model', () => {
  const scenario = file({ player: { pos: [0, 0, 0], carried: 3, flames: 3 }, random_motes: false, random_shades: false, motes: [[0, 0, 5]], shades: [{ pos: [10, 0, 0] }], lanterns: [{ id: 'L1', pos: [0, 0, 25], deposited: 0 }], time_left_s: 300 });
  const inputs = file({ frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 0 }, { tick: 120, move: [0, 0], interact: true }, { tick: 121, interact: false }, { tick: 200, pulse: true }, { tick: 201, pulse: false }] });
  const r = headless(['--seed', '1', '--night', '1', '--scenario', scenario, '--inputs', inputs, '--ticks', '300']);
  assert.equal(r.code, 0, r.stderr);
  const ev = r.lines.filter((l) => l.type === 'event');
  // 0.1 s ramp covers 0.35 m in 6 ticks, then 0.1 m/tick: 4 m reached at tick 43; pulse frame 200 -> event tick 201
  assert.deepEqual(ev.map((e) => [e.tick, e.name]), [[0, 'night_start'], [43, 'mote_picked'], [201, 'pulse']]);
  assert.deepEqual(ev[2].data, { stunned_ids: ['S1'] });
  const s0 = r.lines[0];
  assert.equal(s0.tick, 0); assert.equal(s0.motes_active, 1); assert.equal(s0.score, 0);
  assert.deepEqual(s0.lanterns[0], { id: 'L1', pos: [0, 0, 25], lit: false, deposited: 0 });
});

test('stops at game over with end state', () => {
  const scenario = file({ random_motes: false, random_shades: false, motes: [], shades: [{ pos: [0.2, 0, 0] }], player: { flames: 1 } });
  const r = headless(['--seed', '1', '--night', '1', '--scenario', scenario, '--ticks', '500']);
  assert.equal(r.code, 0);
  assert.deepEqual(r.lines.at(-2), { type: 'event', tick: 1, name: 'game_over', data: { result: 'lost', reason: 'no_flames' } });
  assert.deepEqual(r.lines.at(-1), { type: 'end', ticks: 1, state: 'lost', score: 0 });
});

test('malformed inputs/scenario -> exit 2 with stderr message', () => {
  const bad = [
    file(null, '{not json'),
    file({ frames: [{ tick: 5 }, { tick: 5 }] }),
    file({ frames: [{ tick: 0, move: 'up' }] }),
    file({ frames: [{ tick: 0, jump: 1 }] }),
    file({ nope: [] }),
  ];
  for (const f of bad) {
    const r = headless(['--seed', '1', '--night', '1', '--inputs', f, '--ticks', '10']);
    assert.equal(r.code, 2, `inputs ${readFileSync(f, 'utf8')}`);
    assert.match(r.stderr, /inputs/);
  }
  for (const sc of [{ shades: [{}] }, { player: { pos: [0, 0] } }, { random_motes: 'yes' }, { shades: [{ pos: [1, 0, 1], state: 'angry' }] },
    { charms: [{ id: 'C9' }] }, { drifters: [{ pos: [0, 0, 0], stolen: -1 }] }, { player: { invuln_ticks: 1.5 } }]) {
    const r = headless(['--seed', '1', '--night', '1', '--scenario', file(sc), '--ticks', '10']);
    assert.equal(r.code, 2, JSON.stringify(sc));
  }
  assert.equal(headless(['--seed', '1', '--night', '1', '--inputs', join(dir, 'missing.json'), '--ticks', '1']).code, 2);
});

test('bad CLI usage -> non-zero exit', () => {
  assert.notEqual(headless(['--night', '1', '--ticks', '10']).code, 0); // no seed
  assert.notEqual(headless(['--seed', '1', '--night', '4', '--ticks', '10']).code, 0);
});

test('nights 2 and 3 run; full night 3 (21600 ticks) finishes well under 30 s', () => {
  const r2 = headless(['--seed', '1', '--night', '2', '--ticks', '60']);
  assert.equal(r2.code, 0, r2.stderr);
  assert.equal(r2.lines[0].night, 2);
  const sc = file({ player: { flames: 100000 } });
  const t0 = Date.now();
  const r3 = headless(['--seed', '1', '--night', '3', '--scenario', sc, '--ticks', '21600', '--snapshot-every', '1']);
  const ms = Date.now() - t0;
  assert.equal(r3.code, 0, r3.stderr);
  assert.deepEqual(r3.lines.at(-1).ticks, 21600);
  assert.ok(ms < 30000, `took ${ms} ms`);
});

test('pause through the CLI: snapshots say paused, sim_tick frozen', () => {
  const inputs = file({ frames: [{ tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 40, pause: true }] });
  const r = headless(['--seed', '1', '--night', '1', '--inputs', inputs, '--ticks', '60', '--snapshot-every', '10']);
  const snaps = r.lines.filter((l) => l.type === 'snapshot');
  assert.deepEqual(snaps.map((s) => [s.tick, s.sim_tick, s.state]), [[0, 0, 'playing'], [10, 10, 'playing'], [20, 10, 'paused'], [30, 10, 'paused'], [40, 10, 'paused'], [50, 20, 'playing'], [60, 30, 'playing']]); // paused ticks 11..40; tick 41 resumes and simulates
  assert.deepEqual(r.lines.filter((l) => l.type === 'event' && l.name !== 'night_start').map((e) => [e.tick, e.name]), [[11, 'paused'], [41, 'resumed']]);
});
