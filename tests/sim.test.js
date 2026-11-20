// Rule-level acceptance tests (Phase 1). Each test names the requirement it proves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/sim.js';
import { TUNING as T, WORLD as W } from '../src/core/tuning.js';

const quiet = (extra = {}) => ({ random_motes: false, random_shades: false, motes: [], shades: [], ...extra });
const inp = (o = {}) => ({ move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, ...o });
const runFor = (g, n, input = inp()) => { const evs = []; for (let i = 0; i < n; i++) evs.push(...g.step(input)); return evs; };
const press = (g, key) => [...g.step(inp({ [key]: true })), ...g.step(inp())];
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('movement: speed, camera yaw rotation, normalization', () => {
  let g = new Game({ scenario: quiet() });
  runFor(g, 60, inp({ move: [0, 1] }));
  near(g.player.pos[2], T.player_speed); near(g.player.pos[0], 0);

  g = new Game({ scenario: quiet() });
  runFor(g, 60, inp({ move: [0, 1], cam_yaw_deg: 90 })); // x' = z*sin(90) = +X
  near(g.player.pos[0], T.player_speed, 1e-9); near(g.player.pos[2], 0, 1e-9);

  g = new Game({ scenario: quiet() });
  runFor(g, 60, inp({ move: [1, 1] })); // diagonal is normalized
  near(Math.hypot(g.player.pos[0], g.player.pos[2]), T.player_speed);
});

test('island edge clamps the player (fall_enabled=false)', () => {
  const g = new Game({ scenario: quiet() });
  runFor(g, 60 * 20, inp({ move: [0, 1] }));
  assert.ok(Math.hypot(g.player.pos[0], g.player.pos[2]) <= W.island_radius + 1e-9);
  assert.equal(g.player.flames, T.flames);
});

test('jump leaves the ground and lands back at y=0', () => {
  const g = new Game({ scenario: quiet() });
  g.step(inp({ jump: true }));
  runFor(g, 10, inp({ jump: true })); // holding does not re-trigger
  assert.ok(g.player.pos[1] > 0);
  runFor(g, 120);
  assert.equal(g.player.pos[1], 0);
});

test('pickup: within pickup_radius (<=) is collected, scored, capped by carry_capacity', () => {
  let g = new Game({ scenario: quiet({ motes: [[0, 0, T.pickup_radius]] }) });
  const ev = g.step(inp());
  assert.deepEqual(ev.map((e) => e.name), ['mote_picked']);
  assert.equal(ev[0].tick, 1);
  assert.deepEqual(ev[0].data, { carried: 1 });
  assert.equal(g.score, T.score.per_mote);

  g = new Game({ scenario: quiet({ motes: [[0, 0, T.pickup_radius + 0.01]] }) });
  assert.equal(g.step(inp()).length, 0);

  g = new Game({ scenario: quiet({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0.5]] }) });
  assert.equal(g.step(inp()).length, 0);
  assert.equal(g.motes.length, 1);
});

test('deposit: interact near unlit lantern moves light; full lantern lights and scores', () => {
  const g = new Game({ scenario: quiet({ player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] }) });
  let ev = press(g, 'interact');
  assert.deepEqual(ev.map((e) => [e.name, e.data]), [['deposit', { lantern_id: 'L1', amount: 3, deposited: 3 }]]);
  assert.equal(g.player.carried, 0);

  g.player.carried = 5;
  ev = press(g, 'interact');
  assert.deepEqual(ev.map((e) => e.name), ['deposit', 'lantern_lit']);
  assert.equal(ev[0].data.amount, T.lantern_cost - 3);
  assert.equal(g.player.carried, 5 - (T.lantern_cost - 3));
  assert.equal(g.score, T.score.per_lantern);
  // holding interact does not deposit again; out of range does nothing
  assert.equal(runFor(g, 5, inp({ interact: true })).length, 0);
});

test('deposit needs interact_radius (<=)', () => {
  const g = new Game({ scenario: quiet({ player: { carried: 2 }, lanterns: [{ id: 'L2', pos: [T.interact_radius + 0.01, 0, 0] }] }) });
  assert.equal(press(g, 'interact').length, 0);
});

test('win: lighting the last lantern ends the game with time and flame bonus; preset lit gives no points', () => {
  const lanterns = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true }));
  lanterns.push({ id: 'L5', pos: [0, 0, 1], deposited: T.lantern_cost - 1 });
  const g = new Game({ scenario: quiet({ player: { carried: 1 }, lanterns, time_left_s: 100 }) });
  assert.equal(g.score, 0);
  const ev = g.step(inp({ interact: true }));
  assert.deepEqual(ev.map((e) => e.name), ['deposit', 'lantern_lit', 'game_over']);
  assert.deepEqual(ev[2].data, { result: 'won', reason: 'all_lit' });
  assert.equal(g.state, 'won');
  const left = Math.floor((100 * 60 - 1) / 60); // 99 whole seconds
  assert.equal(g.score, T.score.per_lantern + left * T.score.per_second_left + T.flames * T.score.per_flame_left);
  assert.equal(g.step(inp()).length, 0, 'no steps after game over');
});

test('shade hit: lose a flame, drop light, invulnerability window, lose at 0 flames', () => {
  const g = new Game({ scenario: quiet({ player: { carried: 4 }, shades: [{ id: 'S9', pos: [0.5, 0, 0] }] }) });
  let ev = g.step(inp());
  assert.deepEqual(ev[0], { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: T.flames - 1, dropped: Math.floor(4 * T.hit_drop_ratio) } });
  const invulnTicks = Math.round(T.invuln_s * 60);
  ev = runFor(g, invulnTicks - 1);
  assert.equal(ev.length, 0, 'no hit during invulnerability');
  ev = g.step(inp());
  assert.equal(ev[0].name, 'player_hit');
  assert.equal(ev[0].tick, 1 + invulnTicks);
  ev = runFor(g, invulnTicks);
  assert.deepEqual(ev.map((e) => e.name), ['player_hit', 'game_over']);
  assert.deepEqual(ev[1].data, { result: 'lost', reason: 'no_flames' });
});

