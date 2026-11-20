// Ticket-02 features. One block per Part 1/3 item; names match docs/notes/phase-2-spec.md (AC-x).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/sim.js';
import { quiet, inp, game, runFor, press, near, names } from './helpers.js';

test('AC-dash: 14 m/s for 12 ticks in move/facing dir, cooldown 90 ticks from start, press while dashing ignored', () => {
  const g = game();
  let ev = g.step(inp({ dash: true }));
  assert.deepEqual(names(ev), ['dash']);
  runFor(g, 11, inp({ dash: false }));
  near(g.player.pos[2], 14 * 12 / 60); // idle -> facing +Z
  g.step(inp());
  near(g.player.pos[2], 2.8, 0.25); // decelerating, no more dash
  runFor(g, 76); // tick 89: still cooling down
  assert.ok(!names(press(g, 'dash')).includes('dash'));
  assert.ok(names(press(g, 'dash')).includes('dash')); // tick 91
  // direction follows the move input
  const h = game();
  h.step(inp({ move: [1, 0], dash: true }));
  assert.ok(h.player.vel[0] === 14 && h.player.vel[2] === 0);
});

test('AC-dash: air dash keeps altitude; no invulnerability while dashing', () => {
  const g = game();
  g.step(inp({ jump: true }));
  runFor(g, 9);
  const y = g.player.pos[1];
  g.step(inp({ dash: true }));
  runFor(g, 10);
  near(g.player.pos[1], y, 1e-9);
  const h = game({ shades: [{ pos: [0, 1, 1.5] }] });
  assert.ok(names(runFor(h, 3, inp({ move: [0, 1], dash: true }))).includes('player_hit'));
});

test('AC-charm: pickup -> 600 ticks, run 7.2 m/s, dash without cooldown, respawns after 2700 ticks', () => {
  const g = game({ charms: [{ id: 'C1', pos: [0, 0, 0.5] }] }, 2);
  let ev = g.step(inp());
  assert.deepEqual(ev.map((e) => [e.name, e.data]), [['charm_picked', { charm_id: 'C1', charm_ticks: 600 }]]);
  runFor(g, 10, inp({ move: [0, 1] }));
  near(g.player.vel[2], 7.2);
  ev = [...press(g, 'dash'), ...runFor(g, 12), ...press(g, 'dash')];
  assert.equal(names(ev).filter((n) => n === 'dash').length, 2);
  assert.equal(g.snapshot().player.dash_cd_s, 0);
  assert.equal(g.snapshot().charms[0].available, false);
  runFor(g, 2700 - 27); // picked at tick 1 -> back at tick 2701
  assert.equal(g.snapshot().charms[0].available, false);
  g.step(inp());
  assert.equal(g.snapshot().charms[0].available, true);
});

test('AC-charm: with no cooldown, pressing dash during a dash is still ignored', () => {
  const g = game({ player: { charm_ticks: 600 } }, 2);
  const ev = [...press(g, 'dash'), ...press(g, 'dash'), ...press(g, 'dash')]; // ticks 1, 3, 5: all inside the 12-tick dash
  assert.equal(names(ev).filter((n) => n === 'dash').length, 1);
});

test('AC-fall: falling ignores invulnerability', () => {
  const g = game({ player: { pos: [39.9, 0, 0], invuln_ticks: 500 } });
  assert.ok(runFor(g, 120, inp({ move: [1, 0] })).some((e) => e.name === 'player_hit' && e.data.by === 'fall'));
});

test('AC-charm: charm ends after 600 ticks; re-pick refreshes', () => {
  const g = game({ player: { charm_ticks: 5 } }, 2);
  runFor(g, 5);
  assert.equal(g.player.charm, 0);
  const h = game({ player: { charm_ticks: 100 }, charms: [{ id: 'C1', pos: [0, 0, 0.5] }] }, 2);
  h.step(inp());
  assert.equal(h.player.charm, 600);
});

