// Synthesized audio (no asset files): night music loop + sound effects. Presentation only.
let ctx = null, master = null, musicGain = null, musicTimer = null, volume = 0.6;

function ensure() {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.35; musicGain.connect(master);
  } catch { ctx = null; }
  return ctx;
}

export function setVolume(v) { volume = v; if (master) master.gain.value = v; }

function tone(freq, dur = 0.15, type = 'sine', vol = 0.15, when = 0, dest = null) {
  if (!ensure()) return;
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest || master); o.start(t0); o.stop(t0 + dur + 0.05);
}
function sweep(f0, f1, dur, type = 'sine', vol = 0.12) {
  if (!ensure()) return;
  const t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}

export const sfx = {
  mote_picked: () => tone(1100 + Math.random() * 200, 0.12, 'sine', 0.1),
  deposit: () => tone(523, 0.2, 'triangle', 0.12),
  lantern_lit: () => { tone(523, 0.5, 'triangle', 0.15); tone(659, 0.5, 'triangle', 0.12, 0.1); tone(784, 0.7, 'triangle', 0.12, 0.2); },
  pulse: () => sweep(220, 880, 0.35, 'sine', 0.15),
  player_hit: () => sweep(220, 70, 0.4, 'square', 0.08),
  jump: () => sweep(300, 600, 0.12, 'sine', 0.08),
  dash: () => sweep(900, 300, 0.15, 'sawtooth', 0.05),
  shade_spawned: () => sweep(120, 60, 0.7, 'sawtooth', 0.05),
  charm_picked: () => { tone(880, 0.2, 'triangle', 0.1); tone(1320, 0.3, 'triangle', 0.1, 0.08); },
  drifter_steal: () => sweep(700, 200, 0.3, 'triangle', 0.08),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.6, 'triangle', 0.13, i * 0.15)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.7, 'sine', 0.12, i * 0.25)),
  tick: () => tone(1500, 0.06, 'square', 0.05),
  wind: () => { if (!ensure()) return; const n = ctx.createBufferSource(), b = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / d.length);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; const g = ctx.createGain(); g.gain.value = 0.25;
    n.buffer = b; n.connect(f).connect(g).connect(master); n.start(); },
};

// slow pentatonic arpeggio over a soft drone
const SCALE = [220, 247, 277, 330, 370, 440, 494];
export function startMusic() {
  if (!ensure() || musicTimer) return;
  if (ctx.state === 'suspended') ctx.resume();
  let i = 0;
  const beat = () => {
    tone(110, 3.2, 'sine', 0.12, 0, musicGain);
    tone(SCALE[(i * 3) % SCALE.length], 1.2, 'triangle', 0.06, 0, musicGain);
    tone(SCALE[(i * 5 + 2) % SCALE.length] * 2, 0.8, 'sine', 0.03, 0.8, musicGain);
    i++;
  };
  beat();
  musicTimer = setInterval(beat, 1600);
}
export function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
export function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
