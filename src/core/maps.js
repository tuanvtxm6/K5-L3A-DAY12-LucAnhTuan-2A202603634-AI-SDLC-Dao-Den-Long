// Standard maps from Ticket-02 Part 2. Angles: from +X toward +Z (x = r cos a, z = r sin a).
const rad = (d) => (d * Math.PI) / 180;
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const ring = (r, startDeg, stepDeg, n, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = rad(startDeg + i * stepDeg);
    return [r3(cx + r * Math.cos(a)), y, r3(cz + r * Math.sin(a))];
  });
const lanterns = (list) => list.map((pos, i) => ({ id: `L${i + 1}`, pos }));

// surface(x, z) -> ground height (Y) of the highest walkable surface there, or null (sea of clouds).
const night1 = {
  night: 1, name: 'Đảo Bến', duration_key: 'night1_duration_s',
  start: [0, 0, 0],
  surface: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null),
  bounds: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 },
  lanterns: lanterns([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]),
  moteSpawns: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
  shadeSpawns: ring(37, 15, 30, 12),
  shadeEvery: 480, shadeMax: 6, shadeSpeed: null,
  pads: [], charms: [], drifters: false, wind: false, tower: false,
};

const B = 70;
const night2 = {
  night: 2, name: 'Đảo Cau', duration_key: 'night2_duration_s',
  start: [0, 0, 0],
  surface: (x, z) => (Math.hypot(x, z) <= 28 || Math.hypot(x - B, z) <= 28 || (x >= 26 && x <= 44 && z >= -2 && z <= 2) ? 0 : null),
  bounds: { minX: -28, maxX: 98, minZ: -28, maxZ: 28 },
  lanterns: lanterns([[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]),
  moteSpawns: [
    ...ring(10, 0, 90, 4), ...ring(22, 0, 45, 8),
    ...ring(10, 0, 90, 4, 0, B), ...ring(22, 0, 45, 8, 0, B),
  ],
  shadeSpawns: [...ring(26, 22.5, 45, 8), ...ring(26, 22.5, 45, 8, 0, B)],
  shadeEvery: 420, shadeMax: 8, shadeSpeed: null,
  // pads launch toward the other island's center
  pads: [
    { pos: [20, 0, 18], vy: 14, speed: 24, toward: [B, 0] },
    { pos: [50, 0, -18], vy: 14, speed: 24, toward: [0, 0] },
  ],
  charms: [{ id: 'C1', pos: [35, 0, 0] }],
  drifters: true, wind: false, tower: false,
};

const RAMPS = [30, 150].map((d) => [Math.cos(rad(d)), Math.sin(rad(d))]);
function surface3(x, z) {
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  let h = 0;
  for (const [ux, uz] of RAMPS) {
    const s = x * ux + z * uz, w = -x * uz + z * ux;
    if (s >= 24 && s <= 30 && Math.abs(w) <= 1.5) h = Math.max(h, (3 * (30 - s)) / 6);
  }
  if (r >= 12 && r <= 24 && z > 0) h = Math.max(h, 3);
  if (r <= 8) h = Math.max(h, 6);
  if (r <= 2) h = 14; // bell tower: 8 m above tier 2, never walkable (always a wall)
  return h;
}
const night3 = {
  night: 3, name: 'Đảo Chuông', duration_key: 'night3_duration_s',
  start: [0, 0, -25], // (A) (0,0,0) is inside the bell tower
  surface: surface3,
  bounds: { minX: -45, maxX: 45, minZ: -45, maxZ: 45 },
  lanterns: lanterns([[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]),
  moteSpawns: [...ring(34, 0, 20, 18, 0), ...ring(18, 20, 20, 8, 3), ...ring(5, 45, 90, 4, 6)],
  shadeSpawns: ring(43, 0, 22.5, 16),
  shadeEvery: 360, shadeMax: 10, shadeSpeed: 4.5,
  pads: [{ pos: [0, 3, 13], vy: 12, speed: 8, dir: [0, -1] }],
  charms: [{ id: 'C1', pos: [30, 0, 25] }, { id: 'C2', pos: [-30, 0, 25] }],
  drifters: true, wind: true, tower: true,
};

export const MAPS = { 1: night1, 2: night2, 3: night3 };