test('AC-pad (night 2): launch vy 14 + 24 m/s toward the other island, lands on island B without falling', () => {
  const g = game({ player: { pos: [20, 0, 18] } }, 2);
  const ev = runFor(g, 120);
  assert.ok(!names(ev).includes('player_hit'), 'no fall');
  assert.ok(g.player.grounded);
  assert.ok(Math.hypot(g.player.pos[0] - 70, g.player.pos[2]) <= 28, `landed at ${g.player.pos}`);
  assert.equal(g.player.pos[1], 0);
});

test('AC-pad: movement keys do not override the launch, but dash works', () => {
  const g = game({ player: { pos: [20, 0, 18] } }, 2);
  g.step(inp());
  g.step(inp());
  const vx = g.player.vel[0];
  runFor(g, 5, inp({ move: [-1, 0] }));
  near(g.player.vel[0], vx);
  assert.ok(names(g.step(inp({ dash: true }))).includes('dash'));
});

test('AC-map3: tier walls block, ramp climbs to tier 1, pad lands on tier 2, stepping off drops a tier', () => {
  // walking +Z from tier 0 at r=10 toward the tier-1 inner wall? (z>0, r 12..24 is Y=3)
  let g = game({ player: { pos: [0, 0, -30] } }, 3);
  runFor(g, 200, inp({ move: [0, 1] })); // -> tier 2 wall at r=8 blocks
  assert.ok(g.player.pos[2] <= -8 + 1e-9 && g.player.pos[1] === 0);
  // ramp at 30°: from r=31 walk inward along the ramp
  const a = Math.PI / 6;
  g = game({ player: { pos: [31 * Math.cos(a), 0, 31 * Math.sin(a)] } }, 3);
  runFor(g, 90, inp({ move: [-Math.cos(a), -Math.sin(a)] }));
  assert.equal(g.player.pos[1], 3);
  assert.ok(g.player.grounded);
  // pad (0,3,13) -> tier 2
  g = game({ player: { pos: [0, 3, 13] } }, 3);
  const ev = runFor(g, 90);
  assert.ok(!names(ev).includes('player_hit'));
  assert.equal(g.player.pos[1], 6);
  assert.ok(Math.hypot(g.player.pos[0], g.player.pos[2]) <= 8);
  // walk off tier 1 outward -> lands on tier 0, no fall penalty
  g = game({ player: { pos: [0, 3, 20] } }, 3);
  assert.ok(!names(runFor(g, 120, inp({ move: [0, 1] }))).includes('player_hit'));
  assert.equal(g.player.pos[1], 0);
  // bell tower is solid
  g = game({ player: { pos: [0, 6, -6] } }, 3);
  runFor(g, 120, inp({ move: [0, 1] }));
  assert.ok(Math.hypot(g.player.pos[0], g.player.pos[2]) >= 2 - 1e-9);
});

test('AC-fall: Y < -10 -> once, -1 flame, lose all motes; 60-tick wait, respawn at start with 90 invuln', () => {
  const g = game({ player: { pos: [39, 0, 0], carried: 4 }, motes: [] });
  let ev = runFor(g, 120, inp({ move: [1, 0] }));
  const hit = ev.filter((e) => e.name === 'player_hit');
  assert.equal(hit.length, 1);
  assert.deepEqual(hit[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 4 });
  const fallTick = hit[0].tick;
  assert.equal(g.player.carried, 0);
  g.player.fallWait > 0 && runFor(g, g.player.fallWait - 1);
  assert.ok(g.player.fallWait === 1);
  g.step(inp());
  assert.deepEqual(g.player.pos, [0, 0, 0]);
  assert.equal(g.tick, fallTick + 60);
  assert.ok(g.snapshot().player.invuln);
  assert.equal(g.player.invuln, 90);
});

test('AC-fall: last flame lost by falling ends the game immediately (no respawn)', () => {
  const g = game({ player: { pos: [39.9, 0, 0], flames: 1 } });
  const ev = runFor(g, 200, inp({ move: [1, 0] }));
  assert.deepEqual(names(ev).slice(-2), ['player_hit', 'game_over']);
  assert.equal(g.state, 'lost');
});

