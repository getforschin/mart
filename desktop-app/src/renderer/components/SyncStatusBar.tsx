import { SyncStatusEvent } from '../../../shared/types';

interface SyncStatusBarProps {
  isOnline: boolean;
  syncStatus: SyncStatusEvent | null;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  return `${Math.floor(hr / 24)} days ago`;
}

export function SyncStatusBar({ isOnline, syncStatus }: SyncStatusBarProps): JSX.Element {
  const pending = syncStatus?.pending;
  const parts: string[] = [];
  if (pending) {
    if (pending.bills > 0) parts.push(`${pending.bills} billing`);
    if (pending.customers > 0) parts.push(`${pending.customers} customers`);
    if (pending.purchases > 0) parts.push(`${pending.purchases} purchases`);
    if (pending.stock > 0) parts.push(`${pending.stock} stock`);
    if (pending.attendance > 0) parts.push(`${pending.attendance} attendance`);
  }

  return (
    <div className={`sync-bar ${isOnline ? 'sync-bar--online' : 'sync-bar--offline'}`}>
      <span className="sync-bar__indicator" />
      <span>{isOnline ? 'Online' : 'Offline — queued locally'}</span>
      <span className="sync-bar__detail">API {formatRelative(syncStatus?.lastApiContactAt)}</span>
      <span className="sync-bar__detail">
        {parts.length > 0 ? `${parts.join(' · ')} pending to sync` : 'All synced'}
      </span>
      {syncStatus !== null && syncStatus.errors.length > 0 && (
        <span className="sync-bar__error">{syncStatus.errors[0]}</span>
      )}
    </div>
  );
}
