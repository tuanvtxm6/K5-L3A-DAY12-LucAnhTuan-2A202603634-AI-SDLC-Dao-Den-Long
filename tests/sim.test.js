// Phase 1 rules, re-checked with the Ticket-02 standard numbers (regression).
// Tests changed in Phase 2 are marked "P2:" with the reason (see docs/notes/phase-2-spec.md §Regression).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/sim.js';
import { TUNING as T } from '../src/core/tuning.js';
import { quiet, inp, game, runFor, press, near, names } from './helpers.js';

test('movement: run speed, camera yaw rotation, normalization (P2: 0.1 s acceleration)', () => {
  let g = game();
  runFor(g, 6, inp({ move: [0, 1] }));
  near(g.player.vel[2], T.player_speed); // full speed after 0.1 s
  const z6 = g.player.pos[2];
  runFor(g, 60, inp({ move: [0, 1] }));
  near(g.player.pos[2] - z6, T.player_speed, 1e-9);
  runFor(g, 6);
  near(g.player.vel[2], 0); // stops within 0.1 s

  g = game();
  runFor(g, 66, inp({ move: [0, 1], cam_yaw_deg: 90 })); // x' = z*sin(90) = +X
  assert.ok(g.player.pos[0] > 6 && Math.abs(g.player.pos[2]) < 1e-9);

  g = game();
  runFor(g, 66, inp({ move: [1, 1] })); // diagonal is normalized
  near(Math.hypot(g.player.vel[0], g.player.vel[2]), T.player_speed);
});

test('jump: only when grounded, leaves the ground, lands back at y=0', () => {
  const g = game();
  g.step(inp({ jump: true }));
  near(g.player.vel[1], 7 - 20 / 60);
  runFor(g, 10, inp({ jump: true })); // holding does not re-trigger
  assert.ok(g.player.pos[1] > 0 && !g.player.grounded);
  press(g, 'jump'); // mid-air press does nothing
  runFor(g, 120);
  assert.equal(g.player.pos[1], 0);
  assert.ok(g.player.grounded);
});

test('pickup: XZ <= pickup_radius and height diff <= 1.5 m, capped by capacity 10 (P2: no points on pickup)', () => {
  let g = game({ motes: [[0, 0, T.pickup_radius]] });
  const ev = g.step(inp());
  assert.deepEqual(ev.map((e) => [e.tick, e.name, e.data]), [[1, 'mote_picked', { carried: 1 }]]);
  assert.equal(g.score, 0);

  g = game({ motes: [[0, 0, T.pickup_radius + 0.01]] });
  assert.equal(g.step(inp()).length, 0);
  g = game({ motes: [[0, 1.6, 0]] }); // too high above Mây's feet
  assert.equal(g.step(inp()).length, 0);
  g = game({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0.5]] });
  assert.equal(g.step(inp()).length, 0);
  assert.equal(T.carry_capacity, 10);
});

test('deposit: min(carried, missing) into nearest unlit lantern; +10 per mote, +100 when lit', () => {
  const g = game({ player: { carried: 6 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] });
  let ev = press(g, 'interact');
  assert.deepEqual(ev.map((e) => [e.name, e.data]), [['deposit', { lantern_id: 'L1', amount: 6, deposited: 6 }]]);
  assert.equal(g.score, 60);
  g.player.carried = 9;
  ev = press(g, 'interact');
  assert.deepEqual(names(ev), ['deposit', 'lantern_lit']);
  assert.equal(ev[0].data.amount, 4);
  assert.equal(g.player.carried, 5);
  assert.equal(g.score, 100 + 100);
  assert.equal(runFor(g, 5, inp({ interact: true })).length, 0, 'holding does not repeat');
});

test('deposit: interact_radius 2.0, nearest lantern, tie -> smaller id', () => {
  let g = game({ player: { carried: 2 }, lanterns: [{ id: 'L2', pos: [2.01, 0, 0] }] });
  assert.equal(press(g, 'interact').length, 0);
  g = game({ player: { carried: 2 }, lanterns: [{ id: 'L3', pos: [1.5, 0, 0] }, { id: 'L2', pos: [-1.5, 0, 0] }, { id: 'L4', pos: [0, 0, 1] }] });
  assert.equal(press(g, 'interact')[0].data.lantern_id, 'L4');
  g = game({ player: { carried: 2 }, lanterns: [{ id: 'L3', pos: [1.5, 0, 0] }, { id: 'L2', pos: [-1.5, 0, 0] }] });
  assert.equal(press(g, 'interact')[0].data.lantern_id, 'L2');
});

test('win: last lantern lit -> won at end of tick, time + flame bonus; preset lit gives no points', () => {
  const lanterns = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true }));
  lanterns.push({ id: 'L5', pos: [0, 0, 1], deposited: T.lantern_cost - 1 });
  const g = game({ player: { carried: 1 }, lanterns, time_left_s: 100 });
  assert.equal(g.score, 0);
  const ev = g.step(inp({ interact: true }));
  assert.deepEqual(names(ev), ['deposit', 'lantern_lit', 'game_over']);
  assert.deepEqual(ev[2].data, { result: 'won', reason: 'all_lit' });
  const left = Math.floor((100 * 60 - 1) / 60);
  assert.equal(g.score, 10 + 100 + left * 2 + 3 * 50);
  assert.equal(g.step(inp()).length, 0, 'no steps after game over');
});

