import { useEffect, useState } from 'react';
import { useDataPort } from '../context';
import type { MartStockRow } from '../types';

/** Online/simple billing. Electron POS can override via AppShell billingSlot. */
export function BillingPage(): JSX.Element {
  const port = useDataPort();
  const [stock, setStock] = useState<MartStockRow[]>([]);
  const [lotId, setLotId] = useState('');
  const [qty, setQty] = useState('1');
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('Walk-in');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void port.listStock().then((rows) => {
      setStock(rows.filter((r) => r.quantityOnHand > 0));
      if (rows[0]) setLotId(rows[0].lotId);
    });
  }, [port]);

  const create = async (): Promise<void> => {
    if (!port.createSale) {
      setError('Billing createSale is not available on this port');
      return;
    }
    const row = stock.find((s) => s.lotId === lotId);
    if (!row) {
      setError('Select a lot');
      return;
    }
    try {
      const sale = await port.createSale({
        customerName: name,
        customerMobile: mobile || undefined,
        paymentChannel: 'CASH',
        items: [
          {
            productId: row.productId,
            lotId: row.lotId,
            quantity: Number(qty) || 1,
            unitPrice: row.mrp,
          },
        ],
      });
      setMessage(`Bill created ₹${Number(sale.finalPayable).toFixed(2)}`);
      setError(null);
      setStock(await port.listStock());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Billing failed');
    }
  };

  return (
    <div className="mart-page">
      <h2>Sale / Billing</h2>
      <p className="lead">
        {port.mode === 'offline'
          ? 'Use the POS billing screen for full offline register features.'
          : 'Quick online bill against Railway stock.'}
      </p>
      {error ? <p className="mart-error">{error}</p> : null}
      {message ? <p className="mart-muted">{message}</p> : null}
      <div className="mart-form">
        <input className="mart-input" placeholder="Customer name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="mart-input" placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        <select className="mart-select" value={lotId} onChange={(e) => setLotId(e.target.value)}>
          {stock.map((s) => (
            <option key={s.lotId} value={s.lotId}>
              {s.productName} · {s.lotBarcode} · ₹{s.mrp} · qty {s.quantityOnHand}
            </option>
          ))}
        </select>
        <input className="mart-input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" />
        <button type="button" className="mart-btn" onClick={() => void create()}>
          Create bill
        </button>
      </div>
    </div>
  );
}
