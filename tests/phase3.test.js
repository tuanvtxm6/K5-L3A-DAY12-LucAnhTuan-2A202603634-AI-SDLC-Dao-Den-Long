// Ticket-03 "Đèn cạn dầu" (Contract v1.2). Names match docs/notes/phase-3-spec.md (AC-x).
// Fuel is integer 1/60 units: 100 fuel = 6000 units, decay 1 unit/tick, drain 5 units/tick per shade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/sim.js';
import { inp, game, runFor, press, names } from './helpers.js';

const fuel = (g, id = 'L1') => g.snapshot().lanterns.find((l) => l.id === id).fuel;
const lant = (g, id = 'L1') => g.lanterns.find((l) => l.id === id);

test('AC-fuel: lit lantern starts at 100 and loses 1.0/s exactly (integer units)', () => {
  const g = game({ lanterns: [{ id: 'L1', lit: true }] });
  assert.equal(fuel(g), 100);
  runFor(g, 60);
  assert.equal(fuel(g), 99);
  runFor(g, 540);
  assert.equal(lant(g).fu, 6000 - 600);
  assert.equal(fuel(g), 90);
});

test('AC-out: fuel <= 0 -> unlit, deposited 0, ever_lit kept, lantern_out; relight costs 5 and scores 5x5 + 40', () => {
  const g = game({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5], lit: true, fuel: 0.5 }] });
  let ev = runFor(g, 29);
  assert.ok(!names(ev).includes('lantern_out'));
  ev = g.step(inp());
  assert.deepEqual(ev.map((e) => [e.tick, e.name, e.data]), [[30, 'lantern_out', { lantern_id: 'L1' }]]);
  let L = g.snapshot().lanterns[0];
  assert.deepEqual([L.lit, L.fuel, L.deposited, L.ever_lit], [false, 0, 0, true]);
  ev = press(g, 'interact');
  assert.deepEqual(ev.map((e) => [e.name, e.data]), [
    ['deposit', { lantern_id: 'L1', amount: 5, deposited: 5 }], ['lantern_lit', { lantern_id: 'L1', relight: true }]]);
  L = g.snapshot().lanterns[0];
  assert.deepEqual([L.lit, L.relit_count, g.score], [true, 1, 5 * 5 + 40]);
  assert.ok(L.fuel > 99.9);
});

test('AC-out: a never-lit lantern still needs 10; first light scores +100 and lantern_lit relight false', () => {
  const g = game({ player: { carried: 9 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5] }] });
  assert.deepEqual(names(press(g, 'interact')), ['deposit']);
  g.player.carried = 1;
  const ev = press(g, 'interact');
  assert.deepEqual(ev[1].data, { lantern_id: 'L1', relight: false });
  assert.equal(g.score, 10 * 5 + 100);
});

test('AC-refuel: used = min(carried, ceil((100 - fuel)/10)), fuel capped at 100, +5 per mote', () => {
  const g = game({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5], lit: true, fuel: 55 }] });
  const ev = g.step(inp({ interact: true })); // decay first: 54.983 -> needs ceil(45.02/10) = 5
  assert.deepEqual(ev.map((e) => [e.name, e.data]), [['refuel', { lantern_id: 'L1', amount: 5, fuel: 100 }]]);
  assert.equal(g.player.carried, 5);
  assert.equal(g.score, 25);
  const h = game({ player: { carried: 1 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5], lit: true, fuel: 40 }] });
  assert.deepEqual(h.step(inp({ interact: true }))[0].data, { lantern_id: 'L1', amount: 1, fuel: 50 });
});

test('AC-refuel: interact picks the nearest lantern that can take light (unlit or not full)', () => {
  const g = game({ player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5] }, { id: 'L2', pos: [1, 0, 0], lit: true, fuel: 50 }] });
  assert.equal(g.step(inp({ interact: true }))[0].name, 'refuel');
});

