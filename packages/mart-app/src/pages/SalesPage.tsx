import { useEffect, useState } from 'react';
import { useDataPort } from '../context';
import type { MartSaleRow } from '../types';

export function SalesPage(): JSX.Element {
  const port = useDataPort();
  const [rows, setRows] = useState<MartSaleRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void port
      .listSales(100)
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed'));
  }, [port]);

  return (
    <div className="mart-page">
      <h2>Sales</h2>
      <p className="lead">Completed bills from local POS or central API.</p>
      {error ? <p className="mart-error">{error}</p> : null}
      <div className="mart-table-wrap">
        <table className="mart-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Pay</th>
              <th>When</th>
              <th>Sync</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.invoiceNumber ?? row.id.slice(0, 8)}</td>
                <td>{row.customerName ?? '—'}</td>
                <td>₹{Number(row.finalPayable).toFixed(2)}</td>
                <td>{row.paymentChannel}</td>
                <td>{String(row.createdAt).replace('T', ' ').slice(0, 19)}</td>
                <td>
                  {row.isSynced === 0 ? (
                    <span className="mart-badge mart-badge--warn">Pending</span>
                  ) : (
                    <span className="mart-badge">Synced</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
