/**
 * The database file on disk. The app still runs SQLite in the browser (sql.js);
 * this endpoint is only where its bytes are saved, so the data lives in
 * `<app>/data/lifeos.sqlite` — an ordinary file you can copy, back up or open
 * with any SQLite tool.
 *
 *   GET  /api/db       → the file (204 when it doesn't exist yet)
 *   PUT  /api/db       → replace it (atomic write, daily backup of the previous version)
 *   POST /api/db/backup → timestamped copy of the current file (taken before an import)
 *   GET  /api/db/info  → { path, size, modified, backups }
 *
 * Used by both `server.mjs` (production) and the Vite dev server.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.resolve(process.env.LIFEOS_DATA ?? path.join(ROOT, 'data'));
export const DB_FILE = path.join(DATA_DIR, 'lifeos.sqlite');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP_BACKUPS = 30;
const MAX_BYTES = 200 * 1024 * 1024;
const SQLITE_MAGIC = Buffer.from('SQLite format 3\0', 'latin1');

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Before the first write of each day, keep a copy of the previous file. */
function backupOncePerDay() {
  if (!fs.existsSync(DB_FILE)) return;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const target = path.join(BACKUP_DIR, `lifeos-${localDate()}.sqlite`);
  if (fs.existsSync(target)) return;
  fs.copyFileSync(DB_FILE, target);
  const old = fs.readdirSync(BACKUP_DIR).filter((f) => /^lifeos-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort();
  for (const f of old.slice(0, Math.max(0, old.length - KEEP_BACKUPS))) fs.rmSync(path.join(BACKUP_DIR, f));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BYTES) {
        reject(new Error('Database too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

/** Connect-style middleware: handles /api/db*, passes everything else to `next`. */
export async function dbApi(req, res, next) {
  const url = (req.url ?? '').split('?')[0];
  if (!url.startsWith('/api/db')) return next?.();
  try {
    if (url === '/api/db' && req.method === 'GET') {
      if (!fs.existsSync(DB_FILE)) return send(res, 204, '');
      return send(res, 200, fs.readFileSync(DB_FILE), 'application/x-sqlite3');
    }
    if (url === '/api/db' && req.method === 'PUT') {
      const bytes = await readBody(req);
      if (bytes.length < 100 || !bytes.subarray(0, 16).equals(SQLITE_MAGIC)) {
        return send(res, 400, { error: 'Not a SQLite database' });
      }
      fs.mkdirSync(DATA_DIR, { recursive: true });
      backupOncePerDay();
      const tmp = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmp, bytes);
      fs.renameSync(tmp, DB_FILE); // atomic: a crash never leaves a half-written database
      return send(res, 200, { ok: true, size: bytes.length, savedAt: Date.now() });
    }
    if (url === '/api/db/backup' && req.method === 'POST') {
      if (!fs.existsSync(DB_FILE)) return send(res, 200, { ok: true, file: null });
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = path.join(BACKUP_DIR, `before-import-${stamp}.sqlite`);
      fs.copyFileSync(DB_FILE, file);
      return send(res, 200, { ok: true, file });
    }
    if (url === '/api/db/info' && req.method === 'GET') {
      const stat = fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE) : null;
      const backups = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.sqlite')).length : 0;
      return send(res, 200, { path: DB_FILE, size: stat?.size ?? 0, modified: stat?.mtimeMs ?? null, backups });
    }
    return send(res, 404, { error: 'Not found' });
  } catch (err) {
    return send(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}
