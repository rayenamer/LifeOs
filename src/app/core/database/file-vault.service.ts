import { Injectable, computed, signal } from '@angular/core';

/**
 * Keeps the SQLite database as a real file on disk, in a folder the user picks
 * once (File System Access API). Every mutation rewrites that file, so the data
 * lives outside the browser sandbox as an ordinary `lifeos.sqlite` the user can
 * back up, sync, or copy anywhere.
 *
 * This is purely the file-handle / permission plumbing. `SqliteService` decides
 * when to read and write.
 */

type FsPermission = 'granted' | 'denied' | 'prompt';

interface FsPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

declare global {
  interface FileSystemFileHandle {
    queryPermission?(descriptor?: FsPermissionDescriptor): Promise<FsPermission>;
    requestPermission?(descriptor?: FsPermissionDescriptor): Promise<FsPermission>;
  }
  interface Window {
    showSaveFilePicker?(options?: {
      suggestedName?: string;
      types?: FilePickerAcceptType[];
    }): Promise<FileSystemFileHandle>;
    showOpenFilePicker?(options?: {
      multiple?: boolean;
      types?: FilePickerAcceptType[];
    }): Promise<FileSystemFileHandle[]>;
  }
}

const IDB_NAME = 'lifeos';
const IDB_STORE = 'kv';
const HANDLE_KEY = 'vault-file-handle';

const SQLITE_PICKER_TYPES: FilePickerAcceptType[] = [
  {
    description: 'LifeOS database',
    accept: { 'application/x-sqlite3': ['.sqlite', '.db', '.sqlite3'] },
  },
];

export type VaultPermission = FsPermission | 'unknown';

@Injectable({ providedIn: 'root' })
export class FileVaultService {
  /** True when the browser exposes the File System Access API (Chromium, Brave). */
  readonly supported =
    typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';

  private handle: FileSystemFileHandle | null = null;

  private readonly _fileName = signal<string | null>(null);
  private readonly _permission = signal<VaultPermission>('unknown');
  private readonly _lastSavedAt = signal<number | null>(null);

  readonly fileName = this._fileName.asReadonly();
  readonly permission = this._permission.asReadonly();
  readonly lastSavedAt = this._lastSavedAt.asReadonly();

  /** A file is chosen and we may write to it right now. */
  readonly linked = computed(
    () => this._fileName() !== null && this._permission() === 'granted',
  );
  /** A file is remembered but the browser needs a fresh gesture to grant access. */
  readonly needsReconnect = computed(
    () => this._fileName() !== null && this._permission() === 'prompt',
  );

  /** Reload a previously chosen file handle from IndexedDB (called on startup). */
  async restore(): Promise<void> {
    if (!this.supported) return;
    let stored: FileSystemFileHandle | null = null;
    try {
      stored = await idbGet<FileSystemFileHandle>(HANDLE_KEY);
    } catch {
      stored = null;
    }
    if (!stored) return;
    this.handle = stored;
    this._fileName.set(stored.name);
    try {
      const state = (await stored.queryPermission?.({ mode: 'readwrite' })) ?? 'prompt';
      this._permission.set(state);
    } catch {
      this._permission.set('prompt');
    }
  }

  /**
   * Prompt for a save location. The returned handle is remembered but NOT yet
   * written to — the caller inspects {@link readBytes} first to avoid clobbering
   * an existing database.
   */
  async pickSaveTarget(): Promise<FileSystemFileHandle | null> {
    if (!window.showSaveFilePicker) return null;
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'lifeos.sqlite',
        types: SQLITE_PICKER_TYPES,
      });
      this.handle = handle;
      this._fileName.set(handle.name);
      this._permission.set('granted');
      await idbPut(HANDLE_KEY, handle);
      return handle;
    } catch (err) {
      if (isAbort(err)) return null;
      throw err;
    }
  }

  /** Prompt for an existing database file and remember it for writing. */
  async pickExistingFile(): Promise<FileSystemFileHandle | null> {
    if (!window.showOpenFilePicker) return null;
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: SQLITE_PICKER_TYPES,
      });
      if (!handle) return null;
      this.handle = handle;
      this._fileName.set(handle.name);
      let state: FsPermission = 'granted';
      try {
        state = (await handle.requestPermission?.({ mode: 'readwrite' })) ?? 'granted';
      } catch {
        state = 'prompt';
      }
      this._permission.set(state);
      await idbPut(HANDLE_KEY, handle);
      return handle;
    } catch (err) {
      if (isAbort(err)) return null;
      throw err;
    }
  }

  /** Re-request write permission after a restart (must run inside a user gesture). */
  async reconnect(): Promise<boolean> {
    if (!this.handle) return false;
    try {
      const state =
        (await this.handle.requestPermission?.({ mode: 'readwrite' })) ?? 'granted';
      this._permission.set(state);
      return state === 'granted';
    } catch {
      this._permission.set('denied');
      return false;
    }
  }

  /** Current bytes of the linked file, or null if empty / unreadable. */
  async readBytes(): Promise<Uint8Array | null> {
    if (!this.handle) return null;
    try {
      const file = await this.handle.getFile();
      if (file.size === 0) return null;
      return new Uint8Array(await file.arrayBuffer());
    } catch {
      return null;
    }
  }

  /** Overwrite the linked file. No-op when nothing is linked. */
  async writeBytes(bytes: Uint8Array): Promise<void> {
    if (!this.handle || this._permission() !== 'granted') return;
    const writable = await this.handle.createWritable();
    try {
      await writable.write(bytes as unknown as BufferSource);
      await writable.close();
      this._lastSavedAt.set(Date.now());
    } catch (err) {
      try {
        await writable.abort();
      } catch {
        /* already closed */
      }
      throw err;
    }
  }

  /** Forget the linked file (does not delete it from disk). */
  async unlink(): Promise<void> {
    this.handle = null;
    this._fileName.set(null);
    this._permission.set('unknown');
    this._lastSavedAt.set(null);
    try {
      await idbDelete(HANDLE_KEY);
    } catch {
      /* nothing to remove */
    }
  }
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

// --- tiny IndexedDB key/value helpers (shares the `lifeos` / `kv` store) -------

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const idb = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const idb = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
