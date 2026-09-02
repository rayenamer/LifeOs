import { Injectable } from '@angular/core';
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { MIGRATIONS, SCHEMA_SQL, SCHEMA_VERSION } from './schema';

type InitSqlJsFn = (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;

declare global {
  interface Window {
    initSqlJs?: InitSqlJsFn;
  }
}

/**
 * Load sql.js at runtime instead of bundling it. The npm package's `sql-wasm.js`
 * references `require("node:crypto")` (dead code in the browser, but esbuild
 * refuses to bundle it) and its `browser` build self-locates the wasm via
 * `import.meta.url`, which breaks once bundled. Loading the UMD script from the
 * asset root sidesteps both problems; it registers `window.initSqlJs`.
 */
let sqlJsPromise: Promise<InitSqlJsFn> | null = null;
function loadSqlJs(): Promise<InitSqlJsFn> {
  if (window.initSqlJs) return Promise.resolve(window.initSqlJs);
  if (sqlJsPromise) return sqlJsPromise;
  sqlJsPromise = new Promise<InitSqlJsFn>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('sql-wasm.js', document.baseURI).href;
    script.async = true;
    script.onload = () => {
      if (window.initSqlJs) resolve(window.initSqlJs);
      else reject(new Error('sql-wasm.js loaded but window.initSqlJs is undefined'));
    };
    script.onerror = () => reject(new Error('Failed to load sql-wasm.js from the asset root'));
    document.head.appendChild(script);
  });
  return sqlJsPromise;
}

export type SqlRow = Record<string, SqlValue>;
export type SqlParams = SqlValue[] | Record<string, SqlValue>;

const IDB_NAME = 'lifeos';
const IDB_STORE = 'kv';
const IDB_KEY = 'sqlite-db';

/**
 * Owns the in-browser SQLite engine (sql.js / WASM) and its persistence.
 *
 * The full database is serialised to a byte array and written to IndexedDB after
 * every mutation (debounced), so a refresh or restart never loses data.
 */
@Injectable({ providedIn: 'root' })
export class SqliteService {
  private sql!: SqlJsStatic;
  private db!: Database;
  private ready = false;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private txDepth = 0;

  async init(): Promise<void> {
    if (this.ready) return;

    const initSqlJs = await loadSqlJs();
    this.sql = await initSqlJs({
      locateFile: (file: string) => new URL(file, document.baseURI).href,
    });

    let snapshot: Uint8Array | null = null;
    try {
      snapshot = await this.idbGet();
    } catch {
      snapshot = null;
    }

    if (snapshot) {
      this.db = new this.sql.Database(snapshot);
      this.runMigrations();
    } else {
      this.db = new this.sql.Database();
      this.db.run(SCHEMA_SQL);
      await this.persistNow();
    }

    this.db.run('PRAGMA foreign_keys = ON;');
    this.ready = true;

    // Flush pending writes when the tab is hidden or closed.
    const flush = () => void this.persistNow();
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush);
  }

  /** Apply any pending schema migrations to a database loaded from disk. */
  private runMigrations(): void {
    let current: number;
    try {
      const rows = this.query<SqlRow>('SELECT MAX(version) AS v FROM schema_version');
      current = rows.length && rows[0]['v'] != null ? Number(rows[0]['v']) : 1;
    } catch {
      // pre-versioning database
      this.db.run('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
      current = 1;
    }
    for (const m of MIGRATIONS) {
      if (m.to <= current) continue;
      this.db.run(m.sql);
      this.db.run('INSERT INTO schema_version (version) VALUES (?)', [m.to]);
      current = m.to;
    }
    if (current < SCHEMA_VERSION) {
      this.db.run('INSERT INTO schema_version (version) VALUES (?)', [SCHEMA_VERSION]);
    }
    this.schedulePersist();
  }

  /** Run a query and return all rows as plain objects. */
  query<T extends object = SqlRow>(sql: string, params?: SqlParams): T[] {
    const stmt = this.db.prepare(sql);
    try {
      if (params) stmt.bind(params as never);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  }

  /** Run a single statement (INSERT / UPDATE / DELETE) with optional bound params. */
  run(sql: string, params?: SqlParams): void {
    this.db.run(sql, params as never);
    this.schedulePersist();
  }

  /** Execute one or more statements without params (migrations, batch DDL). */
  exec(sql: string): void {
    this.db.run(sql);
    this.schedulePersist();
  }

  /**
   * Wrap a set of writes in a transaction; rolls back on error. Reentrant — a
   * nested call uses a SAVEPOINT so repositories that manage their own
   * transactions can be composed inside a larger one (e.g. during seeding).
   */
  transaction(work: () => void): void {
    if (this.txDepth > 0) {
      const sp = `sp_${this.txDepth}`;
      this.txDepth++;
      this.db.run(`SAVEPOINT ${sp}`);
      try {
        work();
        this.db.run(`RELEASE ${sp}`);
      } catch (err) {
        this.db.run(`ROLLBACK TO ${sp}`);
        this.db.run(`RELEASE ${sp}`);
        throw err;
      } finally {
        this.txDepth--;
      }
      return;
    }

    this.txDepth++;
    this.db.run('BEGIN');
    try {
      work();
      this.db.run('COMMIT');
      this.schedulePersist();
    } catch (err) {
      this.db.run('ROLLBACK');
      throw err;
    } finally {
      this.txDepth--;
    }
  }

  /** Drop every table and rebuild an empty schema. Used by "delete all data". */
  async reset(): Promise<void> {
    const tables = this.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
    );
    this.db.run('PRAGMA foreign_keys = OFF;');
    for (const t of tables) this.db.run(`DROP TABLE IF EXISTS "${t.name}"`);
    this.db.run('PRAGMA foreign_keys = ON;');
    this.db.run(SCHEMA_SQL);
    await this.persistNow();
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => void this.persistNow(), 200);
  }

  async persistNow(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (!this.db) return;
    const bytes = this.db.export();
    try {
      await this.idbPut(bytes);
    } catch (err) {
      // IndexedDB can be unavailable (private windows, storage disabled). The
      // app still works in-memory for the session; just warn.
      console.warn('LifeOS: could not persist database to IndexedDB', err);
    }
  }

  // --- IndexedDB helpers -------------------------------------------------------

  private openIdb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async idbGet(): Promise<Uint8Array | null> {
    try {
      const idb = await this.openIdb();
      return await new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = () => {
          const val = req.result as Uint8Array | undefined;
          resolve(val ? new Uint8Array(val) : null);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  private async idbPut(bytes: Uint8Array): Promise<void> {
    const idb = await this.openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
