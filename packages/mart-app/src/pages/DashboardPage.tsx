import { useEffect, useState } from 'react';
import { useDataPort } from '../context';
import type { MartDashboard } from '../types';

export function DashboardPage(): JSX.Element {
  const port = useDataPort();
  const [data, setData] = useState<MartDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void port
      .getDashboard()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [port]);

  return (
    <div className="mart-page">
      <h2>Dashboard</h2>
      <p className="lead">Store overview from {port.mode === 'offline' ? 'local POS data' : 'Railway API'}.</p>
      {error ? <p className="mart-error">{error}</p> : null}
      <div className="mart-cards">
        <div className="mart-card">
          <span>Products</span>
          <strong>{Number(data?.totalProducts ?? 0)}</strong>
        </div>
        <div className="mart-card">
          <span>Customers</span>
          <strong>{Number(data?.totalCustomers ?? 0)}</strong>
        </div>
        <div className="mart-card">
          <span>Sales</span>
          <strong>{Number(data?.totalSales ?? 0)}</strong>
        </div>
        <div className="mart-card">
          <span>Low stock</span>
          <strong>{Number(data?.lowStockCount ?? 0)}</strong>
        </div>
      </div>
    </div>
  );
}
