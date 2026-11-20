import assert from 'node:assert/strict';
import { Game } from '../src/core/sim.js';

// A scenario with nothing random, so a test controls every entity.
export const quiet = (extra = {}) => ({
  random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
  motes: [], shades: [], drifters: [], ...extra,
});
export const inp = (o = {}) => ({ move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false, ...o });
export const game = (extra = {}, night = 1, seed = 1) => new Game({ seed, night, scenario: quiet(extra) });
export const runFor = (g, n, input = inp()) => { const evs = []; for (let i = 0; i < n; i++) evs.push(...g.step(input)); return evs; };
export const press = (g, key, extra = {}) => [...g.step(inp({ ...extra, [key]: true })), ...g.step(inp(extra))];
export const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b} (±${eps})`);
export const names = (evs) => evs.map((e) => e.name);
