// Runs the Phase 1 proof scenarios through the real headless_cmd from game.contract.json,
// checks each expectation, and writes raw outputs + RESULTS.md to docs/proof/phase-1/.
// Usage: npm run proof     (exit 1 if any check fails). Outputs are generated, never hand-edited.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
const T = contract.tuning;
const outDir = join(root, 'docs', 'proof', 'phase-1');
mkdirSync(join(outDir, 'runs'), { recursive: true });
const sc = (f) => join('tests', 'scenarios', f);

function run(name, { seed = 1, scenario, inputs, ticks, every = 10 }) {
  const out = join('docs', 'proof', 'phase-1', 'runs', `${name}.jsonl`);
  const [cmd, ...pre] = contract.headless_cmd.split(' ');
  const args = [...pre, '--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every)];
  if (scenario) args.push('--scenario', sc(scenario));
  if (inputs) args.push('--inputs', sc(inputs));
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  let raw = '';
  try { raw = readFileSync(join(root, out), 'utf8'); } catch { /* none */ }
  const lines = raw ? raw.trim().split('\n').map((l) => JSON.parse(l)) : [];
  return {
    code: r.status, stderr: r.stderr.trim(), lines, out, cmd: [cmd, ...args].join(' '),
    sha: createHash('sha256').update(raw).digest('hex').slice(0, 16),
    events: lines.filter((l) => l.type === 'event'),
    end: lines.at(-1),
  };
}

const checks = [];
function check(req, how, r, fn) {
  let ok = false, note = '';
  try { note = fn(r) || ''; ok = true; } catch (e) { note = e.message; }
  checks.push({ req, how, ok, note, out: r.out, cmd: r.cmd });
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const names = (r) => r.events.map((e) => e.name).join(', ');

// 1. Win: pick 5 motes, deposit, last lantern lit -> won/all_lit
const win = run('win_all_lit', { scenario: 'win_all_lit.scenario.json', inputs: 'win_all_lit.inputs.json', ticks: 600 });
check('Pickup, deposit, light lantern, win (all_lit), score', 'scenario: 4 lanterns preset lit, walk over 5 motes, interact at L5', win, (r) => {
  expect(r.code === 0, `exit ${r.code}`);
  expect(r.events.filter((e) => e.name === 'mote_picked').length === 5, `events: ${names(r)}`);
  const go = r.events.find((e) => e.name === 'game_over');
  expect(go && go.data.result === 'won' && go.data.reason === 'all_lit', 'no won/all_lit');
  const leftS = Math.floor((300 * 60 - go.tick) / 60);
  const want = 5 * T.score.per_mote + T.score.per_lantern + leftS * T.score.per_second_left + T.flames * T.score.per_flame_left;
  expect(r.end.state === 'won' && r.end.score === want, `end ${JSON.stringify(r.end)} want score ${want}`);
  return `won at tick ${go.tick}, score ${r.end.score} = 5x${T.score.per_mote} + ${T.score.per_lantern} + ${leftS}s x${T.score.per_second_left} + ${T.flames} flames x${T.score.per_flame_left}`;
});

// 2. Lose by shades
const lose = run('lose_no_flames', { scenario: 'lose_no_flames.scenario.json', ticks: 3000 });
check('Shade chase + hit, light dropped, invulnerability, lose (no_flames)', 'scenario: 2 shades 3 m away, player stands still', lose, (r) => {
  const hits = r.events.filter((e) => e.name === 'player_hit');
  expect(hits.length === T.flames, `hits ${hits.length}`);
  expect(hits[0].data.dropped === Math.floor(4 * T.hit_drop_ratio), 'dropped');
  for (let i = 1; i < hits.length; i++) expect(hits[i].tick - hits[i - 1].tick >= Math.round(T.invuln_s * 60), 'invuln gap');
  expect(r.end.state === 'lost' && r.events.at(-1).data.reason === 'no_flames', 'not lost/no_flames');
  return `hits at ticks ${hits.map((h) => h.tick).join(', ')} (gap >= ${Math.round(T.invuln_s * 60)}), first dropped ${hits[0].data.dropped}`;
});

// 3. Dawn
const dawn = run('lose_dawn', { scenario: 'lose_dawn.scenario.json', ticks: 1000, every: 60 });
check('Night timer, lose at dawn', 'scenario: time_left_s = 2', dawn, (r) => {
  expect(r.end.ticks === 120 && r.end.state === 'lost', JSON.stringify(r.end));
  expect(r.events.at(-1).data.reason === 'dawn', 'reason');
  expect(r.lines[1].time_left_s === 1, `time_left at tick 60 = ${r.lines[1].time_left_s}`);
  return 'game_over dawn at tick 120; time_left_s 2 -> 1 -> 0';
});

// 4. Pulse
const pulse = run('pulse_stun', { scenario: 'pulse_stun.scenario.json', inputs: 'pulse_stun.inputs.json', ticks: 240, every: 30 });
check('Pulse costs light, stuns + pushes shades in radius', 'scenario: S1 at 5 m, FAR at 30 m; pulse at tick 30', pulse, (r) => {
  const p = r.events.find((e) => e.name === 'pulse');
  expect(p && p.tick === 31 && JSON.stringify(p.data.stunned_ids) === '["S1"]', `pulse ${JSON.stringify(p)}`);
  const s = r.lines.find((l) => l.type === 'snapshot' && l.tick === 60);
  expect(s.player.carried === 2 - T.pulse_cost, 'carried');
  expect(s.shades.find((x) => x.id === 'S1').state === 'stunned', 'S1 not stunned');
  expect(s.shades.find((x) => x.id === 'FAR').state === 'chase', 'FAR should chase');
  expect(!r.events.some((e) => e.name === 'player_hit'), 'hit while stunned');
  return `pulse at tick 31 stunned [S1]; carried 2 -> ${s.player.carried}; score ${r.end.score}`;
});

// 5. Safe radius
const safe = run('safe_zone', { scenario: 'safe_zone.scenario.json', ticks: 1200, every: 10 });
check('Shades cannot enter safe_radius of a lit lantern', 'scenario: player at lit L1, 2 shades chase for 20 s', safe, (r) => {
  let min = Infinity;
  for (const s of r.lines.filter((l) => l.type === 'snapshot')) for (const sh of s.shades) min = Math.min(min, Math.hypot(sh.pos[0], sh.pos[2] - 20));
  expect(min >= T.safe_radius - 1e-3, `min dist ${min}`);
  expect(!r.events.some((e) => e.name === 'player_hit'), 'player hit inside safe zone');
  return `closest shade distance to L1 over 120 snapshots: ${min.toFixed(3)} m (safe_radius ${T.safe_radius})`;
});

// 6. Determinism on the default level with random spawns
const a = run('default_seed7_a', { seed: 7, inputs: 'default_walk.inputs.json', ticks: 3600 });
const b = run('default_seed7_b', { seed: 7, inputs: 'default_walk.inputs.json', ticks: 3600 });
const c = run('default_seed8', { seed: 8, inputs: 'default_walk.inputs.json', ticks: 3600 });
check('Determinism: same seed + inputs -> identical output (incl. spawned ids)', 'default level, random motes/shades, 3600 ticks, run twice', a, () => {
  expect(a.sha === b.sha, `${a.sha} != ${b.sha}`);
  expect(a.sha !== c.sha, 'seed has no effect');
  const spawned = a.events.filter((e) => e.name === 'shade_spawned').length;
  expect(spawned > 0, 'no random shades spawned');
  return `sha256 seed7 run A ${a.sha} = run B ${b.sha}; seed8 ${c.sha}; ${spawned} shades spawned`;
});

// 7. Malformed input
const bad = run('malformed', { inputs: 'malformed.inputs.json', ticks: 10 });
check('Malformed inputs -> exit code 2 + stderr', 'inputs with decreasing ticks', bad, (r) => {
  expect(r.code === 2, `exit ${r.code}`);
  expect(r.stderr.length > 0, 'no stderr');
  return `exit 2: "${r.stderr}"`;
});

const pass = checks.filter((c) => c.ok).length;
const md = [
  '# Phase 1 proof — headless scenarios',
  '',
  `Generated by \`npm run proof\` (scripts/proof.js). ${pass}/${checks.length} checks passed.`,
  'Raw outputs are in `runs/`; rerun the command to regenerate them byte-for-byte.',
  '',
  '| # | Requirement | How | Result | Evidence |',
  '|---|---|---|---|---|',
  ...checks.map((c, i) => `| ${i + 1} | ${c.req} | ${c.how} | ${c.ok ? 'PASS' : '**FAIL**'} | ${c.note.replace(/\|/g, '\\|')} — \`${c.out.split(/[\\/]/).pop()}\` |`),
  '',
  '## Commands',
  '',
  ...checks.map((c, i) => `${i + 1}. \`${c.cmd.replace(/\\/g, '/')}\``),
  '',
];
writeFileSync(join(outDir, 'RESULTS.md'), md.join('\n'));
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.req}\n      ${c.note}`);
console.log(`\n${pass}/${checks.length} passed -> docs/proof/phase-1/RESULTS.md`);
process.exit(pass === checks.length ? 0 : 1);