test('AC-drifter: idle -> chase (>=5 carried, <=15 m) -> steal min(3) -> flee 240 ticks -> removed', () => {
  const g = game({ player: { carried: 6 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] }, 2);
  g.step(inp());
  assert.equal(g.drifters[0].state, 'chase');
  const ev = runFor(g, 120);
  const st = ev.find((e) => e.name === 'drifter_steal');
  assert.deepEqual(st.data, { drifter_id: 'D1', amount: 3, carried: 3 });
  assert.equal(g.drifters[0].state, 'flee');
  runFor(g, 240);
  assert.equal(g.drifters[0].state, 'removed');
  assert.equal(g.snapshot().drifters[0].stolen, 3);
});

test('AC-drifter: < 5 carried -> stays idle; invulnerability does not stop a steal; steal before shade hit', () => {
  let g = game({ player: { carried: 4 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] }, 2);
  runFor(g, 30);
  assert.equal(g.drifters[0].state, 'idle');
  g = game({ player: { carried: 4, invuln_ticks: 50 }, drifters: [{ id: 'D1', pos: [1, 1.5, 0] }] }, 2);
  assert.ok(names(g.step(inp())).includes('drifter_steal'));
  g = game({ player: { carried: 6 }, drifters: [{ id: 'D1', pos: [1, 1.5, 0] }], shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }, 2);
  const ev = g.step(inp());
  assert.deepEqual(names(ev), ['drifter_steal', 'player_hit']);
  assert.equal(ev[1].data.dropped, Math.floor(3 / 2));
});

test('AC-drifter: pulse on chase -> flee without stealing; pulse on loaded flee -> drop all, removed after 120', () => {
  let g = game({ player: { carried: 8 }, drifters: [{ id: 'D1', pos: [4, 1.5, 0], state: 'chase' }] }, 2);
  g.step(inp({ pulse: true }));
  assert.equal(g.drifters[0].state, 'flee');
  assert.ok(!names(runFor(g, 60)).includes('drifter_steal'));
  g = game({ player: { carried: 3 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'flee', stolen: 3 }] }, 2);
  const ev = g.step(inp({ pulse: true }));
  assert.deepEqual(ev.find((e) => e.name === 'drifter_drop').data, { drifter_id: 'D1', amount: 3 });
  assert.equal(g.motes.filter((m) => m.kind === 'dropped').length, 3);
  runFor(g, 119);
  assert.equal(g.drifters[0].state, 'flee');
  g.step(inp());
  assert.equal(g.drifters[0].state, 'removed');
});

test('AC-drifter spawn: night 2/3 only, ticks 1200, 2400, max 2 active, ids D1, D2', () => {
  const sc = { random_motes: false, random_shades: false };
  let g = new Game({ seed: 4, night: 2, scenario: sc });
  runFor(g, 1199);
  assert.equal(g.drifters.length, 0);
  g.step(inp());
  assert.deepEqual(g.drifters.map((d) => d.id), ['D1']);
  runFor(g, 1200 * 3);
  assert.ok(g.drifters.filter((d) => d.state !== 'removed').length <= 2);
  g = new Game({ seed: 4, night: 1, scenario: sc });
  runFor(g, 2400);
  assert.equal(g.drifters.length, 0);
});

test('AC-pause: tick advances, sim_tick/time/cooldowns frozen, state paused, events paused/resumed', () => {
  const g = game({ player: { pulse_cd_ticks: 100 } });
  runFor(g, 10);
  let ev = g.step(inp({ pause: true }));
  assert.deepEqual(names(ev), ['paused']);
  const s1 = g.snapshot();
  runFor(g, 50, inp({ pause: true, move: [0, 1] }));
  const s2 = g.snapshot();
  assert.equal(s2.state, 'paused');
  assert.equal(s2.tick, s1.tick + 50);
  assert.equal(s2.sim_tick, s1.sim_tick);
  assert.equal(s2.time_left_s, s1.time_left_s);
  assert.equal(s2.player.pulse_cd_s, s1.player.pulse_cd_s);
  assert.deepEqual(s2.player.pos, s1.player.pos);
  g.step(inp());
  ev = g.step(inp({ pause: true }));
  assert.deepEqual(names(ev), ['resumed']);
  assert.equal(g.snapshot().sim_tick, s1.sim_tick + 1);
});

