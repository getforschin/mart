import { useExpiryDashboard } from '../hooks/useExpiryDashboard';
import { ExpiryAlertCard } from '../components/ExpiryAlertCard';

export function ExpiryDashboardPage(): JSX.Element {
  const { dashboard, loading, error, lastRefreshed, refresh } = useExpiryDashboard();

  if (loading && dashboard === null) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Sweeping product lots for expiry analytics…</p>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="page-error">
        <h2>Dashboard Error</h2>
        <p>{error}</p>
        <button type="button" onClick={() => void refresh()}>
          Retry
        </button>
      </div>
    );
  }

  if (dashboard === null) {
    return (
      <div className="page-error">
        <p>No dashboard data available.</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <h1>Expiry Analytics Engine</h1>
          <p className="dashboard__subtitle">
            Automated sweep of {dashboard.totalLotsScanned} lots — {dashboard.criticalWindowDays}-day critical
            window monitoring
          </p>
        </div>
        <div className="dashboard__actions">
          {lastRefreshed !== null && (
            <span className="dashboard__timestamp">Last updated: {lastRefreshed.toLocaleTimeString()}</span>
          )}
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh Now'}
          </button>
        </div>
      </header>

      <section className="dashboard__summary">
        <div className="stat-card stat-card--critical">
          <span className="stat-card__value">{dashboard.criticalAlerts.length}</span>
          <span className="stat-card__label">Critical Alerts</span>
        </div>
        <div className="stat-card stat-card--warning">
          <span className="stat-card__value">{dashboard.warningAlerts.length}</span>
          <span className="stat-card__label">Warning Alerts</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">{dashboard.totalLotsScanned}</span>
          <span className="stat-card__label">Lots Scanned</span>
        </div>
      </section>

      <section className="dashboard__section">
        <h2>Critical Window — Markdown Priority</h2>
        {dashboard.criticalAlerts.length === 0 ? (
          <p className="empty-state">No lots within the {dashboard.criticalWindowDays}-day critical boundary.</p>
        ) : (
          <div className="alert-grid">
            {dashboard.criticalAlerts.map((alert) => (
              <ExpiryAlertCard key={`${alert.lotId}-${alert.facilityId}`} alert={alert} variant="critical" />
            ))}
          </div>
        )}
      </section>

      <section className="dashboard__section">
        <h2>Warning Window — Plan Ahead</h2>
        {dashboard.warningAlerts.length === 0 ? (
          <p className="empty-state">No lots in the 30–60 day warning window.</p>
        ) : (
          <div className="alert-grid">
            {dashboard.warningAlerts.map((alert) => (
              <ExpiryAlertCard key={`${alert.lotId}-${alert.facilityId}`} alert={alert} variant="warning" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
