/**
 * Where the database bytes are saved: `data/lifeos.sqlite` in the app folder,
 * through the local server's `/api/db` endpoint. IndexedDB is kept as a
 * fallback cache, used only when the server can't be reached.
 */

export interface DiskState {
  /** The local server answered — saves go to the file. */
  available: boolean;
  path: string | null;
  size: number;
  lastSavedAt: number | null;
  backups: number;
  error: string | null;
}

let state: DiskState = { available: false, path: null, size: 0, lastSavedAt: null, backups: 0, error: null };
const listeners = new Set<() => void>();

function patch(p: Partial<DiskState>): void {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}

const api = (p: string) => new URL(p, document.baseURI).href;

export const disk = {
  getState: (): DiskState => state,
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  /** Bytes of data/lifeos.sqlite; null if the file doesn't exist yet; 'unavailable' if there's no server. */
  async load(): Promise<Uint8Array | null | 'unavailable'> {
    try {
      const res = await fetch(api('api/db'), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      patch({ available: true, error: null });
      void disk.refreshInfo();
      if (res.status === 204) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      return bytes.length ? bytes : null;
    } catch {
      patch({ available: false, error: 'The LifeOS server is not running — changes are only kept in this browser.' });
      return 'unavailable';
    }
  },

  async save(bytes: Uint8Array, keepalive = false): Promise<void> {
    if (!state.available) return;
    try {
      const res = await fetch(api('api/db'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-sqlite3' },
        body: bytes as BodyInit,
        // keepalive lets a save finish while the tab closes, but browsers cap it at 64 KB
        keepalive: keepalive && bytes.length < 60_000,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      patch({ lastSavedAt: Date.now(), size: bytes.length, error: null });
    } catch (err) {
      patch({ error: `Couldn't save to disk: ${err instanceof Error ? err.message : String(err)}` });
    }
  },

  /** Snapshot the current file into data/backups before it gets replaced. */
  async backup(): Promise<void> {
    if (!state.available) return;
    const res = await fetch(api('api/db/backup'), { method: 'POST' });
    if (!res.ok) throw new Error('Could not back up the current database — import cancelled.');
  },

  async refreshInfo(): Promise<void> {
    try {
      const info = await (await fetch(api('api/db/info'), { cache: 'no-store' })).json();
      patch({ path: info.path, size: info.size, backups: info.backups, lastSavedAt: state.lastSavedAt ?? info.modified });
    } catch {
      /* informational only */
    }
  },
};

// --- IndexedDB fallback cache --------------------------------------------------

const IDB_NAME = 'lifeos-react';
const IDB_STORE = 'kv';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const req = idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(key: string, value: unknown): Promise<void> {
  const idb = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
