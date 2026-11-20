// Strict-ish validation of contract input files. Any problem -> ValidationError (headless exits 2).
export class ValidationError extends Error {}

const fail = (msg) => { throw new ValidationError(msg); };
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isVec = (v, n) => Array.isArray(v) && v.length === n && v.every(isNum);
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;

export function parseJson(text, label) {
  try { return JSON.parse(text); } catch (e) { fail(`${label}: invalid JSON (${e.message})`); }
}

// Returns sorted frames. move components are clamped to [-1, 1] (documented assumption).
export function validateInputs(obj) {
  if (!isObj(obj) || !Array.isArray(obj.frames)) fail('inputs: expected {"frames": [...]}');
  let last = -1;
  return obj.frames.map((f, i) => {
    const at = `inputs.frames[${i}]`;
    if (!isObj(f)) fail(`${at}: not an object`);
    if (!isNonNegInt(f.tick)) fail(`${at}.tick: must be an integer >= 0`);
    if (f.tick <= last) fail(`${at}.tick: ticks must be strictly increasing`);
    last = f.tick;
    const out = { tick: f.tick };
    if (f.move !== undefined) {
      if (!isVec(f.move, 2)) fail(`${at}.move: must be [x, z] numbers`);
      out.move = f.move.map((v) => Math.max(-1, Math.min(1, v)));
    }
    if (f.cam_yaw_deg !== undefined) {
      if (!isNum(f.cam_yaw_deg)) fail(`${at}.cam_yaw_deg: must be a number`);
      out.cam_yaw_deg = f.cam_yaw_deg;
    }
    for (const k of ['jump', 'interact', 'pulse', 'dash']) {
      if (f[k] === undefined) continue;
      if (typeof f[k] !== 'boolean') fail(`${at}.${k}: must be boolean`);
      out[k] = f[k];
    }
    return out;
  });
}

export function validateScenario(sc) {
  if (!isObj(sc)) fail('scenario: expected an object');
  if (sc.player !== undefined) {
    const p = sc.player;
    if (!isObj(p)) fail('scenario.player: expected an object');
    if (p.pos !== undefined && !isVec(p.pos, 3)) fail('scenario.player.pos: must be [x, y, z]');
    if (p.carried !== undefined && !isNonNegInt(p.carried)) fail('scenario.player.carried: integer >= 0');
    if (p.flames !== undefined && !isNonNegInt(p.flames)) fail('scenario.player.flames: integer >= 0');
  }
  for (const k of ['random_motes', 'random_shades']) {
    if (sc[k] !== undefined && typeof sc[k] !== 'boolean') fail(`scenario.${k}: must be boolean`);
  }
  if (sc.motes !== undefined) {
    if (!Array.isArray(sc.motes)) fail('scenario.motes: must be an array');
    sc.motes.forEach((m, i) => {
      const pos = Array.isArray(m) ? m : isObj(m) ? m.pos : null;
      if (!isVec(pos, 3)) fail(`scenario.motes[${i}]: must be [x, y, z] or {"pos": [x, y, z]}`);
    });
  }
  if (sc.shades !== undefined) {
    if (!Array.isArray(sc.shades)) fail('scenario.shades: must be an array');
    const ids = new Set();
    sc.shades.forEach((s, i) => {
      if (!isObj(s) || !isVec(s.pos, 3)) fail(`scenario.shades[${i}]: needs "pos": [x, y, z]`);
      if (s.id !== undefined) {
        if (typeof s.id !== 'string' || !s.id) fail(`scenario.shades[${i}].id: non-empty string`);
        if (ids.has(s.id)) fail(`scenario.shades[${i}].id: duplicate "${s.id}"`);
        ids.add(s.id);
      }
    });
  }
  if (sc.lanterns !== undefined) {
    if (!Array.isArray(sc.lanterns)) fail('scenario.lanterns: must be an array');
    sc.lanterns.forEach((L, i) => {
      const at = `scenario.lanterns[${i}]`;
      if (!isObj(L) || typeof L.id !== 'string') fail(`${at}: needs "id"`);
      if (L.pos !== undefined && !isVec(L.pos, 3)) fail(`${at}.pos: must be [x, y, z]`);
      if (L.deposited !== undefined && !isNonNegInt(L.deposited)) fail(`${at}.deposited: integer >= 0`);
      if (L.lit !== undefined && typeof L.lit !== 'boolean') fail(`${at}.lit: must be boolean`);
    });
  }
  if (sc.time_left_s !== undefined && !(isNum(sc.time_left_s) && sc.time_left_s >= 0)) {
    fail('scenario.time_left_s: number >= 0');
  }
  return sc;
}
