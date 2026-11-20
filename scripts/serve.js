// Game server (zero dependencies): static web build + local leaderboard stored on disk.
//   node scripts/serve.js                                  -> http://localhost:5173 (PORT env or --port)
//   node scripts/serve.js --export-leaderboard out.json    -> writes {"entries": [...]} and exits
// Leaderboard file: $DDL_LEADERBOARD or <repo>/data/leaderboard.json (survives restarts).
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { addEntry, isoWithOffset, sortEntries, validEntry, MAX_ENTRIES } from '../src/core/leaderboard.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const leaderboardFile = () => process.env.DDL_LEADERBOARD || join(root, 'data', 'leaderboard.json');

export function loadLeaderboard(file = leaderboardFile()) {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    return sortEntries((data.entries || []).filter(validEntry)).slice(0, MAX_ENTRIES);
  } catch { return []; }
}
function saveLeaderboard(entries, file = leaderboardFile()) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ entries }, null, 2) + '\n');
}

const mounts = [
  ['/three/', join(root, 'node_modules', 'three', 'build')],
  ['/src/', join(root, 'src')],
  ['/', join(root, 'web')],
];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json' };

async function readBody(req) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 10000) throw new Error('too large'); }
  return JSON.parse(body);
}

export function createGameServer() {
  return createServer(async (req, res) => {
    const json = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/api/leaderboard') {
      if (req.method === 'GET') return json(200, { entries: loadLeaderboard() });
      if (req.method === 'POST') {
        try {
          const b = await readBody(req);
          const entry = { name: b.name, score: b.score, nights_won: b.nights_won, seed: b.seed, achieved_at: isoWithOffset() };
          if (!validEntry(entry)) return json(400, { error: 'invalid entry (name: 3-12 letters, digits or _)' });
          const { entries, rank } = addEntry(loadLeaderboard(), entry);
          saveLeaderboard(entries);
          return json(200, { entries, rank: rank <= MAX_ENTRIES ? rank : null });
        } catch (e) { return json(400, { error: String(e.message) }); }
      }
      return json(405, { error: 'method not allowed' });
    }
    if (path === '/') path = '/index.html';
    for (const [prefix, dir] of mounts) {
      if (!path.startsWith(prefix)) continue;
      const file = normalize(join(dir, path.slice(prefix.length)));
      if (!file.startsWith(dir + sep)) break; // no path traversal
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
        return res.end(body);
      } catch { break; }
    }
    res.writeHead(404).end('not found');
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const exportTo = opt('--export-leaderboard');
  if (exportTo !== undefined) {
    if (!exportTo) { console.error('usage: --export-leaderboard <out.json>'); process.exit(1); }
    writeFileSync(exportTo, JSON.stringify({ entries: loadLeaderboard() }, null, 2) + '\n');
    console.log(`leaderboard (${loadLeaderboard().length} entries) -> ${exportTo}`);
    process.exit(0);
  }
  const port = Number(opt('--port') || process.env.PORT) || 5173;
  createGameServer().listen(port, () => console.log(`Đảo Đèn Lồng: http://localhost:${port}`));
}
