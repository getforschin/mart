import { useEffect, useState } from 'react';
import { useDataPort } from '../context';
import type { MartSupplier } from '../types';

export function SuppliersPage(): JSX.Element {
  const port = useDataPort();
  const [rows, setRows] = useState<MartSupplier[]>([]);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [paySupplierId, setPaySupplierId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('CASH');
  const [ledger, setLedger] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    try {
      setRows(await port.listSuppliers());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  };

  useEffect(() => {
    void load();
  }, [port]);

  const pay = async (): Promise<void> => {
    if (!port.paySupplier || !paySupplierId) {
      setError('Payments not available');
      return;
    }
    try {
      await port.paySupplier({
        supplierId: paySupplierId,
        amount: Number(payAmount) || 0,
        paymentMode: payMode,
        entryDate: new Date().toISOString().slice(0, 10),
        remark: 'Partial settlement',
      });
      setPayAmount('');
      await load();
      if (port.getSupplierLedger) {
        setLedger(await port.getSupplierLedger(paySupplierId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    }
  };

  return (
    <div className="mart-page">
      <h2>Suppliers</h2>
      <p className="lead">Supplier master, outstanding due, and multi-payment clearance.</p>
      {error ? <p className="mart-error">{error}</p> : null}
      <div className="mart-form">
        <input className="mart-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="mart-input" placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        <button
          type="button"
          className="mart-btn"
          onClick={() =>
            void port
              .saveSupplier({ name, mobile })
              .then(() => {
                setName('');
                setMobile('');
                return load();
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Save failed'))
          }
        >
          Save supplier
        </button>
      </div>

      {port.paySupplier ? (
        <div className="mart-form">
          <strong>Pay due</strong>
          <select className="mart-select" value={paySupplierId} onChange={(e) => setPaySupplierId(e.target.value)}>
            <option value="">Select supplier</option>
            {rows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · ₹{Number(s.outstandingDue ?? 0).toFixed(2)}
              </option>
            ))}
          </select>
          <input
            className="mart-input"
            placeholder="Amount"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
          <select className="mart-select" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
            <option value="CASH">CASH</option>
            <option value="UPI">UPI</option>
            <option value="BANK">BANK</option>
            <option value="CHEQUE">CHEQUE</option>
          </select>
          <button type="button" className="mart-btn" onClick={() => void pay()}>
            Record payment
          </button>
          {port.getSupplierLedger && paySupplierId ? (
            <button
              type="button"
              className="mart-btn mart-btn--ghost"
              onClick={() =>
                void port.getSupplierLedger!(paySupplierId).then(setLedger).catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : 'Ledger failed'),
                )
              }
            >
              View ledger
            </button>
          ) : null}
        </div>
      ) : null}

      {ledger ? (
        <pre className="mart-muted" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
          {JSON.stringify(ledger, null, 2)}
        </pre>
      ) : null}

      <div className="mart-table-wrap">
        <table className="mart-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>GSTIN</th>
              <th>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.mobile ?? '—'}</td>
                <td>{row.gstin ?? '—'}</td>
                <td>₹{Number(row.outstandingDue ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
