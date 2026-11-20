// Static checks on the web build for Ticket-02 Part 3 items that need no browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const world = readFileSync(new URL('../web/world.js', import.meta.url), 'utf8');
const audio = readFileSync(new URL('../web/audio.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../web/main.js', import.meta.url), 'utf8');

test('AC-palette: standard colors within 10% per RGB channel', () => {
  const spec = {
    sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
    lit: 0xffb347, core: 0xffe9b0, off: 0x5b5f6e, moteCore: 0xfff6c2, moteHalo: 0xffe58a,
    shade: 0x120a1a, rim: 0x7a3cff, stunned: 0x3a3450, coat: 0xe8e2d0, scarf: 0xc8102e, gold: 0xf2c14e, drifter: 0x8fa3b8,
  };
  const block = /export const C = \{([\s\S]*?)\};/.exec(world)[1];
  for (const [k, want] of Object.entries(spec)) {
    const m = new RegExp(`\\b${k}: 0x([0-9a-f]{6})`, 'i').exec(block);
    assert.ok(m, `color ${k} missing`);
    const got = parseInt(m[1], 16);
    for (const sh of [16, 8, 0]) {
      assert.ok(Math.abs(((got >> sh) & 255) - ((want >> sh) & 255)) <= 25.5, `${k} channel off`);
    }
  }
  assert.match(world, /hemi\.intensity = 0\.15 \+ 0\.55 \* k/, 'ambient = 0.15 + 0.55 x progress');
});

test('AC-a11y (P4): no CSS font smaller than 18 px; large text 22.5 px; rebinding covers all actions; reduce motion guards', () => {
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const sizes = [...html.matchAll(/font(?:-size)?:\s*([0-9.]+)(px|rem)/g)].map(([, v, u]) => (u === 'rem' ? Number(v) * 18 : Number(v)));
  assert.ok(sizes.length > 10);
  assert.ok(sizes.every((px) => px >= 18), `too small: ${sizes.filter((px) => px < 18)}`);
  assert.match(html, /html:has\(body\.big\) \{ font-size: 22\.5px; \}/);
  for (const a of ['up', 'down', 'left', 'right', 'jump', 'dash', 'interact', 'pulse', 'pause']) assert.match(main, new RegExp(`\\['${a}', '`));
  assert.match(main, /if \(settings\.reduceMotion\) return;/); // flash
  assert.match(main, /shakeT > 0 && !settings\.reduceMotion/);
});

test('AC-colorblind (P3): rim/eyes #00B3FF, warning white + ⚠, unlit lanterns squashed + torn, low fuel blinks 1 Hz', () => {
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  assert.match(world, /rimColorblind: 0x00b3ff/);
  assert.match(html, /body\.cb \{ --danger: #ffffff; \}/);
  assert.match(main, /settings\.colorblind \? '⚠ '/);
  assert.match(world, /u\.lamp\.scale\.y = L\.lit \? 1 : 0\.8/);
  assert.match(world, /u\.tear\.visible = !L\.lit/);
  assert.match(world, /Math\.floor\(t \* 2\) % 2 === 1; \/\/ 1 Hz/);
});

test('AC-audio: music + every required sound effect exists and is wired', () => {
  for (const k of ['mote_picked', 'lantern_lit', 'pulse', 'player_hit', 'jump', 'dash', 'win', 'lose', 'shade_spawned', 'tick']) {
    assert.match(audio, new RegExp(`\\b${k}: \\(\\)`), `sfx ${k}`);
  }
  assert.match(audio, /export function startMusic/);
  assert.match(main, /sec <= 10 && sec !== lastSecond/, 'countdown in the last 10 s');
  assert.match(main, /audio\.sfx\[won \? 'win' : 'lose'\]/);
});
