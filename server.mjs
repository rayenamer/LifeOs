/**
 * Production server: serves the built app (dist/) and the database API.
 * No dependencies. Binds to localhost only — your data is never exposed on the network.
 *
 *   node server.mjs            (PORT and LIFEOS_DATA env vars are optional)
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dbApi, DB_FILE } from './server/db-api.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT ?? 4300);
const HOST = process.env.HOST ?? '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.png': 'image/png',
};

function serveStatic(req, res) {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = path.normalize(path.join(DIST, url));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html'); // SPA fallback
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    'Cache-Control': url.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('No build found. Run `npm run build` first (start.sh does this for you).');
  process.exit(1);
}

http
  .createServer((req, res) => void dbApi(req, res, () => serveStatic(req, res)))
  .listen(PORT, HOST, () => {
    console.log(`LifeOS running at http://localhost:${PORT}`);
    console.log(`Database: ${DB_FILE}`);
  });
