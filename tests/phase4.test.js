// Ticket-04 (Contract v1.3): leaderboard rules + export, bench scene + stats, soak. Names match docs/notes/phase-4-spec.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Game, DEFAULT_INPUT } from '../src/core/sim.js';
import { benchScenario, benchCamera, frameStats } from '../src/core/bench.js';
import { addEntry, isoWithOffset, sortEntries, validName } from '../src/core/leaderboard.js';

const root = new URL('..', import.meta.url);
const dir = mkdtempSync(join(tmpdir(), 'ddl-p4-'));
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('AC-lb name: 3-12 chars of letters/digits/_ (Vietnamese accepted)', () => {
  for (const ok of ['abc', 'Mai_99', 'Mây_01', 'Đăng', 'a'.repeat(12), 'Nguyễn']) assert.ok(validName(ok), ok);
  for (const bad of ['ab', 'a'.repeat(13), 'a b', 'x-y', '', 'tên!', null]) assert.ok(!validName(bad), String(bad));
});

test('AC-lb order: score desc, equal score -> earlier achieved_at first, top 10 kept, rank returned', () => {
  let e = [];
  const add = (name, score, at) => { const r = addEntry(e, { name, score, nights_won: 1, achieved_at: at, seed: 7 }); e = r.entries; return r.rank; };
  add('late', 500, '2026-11-20T10:00:00+07:00');
  add('early', 500, '2026-11-20T09:00:00+07:00');
  assert.equal(add('top', 900, '2026-11-20T11:00:00+07:00'), 1);
  assert.deepEqual(e.map((x) => x.name), ['top', 'early', 'late']);
  for (let i = 0; i < 9; i++) add(`p${i}xx`, 100 + i, '2026-11-20T12:00:00+07:00');
  assert.equal(e.length, 10);
  assert.equal(add('low', 1, '2026-11-20T13:00:00+07:00'), 11, 'rank beyond the top 10 (only 10 were kept)');
  assert.ok(!e.some((x) => x.name === 'low'));
  // offsets are compared as instants: 10:00+07:00 is earlier than 04:00+00:00
  assert.deepEqual(sortEntries([{ name: 'b', score: 1, achieved_at: '2026-11-20T04:00:00+00:00' }, { name: 'a', score: 1, achieved_at: '2026-11-20T10:00:00+07:00' }]).map((x) => x.name), ['a', 'b']);
});

test('AC-lb time: ISO 8601 with a UTC offset', () => {
  assert.match(isoWithOffset(new Date()), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  assert.ok(!Number.isNaN(Date.parse(isoWithOffset())));
});

test('AC-lb export: <run_cmd> --export-leaderboard out.json writes {"entries": [...]} in order', () => {
  const contract = JSON.parse(readFileSync(new URL('game.contract.json', root), 'utf8'));
  const lb = join(dir, 'lb.json'), out = join(dir, 'out.json');
  writeFileSync(lb, JSON.stringify({ entries: [
    { name: 'second', score: 100, nights_won: 1, achieved_at: '2026-11-20T10:00:00+07:00', seed: 1 },
    { name: 'first', score: 300, nights_won: 3, achieved_at: '2026-11-20T11:00:00+07:00', seed: 2 },
  ] }));
  const [cmd, ...pre] = contract.run_cmd.split(' ');
  const r = spawnSync(cmd, [...pre, '--export-leaderboard', out], { cwd: root, encoding: 'utf8', env: { ...process.env, DDL_LEADERBOARD: lb } });
  assert.equal(r.status, 0, r.stderr);
  const data = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(data.entries.map((e) => [e.name, e.score, e.nights_won]), [['first', 300, 3], ['second', 100, 1]]);
  for (const e of data.entries) assert.deepEqual(Object.keys(e).sort(), ['achieved_at', 'name', 'nights_won', 'score', 'seed']);
});

test('AC-bench scene: 200 wander shades + 100 motes spread on the island, L1-L3 lit at 100, deterministic', () => {
  const sc = benchScenario(42);
  assert.equal(sc.shades.length, 200);
  assert.equal(sc.motes.length, 100);
  assert.ok(sc.shades.every((s) => s.state === 'wander' && Math.hypot(s.pos[0], s.pos[2]) <= 38));
  assert.deepEqual(sc.lanterns, ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: 100 })));
  assert.deepEqual(benchScenario(42), sc);
  assert.notDeepEqual(benchScenario(43).shades[0].pos, sc.shades[0].pos);
  // spread: every quadrant gets a fair share
  const q = [0, 0, 0, 0];
  for (const s of sc.shades) q[(s.pos[0] >= 0 ? 0 : 1) + (s.pos[2] >= 0 ? 0 : 2)]++;
  assert.ok(q.every((n) => n > 30), String(q));
});