test('AC-motes: 20 at start on distinct points; +1 at sim ticks 240, 480.. until cap 30 or no free point', () => {
  const g = new Game({ seed: 2, night: 3, scenario: { random_shades: false, random_drifters: false, wind_enabled: false } });
  assert.equal(g.motes.length, 20);
  runFor(g, 239);
  assert.equal(g.motes.length, 20);
  g.step(inp());
  assert.equal(g.motes.length, 21);
  runFor(g, 240 * 20);
  assert.equal(g.motes.length, 30);
  const n1 = new Game({ seed: 2, night: 1, scenario: { random_shades: false } });
  runFor(n1, 240 * 10);
  assert.equal(n1.motes.length, 24, 'night 1 has only 24 spawn points');
});

test('AC-shade spawn: 2 at tick 300, then +1 every 8/7/6 s, >= 15 m away, state spawning, ids S1.., max per night', () => {
  for (const [night, every, max] of [[1, 480, 6], [2, 420, 8], [3, 360, 10]]) {
    const g = new Game({ seed: 3, night, scenario: { random_motes: false, random_drifters: false, wind_enabled: false } });
    let ev = runFor(g, 299);
    assert.equal(names(ev).filter((n) => n === 'shade_spawned').length, 0);
    ev = g.step(inp());
    assert.deepEqual(ev.filter((e) => e.name === 'shade_spawned').map((e) => e.data.id), ['S1', 'S2']);
    assert.ok(g.shades.every((s) => s.state === 'spawning' && Math.hypot(s.pos[0] - g.player.pos[0], s.pos[2] - g.player.pos[2]) >= 15));
    ev = runFor(g, every);
    assert.deepEqual(ev.filter((e) => e.name === 'shade_spawned').map((e) => [e.tick, e.data.id]), [[300 + every, 'S3']]);
    runFor(g, every * max);
    assert.ok(g.shades.length <= max, `night ${night}: ${g.shades.length} > ${max}`);
  }
});

test('AC-shade states: wander far, chase within 12, give up beyond 18, recoil 2 m over 60 ticks after a hit', () => {
  let g = game({ shades: [{ id: 'S1', pos: [13, 1, 0] }] });
  g.step(inp());
  assert.equal(g.shades[0].state, 'wander');
  g = game({ shades: [{ id: 'S1', pos: [11.9, 1, 0] }] });
  g.step(inp());
  assert.equal(g.shades[0].state, 'chase');
  g = game({ shades: [{ id: 'S1', pos: [17, 1, 0], state: 'chase' }] });
  runFor(g, 120, inp({ move: [-1, 0] })); // player runs away faster than the shade
  assert.equal(g.shades[0].state, 'wander');
  g = game({ shades: [{ id: 'S1', pos: [0.5, 1, 0] }] });
  g.step(inp());
  assert.equal(g.shades[0].state, 'recoil');
  runFor(g, 59);
  near(g.shades[0].pos[0], 0.5 - 4 / 60 + 2, 1e-9); // it stepped in before hitting
  g.step(inp());
  assert.notEqual(g.shades[0].state, 'recoil');
});

test('AC-hit: at most one flame per tick; lower id hits first and recoils', () => {
  const g = game({ player: { carried: 0 }, shades: [{ id: 'S10', pos: [0.4, 1, 0] }, { id: 'S2', pos: [-0.4, 1, 0] }] });
  const ev = g.step(inp());
  assert.equal(names(ev).filter((n) => n === 'player_hit').length, 1);
  assert.equal(g.shades.find((s) => s.id === 'S2').state, 'recoil');
  assert.equal(g.shades.find((s) => s.id === 'S10').state, 'chase');
});

test('AC-drops: ring 1.5-2.5 m, kind dropped, ttl 480 ticks, pick-up from the next tick', () => {
  const g = game({ player: { carried: 10 }, shades: [{ pos: [0.5, 1, 0] }] });
  g.step(inp());
  const drops = g.snapshot().motes.filter((m) => m.kind === 'dropped');
  assert.equal(drops.length, 5);
  for (const m of drops) { const r = Math.hypot(m.pos[0], m.pos[2]); assert.ok(r >= 1.5 - 1e-3 && r <= 2.5 + 1e-3, String(r)); }
  assert.equal(drops[0].ttl_s, 8);
  g.shades = [];
  runFor(g, 479); // dropped at tick 1 -> alive through tick 480
  assert.equal(g.motes.length, 5);
  g.step(inp());
  assert.equal(g.motes.length, 0);
});

