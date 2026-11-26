import { ExpiryAlert } from '../services/api';

interface ExpiryAlertCardProps {
  alert: ExpiryAlert;
  variant: 'critical' | 'warning';
}

export function ExpiryAlertCard({ alert, variant }: ExpiryAlertCardProps): JSX.Element {
  const badgeClass = variant === 'critical' ? 'badge-critical' : 'badge-warning';

  return (
    <article className={`alert-card alert-card--${variant}`}>
      <header className="alert-card__header">
        <span className={`badge ${badgeClass}`}>{alert.priority}</span>
        <span className="alert-card__days">{alert.daysUntilExpiry} days left</span>
      </header>
      <h3 className="alert-card__title">{alert.productName}</h3>
      <dl className="alert-card__meta">
        <div>
          <dt>SKU</dt>
          <dd>{alert.productSku}</dd>
        </div>
        <div>
          <dt>Batch</dt>
          <dd>{alert.batchNumber}</dd>
        </div>
        <div>
          <dt>Facility</dt>
          <dd>{alert.facilityName}</dd>
        </div>
        <div>
          <dt>Qty On Hand</dt>
          <dd>{alert.quantityOnHand}</dd>
        </div>
        <div>
          <dt>Expiry</dt>
          <dd>{new Date(alert.expiryDate).toLocaleDateString()}</dd>
        </div>
      </dl>
      <p className="alert-card__action">{alert.recommendedAction}</p>
    </article>
  );
}