test('AC-bench rules: no spawns, damage, pickup, fuel decay or end; shades keep wandering', () => {
  const sc = benchScenario(42);
  sc.shades[0].pos = [0.3, 1, 0];     // touching Mây
  sc.motes[0] = [0, 0, 0.2];          // under Mây
  sc.time_left_s = 1;                 // would end the night
  const g = new Game({ seed: 42, night: 1, scenario: sc, bench: true });
  const evs = [];
  for (let i = 0; i < 1200; i++) evs.push(...g.step(DEFAULT_INPUT));
  const s = g.snapshot();
  assert.deepEqual(evs, []);
  assert.equal(s.state, 'playing');
  assert.equal(s.player.flames, 3);
  assert.equal(s.motes_active, 100);
  assert.equal(s.shades.length, 200);
  assert.ok(s.shades.every((x) => x.state === 'wander'));
  assert.deepEqual(s.lanterns.slice(0, 3).map((l) => l.fuel), [100, 100, 100]);
  assert.ok(g.shades.some((x, i) => x.pos[0] !== sc.shades[i].pos[0]), 'shades move');
  // bench never leaks into the contract: without the flag the same scenario plays normally
  const normal = new Game({ seed: 42, night: 1, scenario: sc });
  assert.ok(normal.step(DEFAULT_INPUT).some((e) => e.name === 'player_hit' || e.name === 'mote_picked'));
});

test('AC-bench rules: bench blocks scheduled spawns even when the scenario leaves random spawning on', () => {
  const g = new Game({ seed: 42, night: 1, bench: true });
  const before = g.motes.length;
  const evs = [];
  for (let i = 0; i < 800; i++) evs.push(...g.step(DEFAULT_INPUT)); // past shade tick 300 and mote ticks 240..720
  assert.ok(!evs.some((e) => e.name === 'shade_spawned'));
  assert.equal(g.motes.length, before);
});

test('AC-bench camera: r=30, Y=15, starts at (30,15,0), counter-clockwise from above, 15 s per lap', () => {
  const at = (t) => benchCamera(t).map((v) => Math.round(v * 1e6) / 1e6 + 0);
  assert.deepEqual(at(0), [30, 15, 0]);
  assert.deepEqual(at(3.75), [0, 15, 30]);   // quarter lap: +X -> +Z (map convention)
  assert.deepEqual(at(15), [30, 15, 0]);
});

test('AC-bench stats: avg = 1000N/sum, 1% low = 1000/mean(worst ceil(1%N)), p95', () => {
  const dts = [...Array(99).fill(10), 100];
  const s = frameStats(dts);
  assert.equal(s.frames, 100);
  near(s.avg_fps, (1000 * 100) / 1090);
  near(s.p1_low_fps, 10);
  assert.equal(s.frame_ms_p95, 10);
  const t = frameStats([...Array(150).fill(5), 20, 40]); // k = ceil(1.52) = 2
  near(t.p1_low_fps, 1000 / 30);
});

test('AC-soak: nights in one process, seed + i, 0 crashes, memory bounded, results deterministic', () => {
  const contract = JSON.parse(readFileSync(new URL('game.contract.json', root), 'utf8'));
  const [cmd, ...pre] = contract.soak_cmd.split(' ');
  const run = (name) => {
    const out = join(dir, name);
    const r = spawnSync(cmd, [...pre, '--seed', '7', '--nights', '4', '--out', out], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(readFileSync(out, 'utf8'));
  };
  const a = run('s1.json'), b = run('s2.json');
  assert.equal(a.nights, 4);
  assert.equal(a.crashes, 0);
  assert.equal(a.results.length, 4);
  assert.ok(a.results.every((x) => x === 'won' || x === 'lost'));
  assert.ok(a.mem_end_mb <= 1.2 * a.mem_start_mb, `${a.mem_end_mb} > 1.2 x ${a.mem_start_mb}`);
  assert.deepEqual(a.results, b.results);
  assert.equal(a.ticks, b.ticks);
});
