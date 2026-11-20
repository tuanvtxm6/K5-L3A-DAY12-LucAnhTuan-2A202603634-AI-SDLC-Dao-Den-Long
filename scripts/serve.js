// Zero-dependency static server for the web build. Usage: npm start  (PORT env, default 5173)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mounts = [
  ['/three/', join(root, 'node_modules', 'three', 'build')],
  ['/src/', join(root, 'src')],
  ['/', join(root, 'web')],
];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
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

const port = Number(process.env.PORT) || 5173;
server.listen(port, () => console.log(`Đảo Đèn Lồng: http://localhost:${port}`));
