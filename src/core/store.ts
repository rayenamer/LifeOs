import { DependencyList, useMemo, useSyncExternalStore } from 'react';
import { bus } from '../db/sqlite';
import { disk, DiskState } from '../db/disk';

/**
 * Read from the database inside a component. The database is synchronous, so a
 * read is just a function call; this re-runs it whenever any write bumps the bus.
 */
export function useDb<T>(read: () => T, deps: DependencyList = []): T {
  const version = useSyncExternalStore(bus.subscribe, bus.getVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(read, [version, ...deps]);
}

export function useDisk(): DiskState {
  return useSyncExternalStore(disk.subscribe, disk.getState);
}
