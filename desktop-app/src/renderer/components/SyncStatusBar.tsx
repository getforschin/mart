import { SyncStatusEvent } from '../../../shared/types';

interface SyncStatusBarProps {
  isOnline: boolean;
  syncStatus: SyncStatusEvent | null;
}

export function SyncStatusBar({ isOnline, syncStatus }: SyncStatusBarProps): JSX.Element {
  return (
    <div className={`sync-bar ${isOnline ? 'sync-bar--online' : 'sync-bar--offline'}`}>
      <span className="sync-bar__indicator" />
      <span>{isOnline ? 'Online' : 'Offline — transactions queued locally'}</span>
      {syncStatus !== null && syncStatus.invoicesSynced + syncStatus.attendanceSynced > 0 && (
        <span className="sync-bar__detail">
          Synced {syncStatus.invoicesSynced} invoice(s), {syncStatus.attendanceSynced} attendance
        </span>
      )}
      {syncStatus !== null && syncStatus.errors.length > 0 && (
        <span className="sync-bar__error">{syncStatus.errors[0]}</span>
      )}
    </div>
  );
}
