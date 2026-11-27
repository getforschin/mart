import { useEffect, useState } from 'react';
import { useDataPort } from '../context';
import type { MartExpiryDashboard } from '../types';

export function ExpiryPage(): JSX.Element {
  const port = useDataPort();
  const [data, setData] = useState<MartExpiryDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void port
      .getExpiry()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed'));
  }, [port]);

  const alerts = [...(data?.criticalAlerts ?? []), ...(data?.warningAlerts ?? [])];

  return (
    <div className="mart-page">
      <h2>Expiry</h2>
      <p className="lead">Lots nearing expiry ({data?.totalLotsScanned ?? 0} scanned).</p>
      {error ? <p className="mart-error">{error}</p> : null}
      <div className="mart-table-wrap">
        <table className="mart-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Batch</th>
              <th>Days</th>
              <th>Qty</th>
              <th>Priority</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.lotId}>
                <td>{a.productName}</td>
                <td>{a.batchNumber}</td>
                <td>{a.daysUntilExpiry}</td>
                <td>{a.quantityOnHand}</td>
                <td>{a.priority}</td>
                <td>{a.recommendedAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
