// Validation of contract input files (v1.1). Any problem -> ValidationError (headless exits 2).
import { MAPS } from './maps.js';

export class ValidationError extends Error {}

const fail = (msg) => { throw new ValidationError(msg); };
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isVec = (v, n) => Array.isArray(v) && v.length === n && v.every(isNum);
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;
const optInt = (o, k, at) => { if (o[k] !== undefined && !isNonNegInt(o[k])) fail(`${at}.${k}: integer >= 0`); };
const optBool = (o, k, at) => { if (o[k] !== undefined && typeof o[k] !== 'boolean') fail(`${at}.${k}: must be boolean`); };
const optVec3 = (o, k, at) => { if (o[k] !== undefined && !isVec(o[k], 3)) fail(`${at}.${k}: must be [x, y, z]`); };

export function parseJson(text, label) {
  try { return JSON.parse(text); } catch (e) { fail(`${label}: invalid JSON (${e.message})`); }
}

// Returns frames. move components are clamped to [-1, 1] (assumption A14).
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
    for (const k of ['jump', 'interact', 'pulse', 'dash', 'pause']) {
      optBool(f, k, at);
      if (f[k] !== undefined) out[k] = f[k];
    }
    return out;
  });
}

const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned'];
const DRIFTER_STATES = ['idle', 'chase', 'flee', 'removed'];

export function validateScenario(sc, night = 1) {
  if (!isObj(sc)) fail('scenario: expected an object');
  if (sc.player !== undefined) {
    const p = sc.player, at = 'scenario.player';
    if (!isObj(p)) fail(`${at}: expected an object`);
    optVec3(p, 'pos', at);
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks']) optInt(p, k, at);
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) optBool(sc, k, 'scenario');
  if (sc.motes !== undefined) {
    if (!Array.isArray(sc.motes)) fail('scenario.motes: must be an array');
    sc.motes.forEach((m, i) => {
      const at = `scenario.motes[${i}]`;
      const pos = Array.isArray(m) ? m : isObj(m) ? m.pos : null;
      if (!isVec(pos, 3)) fail(`${at}: must be [x, y, z] or {"pos": [x, y, z]}`);
      if (isObj(m)) {
        if (m.kind !== undefined && !['random', 'dropped'].includes(m.kind)) fail(`${at}.kind: random | dropped`);
        if (m.ttl_s !== undefined && !(isNum(m.ttl_s) && m.ttl_s > 0)) fail(`${at}.ttl_s: number > 0`);
      }
    });
  }
  const idList = (arr, name, states, extra) => {
    if (arr === undefined) return;
    if (!Array.isArray(arr)) fail(`scenario.${name}: must be an array`);
    const ids = new Set();
    arr.forEach((o, i) => {
      const at = `scenario.${name}[${i}]`;
      if (!isObj(o) || !isVec(o.pos, 3)) fail(`${at}: needs "pos": [x, y, z]`);
      if (o.id !== undefined) {
        if (typeof o.id !== 'string' || !o.id) fail(`${at}.id: non-empty string`);
        if (ids.has(o.id)) fail(`${at}.id: duplicate "${o.id}"`);
        ids.add(o.id);
      }
      if (o.state !== undefined && !states.includes(o.state)) fail(`${at}.state: one of ${states.join(', ')}`);
      optInt(o, 'state_ticks_left', at);
      extra?.(o, at);
    });
  };
  idList(sc.shades, 'shades', SHADE_STATES);
  idList(sc.drifters, 'drifters', DRIFTER_STATES, (o, at) => optInt(o, 'stolen', at));
  if (sc.charms !== undefined) {
    if (!Array.isArray(sc.charms)) fail('scenario.charms: must be an array');
    const defaults = new Set(MAPS[night].charms.map((c) => c.id));
    sc.charms.forEach((c, i) => {
      const at = `scenario.charms[${i}]`;
      if (!isObj(c) || typeof c.id !== 'string' || !c.id) fail(`${at}: needs "id"`);
      optVec3(c, 'pos', at);
      if (c.pos === undefined && !defaults.has(c.id)) fail(`${at}.pos: required for a charm not on night ${night}`);
      optBool(c, 'available', at);
      optInt(c, 'respawn_ticks', at);
    });
  }
  if (sc.lanterns !== undefined) {
    if (!Array.isArray(sc.lanterns)) fail('scenario.lanterns: must be an array');
    sc.lanterns.forEach((L, i) => {
      const at = `scenario.lanterns[${i}]`;
      if (!isObj(L) || typeof L.id !== 'string') fail(`${at}: needs "id"`);
      optVec3(L, 'pos', at);
      optInt(L, 'deposited', at);
      optBool(L, 'lit', at);
    });
  }
  if (sc.time_left_s !== undefined && !(isNum(sc.time_left_s) && sc.time_left_s >= 0)) {
    fail('scenario.time_left_s: number >= 0');
  }
  return sc;
}