test('AC-zone: safe zone only while fuel >= 30 (exactly 30 still protects)', () => {
  // L1 at fuel 31 -> 1860 units: 30.0 at tick 60, 29.98 at tick 61
  const g = game({ player: { pos: [0, 0, 20] }, lanterns: [{ id: 'L1', pos: [0, 0, 20], lit: true, fuel: 31 }], shades: [{ id: 'S1', pos: [7, 1, 20] }] });
  const d = () => Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2] - 20);
  runFor(g, 60);
  assert.equal(fuel(g), 30);
  assert.ok(Math.abs(d() - 6) < 1e-9, `blocked at the edge: ${d()}`);
  g.step(inp());
  assert.ok(d() < 6 - 0.05, `walks in once fuel < 30: ${d()}`);
});

test('AC-drain: wander shade goes to the weak lantern, drains 5/s on top of decay, fuel_drain every 60 ticks', () => {
  const sc = { player: { pos: [0, 0, -30] }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [0, 1, 26.5] }] };
  const g = game(sc);
  g.step(inp());
  assert.deepEqual([g.shades[0].state, g.shades[0].target], ['drain', 'L1']);
  const ev = runFor(g, 60); // drains ticks 2..61
  assert.deepEqual(ev.filter((e) => e.name === 'fuel_drain').map((e) => [e.tick, e.data]), [[61, { lantern_id: 'L1', shade_id: 'S1', fuel: 14 }]]);
  assert.equal(lant(g).fu, 1200 - 61 - 5 * 60);
  // two shades add up
  const h = game({ ...sc, shades: [{ id: 'S1', pos: [0, 1, 26.5] }, { id: 'S2', pos: [1.5, 1, 25] }] });
  runFor(h, 61);
  assert.equal(lant(h).fu, 1200 - 61 - 2 * 5 * 60);
});

test('AC-drain: only weak lanterns attract; else the nearest unlit lantern; scenario target_lantern_id honoured', () => {
  let g = game({ player: { pos: [0, 0, -35] }, lanterns: [{ id: 'L2', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [0, 1, 20] }] });
  g.step(inp());
  assert.equal(g.snapshot().shades[0].target_lantern_id, 'L2'); // weak L2 beats the closer unlit L1
  g = game({ player: { pos: [0, 0, -35] }, lanterns: [{ id: 'L2', lit: true, fuel: 80 }], shades: [{ id: 'S1', pos: [0, 1, 20] }] });
  g.step(inp());
  assert.equal(g.snapshot().shades[0].target_lantern_id, 'L1');
  g = game({ player: { pos: [0, 0, -35] }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }, { id: 'L2', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [0, 1, 20], target_lantern_id: 'L2' }] });
  g.step(inp());
  assert.equal(g.snapshot().shades[0].target_lantern_id, 'L2');
});

test('AC-drain exits: chase when Mây within 6 m, wander when the lantern goes out', () => {
  const base = { lanterns: [{ id: 'L1', lit: true, fuel: 20 }] };
  let g = game({ ...base, player: { pos: [0, 0, 20.7] }, shades: [{ id: 'S1', pos: [0, 1, 26.5], state: 'drain', target_lantern_id: 'L1' }] });
  g.step(inp());
  assert.equal(g.shades[0].state, 'chase'); // 5.8 m
  g = game({ player: { pos: [0, 0, -30] }, lanterns: [{ id: 'L1', lit: true, fuel: 0.2 }], shades: [{ id: 'S1', pos: [0, 1, 26.5], state: 'drain', target_lantern_id: 'L1' }] });
  const ev = runFor(g, 2); // 12 units: -6 per tick
  assert.ok(names(ev).includes('lantern_out'));
  assert.notEqual(g.shades[0].state, 'drain');
});

test('AC-drain: pulse on a draining shade scores 15 total; refuel to >= 30 evicts drainers harmlessly', () => {
  let g = game({ player: { pos: [0, 0, 22], carried: 3 }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [0, 1, 26.5], state: 'drain', target_lantern_id: 'L1' }] });
  g.step(inp({ pulse: true }));
  assert.deepEqual([g.shades[0].state, g.score], ['stunned', 15]);
  g = game({ player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [0, 1, 26.5], state: 'drain', target_lantern_id: 'L1' }] });
  const ev = [...g.step(inp({ interact: true })), ...runFor(g, 29)];
  assert.ok(names(ev).includes('refuel') && !names(ev).includes('player_hit'));
  assert.ok(Math.abs(Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2] - 25) - 6) < 1e-6);
});