test('shade chases at shade_speed', () => {
  const g = new Game({ scenario: quiet({ shades: [{ pos: [20, 0, 0] }] }) });
  runFor(g, 60);
  near(g.shades[0].pos[0], 20 - T.shade_speed);
  assert.equal(g.shades[0].id, 'S1');
});

test('pulse: costs light, stuns + pushes shades in radius, cooldown, scored per stun', () => {
  const g = new Game({ scenario: quiet({ player: { carried: 3 }, shades: [{ id: 'A', pos: [3, 0, 0] }, { id: 'B', pos: [T.pulse_radius + 1, 0, 0] }] }) });
  const ev = g.step(inp({ pulse: true }));
  const pulse = ev.find((e) => e.name === 'pulse');
  assert.deepEqual(pulse.data, { stunned_ids: ['A'] });
  assert.equal(g.player.carried, 3 - T.pulse_cost);
  assert.equal(g.score, T.score.per_stun);
  // pulse runs before shade movement in a step, so A is pushed from 3 to 3 + pulse_push_m
  near(g.shades[0].pos[0], 3 + T.pulse_push_m);
  assert.equal(g.snapshot().shades[0].state, 'stunned');

  // cooldown: pressing again before pulse_cooldown_s does nothing
  g.step(inp());
  const cd = Math.round(T.pulse_cooldown_s * 60);
  runFor(g, cd - 3);
  assert.equal(press(g, 'pulse').filter((e) => e.name === 'pulse').length, 0);
  assert.equal(press(g, 'pulse').filter((e) => e.name === 'pulse').length, 1);
});

test('pulse needs pulse_cost light', () => {
  const g = new Game({ scenario: quiet({ player: { carried: 0 }, shades: [{ pos: [3, 0, 0] }] }) });
  assert.equal(g.step(inp({ pulse: true })).filter((e) => e.name === 'pulse').length, 0);
});

test('stunned shade does not move or hit for pulse_stun_s, then chases again', () => {
  const g = new Game({ scenario: quiet({ player: { carried: 1 }, shades: [{ pos: [0.5, 0, 0] }], }) });
  // pulse happens before the hit check, so the shade is stunned before it can hit
  const ev = g.step(inp({ pulse: true }));
  assert.ok(!ev.some((e) => e.name === 'player_hit'));
  const x = g.shades[0].pos[0];
  runFor(g, Math.round(T.pulse_stun_s * 60) - 1);
  assert.equal(g.shades[0].pos[0], x);
  assert.equal(g.snapshot().shades[0].state, 'stunned');
  g.step(inp());
  assert.equal(g.snapshot().shades[0].state, 'chase');
  assert.ok(g.shades[0].pos[0] < x);
});

test('lit lantern keeps shades outside safe_radius', () => {
  const g = new Game({ scenario: quiet({ player: { pos: [0, 0, 20] }, lanterns: [{ id: 'L1', pos: [0, 0, 20], lit: true }], shades: [{ pos: [15, 0, 20] }] }) });
  let minD = Infinity;
  for (let i = 0; i < 600; i++) {
    const ev = g.step(inp());
    assert.ok(!ev.some((e) => e.name === 'player_hit'));
    minD = Math.min(minD, Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2] - 20));
  }
  assert.ok(minD >= T.safe_radius - 1e-9, `shade got to ${minD}`);
});

test('unlit lantern gives no protection (assumption A6)', () => {
  const g = new Game({ scenario: quiet({ player: { pos: [0, 0, 20] }, lanterns: [{ id: 'L1', pos: [0, 0, 20] }], shades: [{ pos: [4, 0, 20] }] }) });
  assert.ok(runFor(g, 120).some((e) => e.name === 'player_hit'));
});

test('dawn: time runs out -> lost/dawn; time_left_s = duration - steps/60', () => {
  const g = new Game({ scenario: quiet({ time_left_s: 1 }) });
  assert.equal(g.snapshot().time_left_s, 1);
  runFor(g, 30);
  assert.equal(g.snapshot().time_left_s, 0.5);
  const ev = runFor(g, 30);
  assert.equal(g.tick, 60);
  assert.deepEqual(ev.at(-1).data, { result: 'lost', reason: 'dawn' });
});

test('random spawning: off means none; on spawns shades with fresh ids and refills motes', () => {
  let g = new Game({ seed: 3, scenario: quiet() });
  runFor(g, 60 * 60);
  assert.equal(g.shades.length, 0); assert.equal(g.motes.length, 0);

  g = new Game({ seed: 3, scenario: { shades: [{ id: 'S1', pos: [30, 0, 0] }], player: { pos: [0, 0, -39] } } });
  assert.equal(g.motes.length, W.motes_initial);
  const ev = runFor(g, Math.round(W.shade_first_spawn_s * 60));
  assert.deepEqual(ev.filter((e) => e.name === 'shade_spawned').map((e) => e.data.id), ['S2']);
});

test('default level: 5 lanterns L1..L5, player at origin', () => {
  const s = new Game({ seed: 1 }).snapshot();
  assert.deepEqual(s.lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.deepEqual(s.player.pos, [0, 0, 0]);
  assert.equal(s.lanterns.length, T.lantern_count_night1);
  assert.equal(s.player.flames, T.flames);
});
