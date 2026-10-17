import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { MIGRATIONS, SCHEMA_SQL, SCHEMA_VERSION } from './schema';
import { disk, idbGet, idbPut } from './disk';

type InitSqlJsFn = (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;

declare global {
  interface Window {
    initSqlJs?: InitSqlJsFn;
  }
}

/**
 * Load sql.js at runtime from the asset root (copied there by `npm run sqljs`)
 * instead of bundling it — its UMD build references node-only modules and
 * self-locates the wasm, both of which break once bundled.
 */
let sqlJsPromise: Promise<InitSqlJsFn> | null = null;
function loadSqlJs(): Promise<InitSqlJsFn> {
  if (window.initSqlJs) return Promise.resolve(window.initSqlJs);
  sqlJsPromise ??= new Promise<InitSqlJsFn>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('sql-wasm.js', document.baseURI).href;
    script.async = true;
    script.onload = () =>
      window.initSqlJs ? resolve(window.initSqlJs) : reject(new Error('sql-wasm.js loaded but initSqlJs is missing'));
    script.onerror = () => reject(new Error('Failed to load sql-wasm.js from the asset root'));
    document.head.appendChild(script);
  });
  return sqlJsPromise;
}

export type SqlRow = Record<string, SqlValue>;
export type SqlParams = SqlValue[] | Record<string, SqlValue>;

const IDB_KEY = 'sqlite-db';

/** What an uploaded file contains, shown before the user confirms an import. */
export interface ImportPreview {
  schemaVersion: number;
  areas: number;
  goals: number;
  processes: number;
  executions: number;
  days: number;
  reflections: number;
  firstDate: string | null;
  lastDate: string | null;
}

let sql: SqlJsStatic;
let db: Database;
let ready = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let txDepth = 0;

// --- change bus: every write bumps a version React subscribes to -------------

let version = 0;
let bumpQueued = false;
const listeners = new Set<() => void>();

function bump(): void {
  if (bumpQueued) return;
  bumpQueued = true;
  queueMicrotask(() => {
    bumpQueued = false;
    version++;
    listeners.forEach((l) => l());
  });
}

export const bus = {
  getVersion: () => version,
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  bump,
};

/**
 * Owns the in-browser SQLite engine and its persistence. Every mutation is
 * written back (debounced) to `data/lifeos.sqlite` in the app folder via the
 * local server, plus an IndexedDB cache used only if the server is down.
 * Same schema as the Angular LifeOS, so `.sqlite` files move freely between the two.
 */