test('AC-safe: shade inside a lantern when it lights is pushed to 6 m within 30 ticks, harmless meanwhile', () => {
  const g = game({ player: { carried: 1, pos: [0, 0, 24] }, lanterns: [{ id: 'L1', deposited: 9 }], shades: [{ id: 'S1', pos: [0, 1, 26] }] });
  const ev = g.step(inp({ interact: true }));
  assert.ok(names(ev).includes('lantern_lit'));
  assert.equal(g.shades[0].state, 'recoil');
  const evs = runFor(g, 29);
  assert.ok(!names([...ev, ...evs]).includes('player_hit'));
  near(Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2] - 25), 6, 1e-6);
});

test('AC-wind (night 3): every 30 s a 5 s gust pushes 2 m/s; snapshot wind', () => {
  const g = new Game({ seed: 9, night: 3, scenario: { random_motes: false, random_shades: false, random_drifters: false } });
  runFor(g, 1799);
  assert.equal(g.snapshot().wind.active, false);
  const p0 = g.player.pos.slice();
  g.step(inp());
  const s = g.snapshot();
  assert.equal(s.wind.active, true);
  const a = (s.wind.dir_deg * Math.PI) / 180;
  near(g.player.pos[0] - p0[0], (Math.cos(a) * 2) / 60, 1e-9);
  runFor(g, 299);
  assert.equal(g.snapshot().wind.active, true);
  g.step(inp());
  assert.equal(g.snapshot().wind.active, false);
  const n1 = new Game({ seed: 9, night: 1, scenario: { random_motes: false, random_shades: false } });
  runFor(n1, 1800);
  assert.equal(n1.snapshot().wind.active, false);
});

test('AC-end: all lit on the last tick still wins; lighting evicts a touching shade so it cannot hit', () => {
  const lanterns = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true }));
  lanterns.push({ id: 'L5', pos: [0, 0, 1], deposited: 9 });
  const g = game({ player: { carried: 1 }, lanterns, time_left_s: 1 });
  runFor(g, 59);
  const ev = g.step(inp({ interact: true }));
  assert.deepEqual(ev.at(-1).data, { result: 'won', reason: 'all_lit' });
  const h = game({ player: { carried: 1, flames: 1 }, lanterns, shades: [{ pos: [0.5, 1, 0.5] }] });
  assert.deepEqual(h.step(inp({ interact: true })).at(-1).data, { result: 'won', reason: 'all_lit' });
  const k = game({ player: { flames: 1 }, lanterns, shades: [{ pos: [0.5, 1, 0.5] }] });
  assert.deepEqual(k.step(inp()).at(-1).data, { result: 'lost', reason: 'no_flames' });
});

test('AC-nights: 6 lanterns on night 2, 7 on night 3, durations 330/360 s, flames full', () => {
  const n2 = new Game({ night: 2 }).snapshot(), n3 = new Game({ night: 3 }).snapshot();
  assert.equal(n2.lanterns.length, 6); assert.equal(n2.time_left_s, 330); assert.equal(n2.night, 2);
  assert.equal(n3.lanterns.length, 7); assert.equal(n3.time_left_s, 360);
  assert.deepEqual(n3.lanterns[0].pos, [0, 6, 6]);
  assert.equal(n3.player.flames, 3);
});

test('v1.1 snapshot shape', () => {
  const s = new Game({ night: 2 }).snapshot();
  for (const k of ['night', 'wind', 'motes', 'drifters', 'charms']) assert.ok(k in s, k);
  for (const k of ['pos', 'vel', 'grounded', 'invuln', 'flames', 'carried', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) assert.ok(k in s.player, k);
  assert.deepEqual(s.charms, [{ id: 'C1', available: true, respawn_s: 0 }]);
  assert.deepEqual(Object.keys(s.motes[0]), ['id', 'pos', 'kind', 'ttl_s']);
});