test('shade hit: -1 flame, drop floor(carried/2) on the ground, 90-tick invulnerability, lose at 0 (P2: drops stay on ground)', () => {
  const g = game({ player: { carried: 5 }, shades: [{ id: 'S9', pos: [0.5, 0, 0] }] });
  let ev = g.step(inp());
  assert.deepEqual(ev[0], { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 2, dropped: 2 } });
  assert.equal(g.motes.filter((m) => m.kind === 'dropped').length, 2);
  g.shades[0].pos = [0.5, 0, 0]; g.shades[0].state = 'chase'; g.shades[0].ticks = 0; // keep it touching
  ev = runFor(g, 89, inp());
  assert.ok(!names(ev).includes('player_hit'), 'no hit during invulnerability');
});

test('lose at 0 flames: no_flames', () => {
  const g = game({ player: { flames: 1 }, shades: [{ pos: [0.5, 0, 0] }] });
  const ev = g.step(inp());
  assert.deepEqual(names(ev), ['player_hit', 'game_over']);
  assert.deepEqual(ev[1].data, { result: 'lost', reason: 'no_flames' });
});

test('shade chases at shade_speed 4.0 m/s', () => {
  const g = game({ shades: [{ pos: [10, 1, 0] }] });
  runFor(g, 60);
  near(g.shades[0].pos[0], 10 - T.shade_speed);
  assert.equal(g.shades[0].id, 'S1');
});

test('pulse: costs 3, 3D radius 5 from feet+0.8, stun 120 ticks, push 4 m over 15 ticks, +5 each, cooldown 3 s', () => {
  const g = game({ player: { carried: 5 }, shades: [{ id: 'A', pos: [3, 0.8, 0] }, { id: 'B', pos: [0, 6, 3] }] });
  const ev = g.step(inp({ pulse: true }));
  assert.deepEqual(ev.find((e) => e.name === 'pulse').data, { stunned_ids: ['A'] });
  assert.equal(g.player.carried, 2);
  assert.equal(g.score, 5);
  near(g.shades[0].pos[0], 3 + 4 / 15);
  runFor(g, 14);
  near(g.shades[0].pos[0], 7);
  runFor(g, 10);
  near(g.shades[0].pos[0], 7, 1e-9); // push over, still stunned
  assert.equal(g.snapshot().shades[0].state, 'stunned');
  g.player.carried = 5;
  const cd = Math.round(T.pulse_cooldown_s * 60);
  runFor(g, cd - 27);
  assert.equal(press(g, 'pulse').filter((e) => e.name === 'pulse').length, 0, 'still on cooldown');
  assert.equal(press(g, 'pulse').filter((e) => e.name === 'pulse').length, 1);
});

test('pulse needs 3 motes; 2 is not enough', () => {
  const g = game({ player: { carried: 2 }, shades: [{ pos: [3, 0.8, 0] }] });
  assert.ok(!names(g.step(inp({ pulse: true }))).includes('pulse'));
  assert.equal(g.player.carried, 2);
});

test('stunned shade does not chase or hit for 120 ticks, then acts again', () => {
  const g = game({ player: { carried: 3 }, shades: [{ pos: [0.5, 0.8, 0] }] });
  const ev = g.step(inp({ pulse: true })); // pulse (step 7) happens before contacts (step 9)
  assert.ok(!names(ev).includes('player_hit'));
  runFor(g, 14); // push finishes at tick 15
  const x = g.shades[0].pos[0];
  runFor(g, 105); // tick 120: last stunned tick
  assert.equal(g.shades[0].pos[0], x);
  assert.equal(g.snapshot().shades[0].state, 'stunned');
  g.step(inp());
  assert.equal(g.snapshot().shades[0].state, 'chase');
  assert.ok(g.shades[0].pos[0] < x);
});

test('lit lantern keeps shades at >= 6 m', () => {
  const g = game({ player: { pos: [0, 0, 20] }, lanterns: [{ id: 'L1', pos: [0, 0, 20], lit: true }], shades: [{ pos: [10, 1, 20] }] });
  let minD = Infinity;
  for (let i = 0; i < 600; i++) {
    assert.ok(!names(g.step(inp())).includes('player_hit'));
    minD = Math.min(minD, Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2] - 20));
  }
  near(minD, T.safe_radius, 1e-6);
});

test('unlit lantern gives no protection (A6)', () => {
  const g = game({ player: { pos: [0, 0, 20] }, lanterns: [{ id: 'L1', pos: [0, 0, 20] }], shades: [{ pos: [4, 1, 20] }] });
  assert.ok(names(runFor(g, 120)).includes('player_hit'));
});

test('dawn: time runs out -> lost/dawn; time_left_s = duration - sim_ticks/60', () => {
  const g = game({ time_left_s: 1 });
  assert.equal(g.snapshot().time_left_s, 1);
  runFor(g, 30);
  assert.equal(g.snapshot().time_left_s, 0.5);
  const ev = runFor(g, 30);
  assert.equal(g.tick, 60);
  assert.deepEqual(ev.at(-1).data, { result: 'lost', reason: 'dawn' });
});

test('default night 1 map: standard lanterns, start, 300 s, 20 motes on distinct spawn points', () => {
  const g = new Game({ seed: 1 });
  const s = g.snapshot();
  assert.deepEqual(s.lanterns.map((l) => [l.id, l.pos]), [
    ['L1', [0, 0, 25]], ['L2', [23.8, 0, 7.7]], ['L3', [14.7, 0, -20.2]], ['L4', [-14.7, 0, -20.2]], ['L5', [-23.8, 0, 7.7]]]);
  assert.deepEqual(s.player.pos, [0, 0, 0]);
  assert.equal(s.time_left_s, 300);
  assert.equal(s.motes.length, 20);
  assert.equal(new Set(s.motes.map((m) => m.pos.join())).size, 20);
  assert.ok(s.motes.every((m) => m.kind === 'random' && m.ttl_s === null));
});