export const sqlite = {
  async init(): Promise<void> {
    if (ready) return;
    const initSqlJs = await loadSqlJs();
    sql = await initSqlJs({ locateFile: (file) => new URL(file, document.baseURI).href });

    // data/lifeos.sqlite is the source of truth. If it doesn't exist yet, adopt
    // whatever this browser had cached (e.g. data imported before the file existed).
    const fromDisk = await disk.load();
    let snapshot: Uint8Array | null = fromDisk === 'unavailable' ? null : fromDisk;
    if (!snapshot) snapshot = await idbGet<Uint8Array>(IDB_KEY).then((v) => (v ? new Uint8Array(v) : null)).catch(() => null);

    if (snapshot) {
      db = new sql.Database(snapshot);
      runMigrations();
      if (!fromDisk) await sqlite.persistNow(); // first run with the server: write the file
    } else {
      db = new sql.Database();
      db.run(SCHEMA_SQL);
      await sqlite.persistNow();
    }
    db.run('PRAGMA foreign_keys = ON;');
    ready = true;

    const flush = () => void sqlite.persistNow(true);
    window.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
    window.addEventListener('pagehide', flush);
  },

  query<T extends object = SqlRow>(text: string, params?: SqlParams): T[] {
    const stmt = db.prepare(text);
    try {
      if (params) stmt.bind(params as never);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  },

  run(text: string, params?: SqlParams): void {
    db.run(text, params as never);
    if (txDepth === 0) schedulePersist();
    bump();
  },

  /** Wrap writes in a transaction; rolls back on error. Reentrant via SAVEPOINT. */
  transaction(work: () => void): void {
    if (txDepth > 0) {
      const sp = `sp_${txDepth}`;
      txDepth++;
      db.run(`SAVEPOINT ${sp}`);
      try {
        work();
        db.run(`RELEASE ${sp}`);
      } catch (err) {
        db.run(`ROLLBACK TO ${sp}`);
        db.run(`RELEASE ${sp}`);
        throw err;
      } finally {
        txDepth--;
      }
      return;
    }
    txDepth++;
    db.run('BEGIN');
    try {
      work();
      db.run('COMMIT');
      schedulePersist();
    } catch (err) {
      db.run('ROLLBACK');
      throw err;
    } finally {
      txDepth--;
      bump();
    }
  },

  /** Drop every table and rebuild an empty schema. */
  async reset(): Promise<void> {
    const tables = sqlite.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
    );
    db.run('PRAGMA foreign_keys = OFF;');
    for (const t of tables) db.run(`DROP TABLE IF EXISTS "${t.name}"`);
    db.run('PRAGMA foreign_keys = ON;');
    db.run(SCHEMA_SQL);
    await sqlite.persistNow();
    bump();
  },

  // --- manual export / import ----------------------------------------------

  exportBytes: (): Uint8Array => db.export(),

  /**
   * Open an uploaded file in a throwaway database and describe it, without
   * touching the live data. Throws a readable error if it isn't a LifeOS file.
   */
  inspectBytes(bytes: Uint8Array): ImportPreview {
    let probe: Database;
    try {
      probe = new sql.Database(bytes);
    } catch {
      throw new Error("That file isn't a SQLite database.");
    }
    try {
      const count = (table: string): number => {
        const r = probe.exec(`SELECT COUNT(*) FROM ${table}`);
        return Number(r[0]?.values[0]?.[0] ?? 0);
      };
      let tables: string[];
      try {
        tables = (probe.exec(`SELECT name FROM sqlite_master WHERE type='table'`)[0]?.values ?? []).map((v) => String(v[0]));
      } catch {
        throw new Error("That file isn't a SQLite database.");
      }
      for (const t of ['life_area', 'monthly_goal', 'process', 'daily_execution', 'daily_score']) {
        if (!tables.includes(t)) throw new Error(`This doesn't look like a LifeOS database (missing "${t}").`);
      }
      const has = (t: string) => tables.includes(t);
      const v = has('schema_version') ? Number(probe.exec('SELECT MAX(version) FROM schema_version')[0]?.values[0]?.[0] ?? 1) : 1;
      const range = probe.exec('SELECT MIN(date), MAX(date) FROM daily_score')[0]?.values[0] ?? [null, null];
      return {
        schemaVersion: v,
        areas: count('life_area'),
        goals: count('monthly_goal'),
        processes: count('process'),
        executions: count('daily_execution'),
        days: count('daily_score'),
        reflections: has('weekly_reflection') ? count('weekly_reflection') : 0,
        firstDate: range[0] == null ? null : String(range[0]),
        lastDate: range[1] == null ? null : String(range[1]),
      };
    } finally {
      probe.close();
    }
  },

  /** Replace the database with an uploaded `.sqlite` file's bytes (migrated to the current schema). */
  async importBytes(bytes: Uint8Array): Promise<void> {
    loadBytes(bytes);
    await sqlite.persistNow();
  },

  async persistNow(closing = false): Promise<void> {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    if (!db) return;
    const bytes = db.export();
    // sql.js's export() can reset pragmas on the connection — re-assert FK enforcement.
    db.run('PRAGMA foreign_keys = ON;');
    await Promise.all([
      disk.save(bytes, closing),
      idbPut(IDB_KEY, bytes).catch((err) => console.warn('LifeOS: could not cache database in IndexedDB', err)),
    ]);
  },
};

function loadBytes(bytes: Uint8Array): void {
  try {
    db?.close();
  } catch {
    /* nothing open */
  }
  db = new sql.Database(bytes);
  runMigrations();
  db.run('PRAGMA foreign_keys = ON;');
  bump();
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => void sqlite.persistNow(), 200);
}

/** Apply pending schema migrations to a database loaded from disk / an import. */
function runMigrations(): void {
  let current: number;
  try {
    const rows = sqlite.query<SqlRow>('SELECT MAX(version) AS v FROM schema_version');
    current = rows.length && rows[0].v != null ? Number(rows[0].v) : 1;
  } catch {
    db.run('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
    current = 1;
  }
  for (const m of MIGRATIONS) {
    if (m.to <= current) continue;
    db.run(m.sql);
    db.run('INSERT INTO schema_version (version) VALUES (?)', [m.to]);
    current = m.to;
  }
  if (current < SCHEMA_VERSION) db.run('INSERT INTO schema_version (version) VALUES (?)', [SCHEMA_VERSION]);
  reconcileColumns();
  // Older exports may predate tables added later — create anything missing (IF NOT EXISTS).
  db.run(SCHEMA_SQL.replace(/INSERT INTO schema_version[^;]*;/, ''));
  schedulePersist();
}

/** Safety net: add any optional column a mis-versioned database is missing. Never drops data. */
function reconcileColumns(): void {
  const expected = [
    { table: 'monthly_goal', column: 'weight', def: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'process', column: 'link', def: "TEXT NOT NULL DEFAULT ''" },
  ];
  for (const e of expected) {
    let has: boolean;
    try {
      has = sqlite.query<SqlRow>(`PRAGMA table_info(${e.table})`).some((r) => String(r.name) === e.column);
    } catch {
      continue;
    }
    if (!has) db.run(`ALTER TABLE ${e.table} ADD COLUMN ${e.column} ${e.def}`);
  }
}
