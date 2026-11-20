// Phase 2 proof: runs tests/scenarios/* through the real headless_cmd from game.contract.json,
// checks each expectation, writes raw outputs + RESULTS.md to docs/proof/phase-2/.
// Usage: npm run proof   (exit 1 if any check fails). Outputs are generated, never hand-edited.
// (Phase 1 evidence in docs/proof/phase-1/ belongs to tag phase-1 and its v1.0 numbers.)
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
const T = contract.tuning;
const PHASE = 'phase-2';
const outRel = join('docs', 'proof', PHASE);
mkdirSync(join(root, outRel, 'runs'), { recursive: true });
const sc = (f) => join('tests', 'scenarios', f);

function run(name, { seed = 1, night = 1, scenario, inputs, ticks, every = 10 }) {
  const out = join(outRel, 'runs', `${name}.jsonl`);
  const [cmd, ...pre] = contract.headless_cmd.split(' ');
  const args = [...pre, '--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every)];
  if (scenario) args.push('--scenario', sc(scenario));
  if (inputs) args.push('--inputs', sc(inputs));
  const t0 = process.hrtime.bigint();
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  let raw = '';
  try { raw = readFileSync(join(root, out), 'utf8'); } catch { /* none */ }
  const lines = raw ? raw.trim().split('\n').map((l) => JSON.parse(l)) : [];
  return {
    code: r.status, stderr: r.stderr.trim(), lines, out, ms, cmd: [cmd, ...args].join(' ').replace(/\\/g, '/'),
    sha: createHash('sha256').update(raw).digest('hex').slice(0, 16),
    events: lines.filter((l) => l.type === 'event' && l.name !== 'night_start'),
    snaps: lines.filter((l) => l.type === 'snapshot'),
    end: lines.at(-1),
  };
}
const snapAt = (r, tick) => r.snaps.find((s) => s.tick === tick);
const ev = (r, name) => r.events.filter((e) => e.name === name);

const checks = [];
function check(req, how, r, fn) {
  let ok = false, note = '';
  try { note = fn(r) || ''; ok = true; } catch (e) { note = e.message; }
  checks.push({ req, how, ok, note, out: r.out, cmd: r.cmd });
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

// ---- Phase 1 behaviour with standard numbers (regression) ----
check('P1 regression: pickup 10, deposit, light, win all_lit, score per deposit', 'N1: 4 lanterns preset lit, walk over 10 motes, interact at L5',
  run('win_all_lit', { scenario: 'win_all_lit.scenario.json', inputs: 'win_all_lit.inputs.json', ticks: 600 }), (r) => {
    expect(ev(r, 'mote_picked').length === 10, `picked ${ev(r, 'mote_picked').length}`);
    const go = ev(r, 'game_over')[0];
    expect(go?.data.result === 'won' && go.data.reason === 'all_lit', 'no win');
    const left = Math.floor((300 * 60 - go.tick) / 60);
    const want = 10 * T.score.per_mote + T.score.per_lantern + left * T.score.per_second_left + T.flames * T.score.per_flame_left;
    expect(r.end.score === want, `score ${r.end.score} != ${want}`);
    return `won at tick ${go.tick}; score ${r.end.score} = 10x10 + 100 + ${left}s x2 + 3x50`;
  });
check('P1 regression: shade hit, drop floor(n/2), 90-tick invuln, lose no_flames', 'N1: 2 shades 3 m away, carried 4, stand still',
  run('lose_no_flames', { scenario: 'lose_no_flames.scenario.json', ticks: 3000 }), (r) => {
    const hits = ev(r, 'player_hit');
    expect(hits.length === 3 && hits[0].data.dropped === 2, JSON.stringify(hits.map((h) => h.data)));
    for (let i = 1; i < hits.length; i++) expect(hits[i].tick - hits[i - 1].tick >= 90, 'invuln gap');
    expect(r.end.state === 'lost' && ev(r, 'game_over')[0].data.reason === 'no_flames', 'not no_flames');
    return `hits at ${hits.map((h) => h.tick).join(', ')}; first dropped 2 (kind dropped on ground)`;
  });
check('P1 regression: dawn after night timer', 'N1: time_left_s 2', run('lose_dawn', { scenario: 'lose_dawn.scenario.json', ticks: 1000, every: 60 }), (r) => {
  expect(r.end.ticks === 120 && ev(r, 'game_over')[0].data.reason === 'dawn', JSON.stringify(r.end));
  return 'lost/dawn at tick 120';
});
check('Pulse: cost 3, 3D radius 5, stun 120 ticks, push 4 m in 15 ticks, +5', 'N1: S1 4 m away, FAR 11 m; pulse at tick 1',
  run('pulse_stun', { scenario: 'pulse_stun.scenario.json', inputs: 'pulse_stun.inputs.json', ticks: 130, every: 15 }), (r) => {
    const p = ev(r, 'pulse')[0];
    expect(p?.tick === 1 && JSON.stringify(p.data.stunned_ids) === '["S1"]', JSON.stringify(p));
    const s15 = snapAt(r, 15), s120 = snapAt(r, 120);
    const s1 = (s) => s.shades.find((x) => x.id === 'S1');
    expect(s15.player.carried === 1 && Math.abs(s1(s15).pos[0] - 8) < 1e-3, `S1 at ${s1(s15).pos}`);
    expect(s1(s120).state === 'stunned' && r.end.score === 5, 'stun/score');
    return `S1 pushed 4 -> ${s1(s15).pos[0]} by tick 15, stunned through tick 120; carried 4 -> 1; score 5`;
  });
check('Safe zone 6 m around lit lanterns', 'N1: player at lit L1, 2 shades chase 20 s',
  run('safe_zone', { scenario: 'safe_zone.scenario.json', ticks: 1200 }), (r) => {
    let min = Infinity;
    for (const s of r.snaps) for (const sh of s.shades) min = Math.min(min, Math.hypot(sh.pos[0], sh.pos[2] - 20));
    expect(min >= T.safe_radius - 1e-3 && !ev(r, 'player_hit').length, `min ${min}`);
    return `closest shade ${min.toFixed(3)} m from L1, no hits`;
  });
check('Safe zone: shade inside when lantern lights is evicted within 30 ticks, harmless', 'N1: shade touching Mây while she lights L1',
  run('evict', { scenario: 'evict.scenario.json', inputs: 'evict.inputs.json', ticks: 31, every: 1 }), (r) => {
    expect(ev(r, 'lantern_lit').length === 1 && !ev(r, 'player_hit').length, 'hit or not lit');
    const s = snapAt(r, 30).shades[0], d = Math.hypot(s.pos[0], s.pos[2] - 25);
    expect(d >= T.safe_radius - 1e-3, `d ${d}`);
    expect(snapAt(r, 1).shades[0].state === 'recoil', snapAt(r, 1).shades[0].state);
    return `state recoil at tick 1, ${d.toFixed(3)} m from L1 at tick 30, no player_hit`;
  });

// ---- Ticket-02 features ----
check('Dash: 14 m/s x 0.2 s, cooldown 1.5 s from start', 'N1: dash at ticks 1, 21 (cooldown), 91',
  run('dash', { scenario: 'dash.scenario.json', inputs: 'dash.inputs.json', ticks: 100 }), (r) => {
    const d = ev(r, 'dash').map((e) => e.tick);
    expect(JSON.stringify(d) === '[1,91]', `dash ticks ${d}`);
    const x10 = snapAt(r, 10).player.pos[0];
    return `dash events at ${d.join(', ')}; x at tick 10 = ${x10} (dash 14/60 m per tick)`;
  });
check('Charm: pickup, 7.2 m/s, dash without cooldown', 'N2: walk into C1 at (35,0,0), dash at ticks 31 and 46',
  run('charm', { night: 2, scenario: 'charm.scenario.json', inputs: 'charm.inputs.json', ticks: 120 }), (r) => {
    const c = ev(r, 'charm_picked')[0];
    expect(c && c.data.charm_id === 'C1' && c.data.charm_ticks === 600, 'no charm');
    expect(snapAt(r, 20).player.vel[0] === 7.2, `vel ${snapAt(r, 20).player.vel}`);
    expect(JSON.stringify(ev(r, 'dash').map((e) => e.tick)) === '[31,46]', 'dash ticks');
    expect(snapAt(r, 60).charms[0].available === false, 'charm still visible');
    return `charm_picked at tick ${c.tick}; vel 7.2 at tick 20; dashes at 31 and 46 (15 ticks apart)`;
  });
check('Jump pad night 2: launch to island B, no fall', 'N2: start on pad (20,0,18)',
  run('pad_night2', { night: 2, scenario: 'pad_night2.scenario.json', ticks: 120 }), (r) => {
    const s = r.snaps.at(-1);
    expect(!ev(r, 'player_hit').length && s.player.grounded && Math.hypot(s.player.pos[0] - 70, s.player.pos[2]) <= 28, JSON.stringify(s.player));
    const land = r.snaps.find((x) => x.tick > 5 && x.player.grounded);
    return `landed by tick ${land.tick} at (${s.player.pos.join(', ')}) on island B`;
  });
check('Night 3 map: pad lands on tier 2 (Y=6)', 'N3: start on pad (0,3,13)',
  run('pad_night3', { night: 3, scenario: 'pad_night3.scenario.json', ticks: 90 }), (r) => {
    const s = r.snaps.at(-1).player;
    expect(s.pos[1] === 6 && s.grounded && Math.hypot(s.pos[0], s.pos[2]) <= 8, JSON.stringify(s));
    return `on tier 2 at (${s.pos.join(', ')})`;
  });
check('Fall: once, -1 flame, lose all motes, wait 60, respawn at start, invuln 90', 'N1: walk off the edge with 6 motes',
  run('fall', { scenario: 'fall.scenario.json', inputs: 'fall.inputs.json', ticks: 400, every: 1 }), (r) => {
    const h = ev(r, 'player_hit');
    expect(h.length === 1 && JSON.stringify(h[0].data) === '{"by":"fall","flames":2,"dropped":0,"lost":6}', JSON.stringify(h));
    const back = snapAt(r, h[0].tick + 60).player;
    expect(back.pos.join() === '0,0,0' && back.invuln, JSON.stringify(back));
    return `fell at tick ${h[0].tick}, respawned at (0,0,0) on tick ${h[0].tick + 60} with invuln`;
  });
check('Drifter: chase, steal 3, flee; pulse makes it drop the loot', 'N2: carried 8, drifter 12 m away; pulse at tick 96',
  run('drifter', { night: 2, scenario: 'drifter.scenario.json', inputs: 'drifter.inputs.json', ticks: 400 }), (r) => {
    const st = ev(r, 'drifter_steal')[0], dr = ev(r, 'drifter_drop')[0];
    expect(st && st.data.amount === 3 && st.data.carried === 5, JSON.stringify(st));
    expect(dr && dr.data.amount === 3, JSON.stringify(dr));
    const s = r.snaps.at(-1);
    expect(s.drifters[0].state === 'removed', s.drifters[0].state);
    return `steal at tick ${st.tick} (carried 8 -> 5), drop 3 at tick ${dr.tick}, removed later`;
  });
check('Pause: tick runs, sim_tick/time frozen, state paused', 'N1: pause at tick 31, resume at 151',
  run('pause', { inputs: 'pause.inputs.json', ticks: 200 }), (r) => {
    const s100 = snapAt(r, 100), s200 = snapAt(r, 200);
    expect(s100.state === 'paused' && s100.sim_tick === 30 && s100.time_left_s === 299.5, JSON.stringify(s100).slice(0, 120));
    expect(s200.sim_tick === 80, `sim ${s200.sim_tick}`);
    expect(JSON.stringify(r.events.map((e) => [e.tick, e.name]).filter(([, n]) => n === 'paused' || n === 'resumed')) === '[[31,"paused"],[151,"resumed"]]', 'events');
    return 'tick 100: paused, sim_tick 30, time 299.5; tick 200: sim_tick 80';
  });
const windRun = run('wind_night3', { night: 3, scenario: 'immortal.scenario.json', ticks: 2200, every: 60 });
check('Night 3 wind: 5 s gust every 30 s', 'N3 default, 2200 ticks', windRun, (r) => {
  expect(snapAt(r, 1740).wind.active === false && snapAt(r, 1800).wind.active === true && snapAt(r, 2100).wind.active === false, 'wind schedule');
  return `gust active at tick 1800, dir ${snapAt(r, 1800).wind.dir_deg}°, off by 2100`;
});
const sched = run('schedule_night1', { night: 1, scenario: 'immortal.scenario.json', ticks: 1300, every: 240 });
check('Spawns: 20 motes at start, +1 every 240; shades 2 at 300 then every 480', 'N1 default', sched, (r) => {
  const sp = ev(r, 'shade_spawned').map((e) => `${e.tick}:${e.data.id}`).join(' ');
  expect(sp === '300:S1 300:S2 780:S3 1260:S4', sp);
  expect(snapAt(r, 0).motes_active === 20 && snapAt(r, 0).motes.every((m) => m.kind === 'random'), 'initial motes');
  return `shade_spawned ${sp}; motes 20 at tick 0`;
});
for (const n of [1, 2, 3]) {
  const a = run(`det_n${n}_a`, { seed: 7, night: n, inputs: 'default_walk.inputs.json', ticks: 3600 });
  const b = run(`det_n${n}_b`, { seed: 7, night: n, inputs: 'default_walk.inputs.json', ticks: 3600 });
  const c = run(`det_n${n}_seed8`, { seed: 8, night: n, inputs: 'default_walk.inputs.json', ticks: 3600 });
  check(`Determinism night ${n}`, 'same seed+inputs twice, other seed once', a, () => {
    expect(a.sha === b.sha && a.sha !== c.sha, `${a.sha} ${b.sha} ${c.sha}`);
    return `sha ${a.sha} = ${b.sha}; seed 8 ${c.sha}`;
  });
}
const perf = run('perf_night3_full', { night: 3, scenario: 'immortal.scenario.json', ticks: 21600, every: 1 });
check('Full night (21600 ticks) <= 30 s', 'N3, snapshot every tick', perf, (r) => {
  expect(r.end.ticks === 21600 && r.ms <= 30000, `${r.end.ticks} ticks in ${r.ms} ms`);
  return `${r.end.ticks} ticks in ${Math.round(r.ms)} ms`;
});
check('Malformed scenario (bad shade state) -> exit 2', 'scenario state "angry"',
  run('malformed', { scenario: 'malformed.scenario.json', ticks: 10 }), (r) => {
    expect(r.code === 2 && r.stderr, `exit ${r.code}`);
    return `exit 2: "${r.stderr}"`;
  });

const pass = checks.filter((c) => c.ok).length;
// perf runs are large and timing-only: keep them out of git (see .gitignore)
writeFileSync(join(root, outRel, 'RESULTS.md'), [
  `# ${PHASE} proof — headless scenarios (Contract v${contract.contract_version})`, '',
  `Generated by \`npm run proof\` (scripts/proof.js). **${pass}/${checks.length} checks passed.**`,
  'Raw outputs are in `runs/` (except the large perf run); rerun to regenerate them byte-for-byte.', '',
  '| # | Requirement | How | Result | Evidence |', '|---|---|---|---|---|',
  ...checks.map((c, i) => `| ${i + 1} | ${c.req} | ${c.how} | ${c.ok ? 'PASS' : '**FAIL**'} | ${c.note.replace(/\|/g, '\\|')} — \`${c.out.split(/[\\/]/).pop()}\` |`),
  '', '## Commands', '', ...checks.map((c, i) => `${i + 1}. \`${c.cmd}\``), '',
].join('\n'));
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.req}\n      ${c.note}`);
console.log(`\n${pass}/${checks.length} passed -> ${outRel}/RESULTS.md`);
process.exit(pass === checks.length ? 0 : 1);
