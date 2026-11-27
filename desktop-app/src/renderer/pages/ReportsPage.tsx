import { useEffect, useState } from 'react';
import { LocalOrderInvoice, PosSession, SalesReportSummary } from '../../shared/types';

interface ReportsPageProps {
  session: PosSession;
}

export function ReportsPage({ session }: ReportsPageProps): JSX.Element {
  const [summary, setSummary] = useState<SalesReportSummary | null>(null);
  const [invoices, setInvoices] = useState<LocalOrderInvoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [report, list] = await Promise.all([
          window.posApi!.getSalesReportSummary(),
          window.posApi!.listInvoices(100),
        ]);
        setSummary(report);
        setInvoices(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports');
      }
    })();
  }, []);

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h2>Reports</h2>
          <p>{session.facility.name} — sales snapshot</p>
        </div>
      </div>

      {error !== null && <p className="error-banner">{error}</p>}

      {summary !== null && (
        <div className="report-cards report-cards--compact">
          <div className="report-card">
            <span>Sold in last hour</span>
            <strong>₹{summary.lastHourSalesTotal.toFixed(2)}</strong>
            <small>{summary.lastHourInvoiceCount} invoices</small>
          </div>
          <div className="report-card">
            <span>All-time sales</span>
            <strong>₹{summary.salesTotal.toFixed(2)}</strong>
            <small>{summary.invoiceCount} invoices</small>
          </div>
        </div>
      )}

      <h3 className="module-subtitle">Recent invoices</h3>
      <div className="item-grid-wrap">
        <table className="item-grid">
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Pay</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Synced</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-row">
                  No invoices yet — complete a sale on Sale POS
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoiceNumber}</td>
                  <td>{invoice.createdAt.replace('T', ' ').slice(0, 19)}</td>
                  <td>{invoice.customerMobile || 'Walk-in'}</td>
                  <td>{invoice.saleType}</td>
                  <td>{invoice.paymentChannel}</td>
                  <td>{invoice.status}</td>
                  <td>₹{invoice.finalPayable.toFixed(2)}</td>
                  <td>{invoice.isSynced ? 'Yes' : 'Pending'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