// Note: "stun ends -> chase/wander by distance" is an equivalent mutant here, because step 8 turns
// wander into chase within 12 m in the same tick (A22). Logged in docs/notes/ai-log.md.
test('AC-stun: after a stun the shade returns to wander', () => {
  const g = game({ player: { pos: [0, 0, -15] }, shades: [{ id: 'S1', pos: [0, 1, 0], state: 'stunned', state_ticks_left: 5 }] });
  runFor(g, 5);
  assert.equal(g.shades[0].state, 'wander');
});

test('AC-win: dawn_survived needs ceil(0.6 x n) lit at the last tick; bonus 50 + floor(fuel) each + 50 per flame', () => {
  const lit = (ids) => ids.map((id) => ({ id, lit: true }));
  let g = game({ lanterns: lit(['L1', 'L2', 'L3']), time_left_s: 1 });
  let ev = runFor(g, 60);
  assert.deepEqual(ev.at(-1).data, { result: 'won', reason: 'dawn_survived' });
  assert.equal(g.score, 3 * (50 + 99) + 3 * 50); // fuel 100 -> 99 after 60 ticks
  g = game({ lanterns: lit(['L1', 'L2']), time_left_s: 1 });
  ev = runFor(g, 60);
  assert.deepEqual(ev.at(-1).data, { result: 'lost', reason: 'dawn' });
  assert.equal(g.score, 0);
  for (const [night, need] of [[2, 4], [3, 5]]) {
    const ids = Array.from({ length: need }, (_, i) => `L${i + 1}`);
    assert.equal(new Game({ night, scenario: { random_shades: false, random_drifters: false, lanterns: lit(ids.slice(1)), time_left_s: 0.1 } }).litNeeded(), need);
    const w = new Game({ night, scenario: { random_shades: false, random_drifters: false, wind_enabled: false, lanterns: lit(ids), time_left_s: 0.1 } });
    assert.equal(runFor(w, 6).at(-1).data.reason, 'dawn_survived');
    const l = new Game({ night, scenario: { random_shades: false, random_drifters: false, wind_enabled: false, lanterns: lit(ids.slice(1)), time_left_s: 0.1 } });
    assert.equal(runFor(l, 6).at(-1).data.reason, 'dawn');
  }
});

test('AC-win: no early win when every lantern is lit; no_flames beats dawn on the last tick', () => {
  const all = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  let g = game({ lanterns: all });
  runFor(g, 600);
  assert.equal(g.state, 'playing');
  g = game({ lanterns: all, player: { flames: 1 }, shades: [{ pos: [0.5, 1, 0] }], time_left_s: 1 / 60 });
  assert.deepEqual(g.step(inp()).at(-1).data, { result: 'lost', reason: 'no_flames' });
});

test('AC-capacity: 10 + 2 per successful light (relights count, preset lanterns do not), max 20', () => {
  let g = game({ lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }] });
  assert.equal(g.snapshot().player.capacity, 10);
  g = game({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5] }], motes: [[0, 0, -0.5], [0, 0, -0.6]] });
  assert.equal(g.step(inp()).length, 0, 'full at 10');
  g.step(inp({ interact: true })); // lights L1 -> capacity 12
  assert.equal(g.snapshot().player.capacity, 12);
  g = game({ player: { successful_lights: 4 } });
  assert.equal(g.capacity(), 18);
  g = game({ player: { successful_lights: 9 } });
  assert.equal(g.capacity(), 20);
});

test('v1.2 snapshot + scenario defaults: fuel 1 decimal, ever_lit, relit_count, capacity; lit without fuel = 100', () => {
  const g = game({ lanterns: [{ id: 'L1', lit: true }, { id: 'L2', ever_lit: true }, { id: 'L3', lit: true, fuel: 12.34 }] });
  const s = g.snapshot();
  assert.deepEqual(s.lanterns.slice(0, 3).map((l) => [l.lit, l.fuel, l.ever_lit, l.relit_count]), [[true, 100, true, 0], [false, 0, true, 0], [true, 12.3, true, 0]]);
  assert.equal(s.player.capacity, 10);
});
