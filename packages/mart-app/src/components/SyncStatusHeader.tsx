import { useState } from 'react';
import { useDataPort, useSyncStatus } from '../context';
import type { SyncPendingCounts } from '../types';

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatPending(pending: SyncPendingCounts): string {
  const parts: string[] = [];
  if (pending.bills > 0) parts.push(`${pending.bills} billing`);
  if (pending.customers > 0) parts.push(`${pending.customers} customers`);
  if (pending.purchases > 0) parts.push(`${pending.purchases} purchases`);
  if (pending.stock > 0) parts.push(`${pending.stock} stock`);
  if (pending.attendance > 0) parts.push(`${pending.attendance} attendance`);
  if (parts.length === 0) return 'All synced';
  return `${parts.join(' · ')} pending to sync`;
}

export function SyncStatusHeader({ compact = false }: { compact?: boolean }): JSX.Element {
  const port = useDataPort();
  const status = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const totalPending =
    status.pending.bills +
    status.pending.customers +
    status.pending.purchases +
    status.pending.stock +
    status.pending.attendance;

  const syncing = Boolean(status.syncing) || busy;
  const showManual = port.mode === 'offline' && typeof port.requestManualSync === 'function';

  const onSyncNow = async (): Promise<void> => {
    if (!port.requestManualSync || syncing) return;
    setBusy(true);
    setHint(null);
    try {
      const result = await port.requestManualSync();
      if (!result.started) {
        setHint(result.reason ?? 'Sync not started');
      } else {
        setHint('Syncing in background…');
      }
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      // Keep busy until daemon clears syncing; fallback clear after 2s
      window.setTimeout(() => setBusy(false), 1500);
    }
  };

  return (
    <div
      className={`mart-sync ${status.online ? 'mart-sync--online' : 'mart-sync--offline'} ${
        compact ? 'mart-sync--compact' : ''
      }`}
      title={status.errors[0] ?? undefined}
    >
      <span className="mart-sync__dot" />
      <span className="mart-sync__state">
        {syncing ? 'Syncing…' : status.online ? 'Online' : 'Offline · local DB'}
      </span>
      <span className="mart-sync__sep">·</span>
      <span className="mart-sync__meta">API {formatRelative(status.lastApiContactAt)}</span>
      <span className="mart-sync__sep">·</span>
      <span className={`mart-sync__pending ${totalPending > 0 ? 'mart-sync__pending--warn' : ''}`}>
        {formatPending(status.pending)}
      </span>
      {showManual ? (
        <button
          type="button"
          className="mart-sync__btn"
          disabled={syncing}
          onClick={() => void onSyncNow()}
          title="Push local changes and pull web/admin updates now"
        >
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      ) : null}
      {hint ? <span className="mart-sync__hint">{hint}</span> : null}
      {status.errors[0] ? <span className="mart-sync__error">{status.errors[0]}</span> : null}
    </div>
  );
}
