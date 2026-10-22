import { useSyncExternalStore } from 'react';

/**
 * Private mode: personal text (areas, goals, processes, notes, reflections) is
 * hidden and only the numbers stay — for screen-sharing or screenshots.
 * A per-device preference, so it lives in localStorage rather than the database.
 */
const KEY = 'lifeos.private';
const listeners = new Set<() => void>();
let on = load();

function load(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const privacy = {
  isOn: (): boolean => on,
  set(next: boolean): void {
    on = next;
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // private window / blocked storage: still works for this session
    }
    privacy.apply();
    listeners.forEach((l) => l());
  },
  toggle: (): void => privacy.set(!on),
  /** Mirror the mode on <html> so CSS can hide the text inside form fields. */
  apply: (): void => {
    document.documentElement.toggleAttribute('data-private', on);
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export const usePrivate = (): boolean => useSyncExternalStore(privacy.subscribe, privacy.isOn);
