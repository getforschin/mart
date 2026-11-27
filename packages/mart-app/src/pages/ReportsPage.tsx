import { useEffect, useState } from 'react';
import { useDataPort } from '../context';

function money(value: unknown): string {
  return `₹${Number(value ?? 0).toFixed(2)}`;
}

export function ReportsPage(): JSX.Element {
  const port = useDataPort();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [pnl, setPnl] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const monthStart = new Date().toISOString().slice(0, 8) + '01';
    const today = new Date().toISOString().slice(0, 10);
    void Promise.all([
      port.getReports(),
      port.getProfitLoss?.(monthStart, today) ?? Promise.resolve(null),
    ])
      .then(([reports, profitLoss]) => {
        setData(reports);
        setPnl((profitLoss as Record<string, unknown> | null) ?? (reports.profitLoss as Record<string, unknown>) ?? null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed'));
  }, [port]);

  const summary = (data?.summary as Record<string, unknown> | undefined) ?? {};

  return (
    <div className="mart-page">
      <h2>Reports</h2>
      <p className="lead">Sales, purchases, expenses, and period profit/loss.</p>
      {error ? <p className="mart-error">{error}</p> : null}

      <h3>This month P&amp;L</h3>
      <div className="mart-cards">
        <div className="mart-card">
          <span>Income (net sales)</span>
          <strong>{money(pnl?.income ?? summary.saleTotal)}</strong>
        </div>
        <div className="mart-card">
          <span>Purchase spend</span>
          <strong>{money(pnl?.costs ?? summary.purchaseTotal)}</strong>
        </div>
        <div className="mart-card">
          <span>Expenses</span>
          <strong>{money(pnl?.expenses ?? summary.expenseTotal)}</strong>
        </div>
        <div className="mart-card">
          <span>Result</span>
          <strong>{money(pnl?.result ?? summary.profitEstimate)}</strong>
        </div>
      </div>

      <h3>Balances</h3>
      <div className="mart-cards">
        <div className="mart-card">
          <span>Customer due</span>
          <strong>{money(summary.customerDue)}</strong>
        </div>
        <div className="mart-card">
          <span>Supplier due</span>
          <strong>{money(summary.supplierDue)}</strong>
        </div>
        <div className="mart-card">
          <span>Stock value</span>
          <strong>{money(summary.stockValue)}</strong>
        </div>
      </div>
    </div>
  );
}
