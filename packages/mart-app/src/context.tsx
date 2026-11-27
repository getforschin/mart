import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DataPort } from './DataPort';
import { EMPTY_PENDING, type SyncStatusSnapshot } from './types';

const DataPortContext = createContext<DataPort | null>(null);
const SyncStatusContext = createContext<SyncStatusSnapshot>({
  online: true,
  timestamp: new Date().toISOString(),
  lastApiContactAt: null,
  lastSyncAt: null,
  pending: EMPTY_PENDING,
  lastSynced: EMPTY_PENDING,
  errors: [],
});

export function MartAppProvider({
  port,
  children,
}: {
  port: DataPort;
  children: ReactNode;
}): JSX.Element {
  const [syncStatus, setSyncStatus] = useState<SyncStatusSnapshot>({
    online: port.mode === 'online',
    timestamp: new Date().toISOString(),
    lastApiContactAt: port.mode === 'online' ? new Date().toISOString() : null,
    lastSyncAt: null,
    pending: EMPTY_PENDING,
    lastSynced: EMPTY_PENDING,
    errors: [],
  });

  useEffect(() => {
    let cancelled = false;
    void port.getSyncStatus().then((status) => {
      if (!cancelled) setSyncStatus(status);
    });
    const unsubscribe = port.subscribeSyncStatus?.((status) => {
      setSyncStatus(status);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [port]);

  return (
    <DataPortContext.Provider value={port}>
      <SyncStatusContext.Provider value={syncStatus}>{children}</SyncStatusContext.Provider>
    </DataPortContext.Provider>
  );
}

export function useDataPort(): DataPort {
  const port = useContext(DataPortContext);
  if (!port) throw new Error('useDataPort must be used inside MartAppProvider');
  return port;
}

export function useSyncStatus(): SyncStatusSnapshot {
  return useContext(SyncStatusContext);
}
