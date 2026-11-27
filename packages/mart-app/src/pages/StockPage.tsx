import { useEffect, useState } from 'react';
import { useDataPort } from '../context';
import type { MartStockRow } from '../types';

export function StockPage(): JSX.Element {
  const port = useDataPort();
  const [rows, setRows] = useState<MartStockRow[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MartStockRow | null>(null);
  const [qty, setQty] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    try {
      setRows(await port.listStock(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock');
    }
  };

  useEffect(() => {
    void load();
  }, [port]);

  return (
    <div className="mart-page">
      <h2>Stock</h2>
      <p className="lead">Lot inventory, dump and correction (queued for sync offline).</p>
      {error ? <p className="mart-error">{error}</p> : null}
      <div className="mart-toolbar">
        <input className="mart-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
        <button type="button" className="mart-btn mart-btn--ghost" onClick={() => void load()}>Search</button>
      </div>
      {selected ? (
        <div className="mart-form">
          <strong>{selected.productName}</strong>
          <span className="mart-muted">Lot {selected.lotBarcode} · on hand {selected.quantityOnHand}</span>
          <input className="mart-input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Quantity / new qty" />
          <button
            type="button"
            className="mart-btn mart-btn--danger"
            onClick={() =>
              void port
                .dumpStock({ productId: selected.productId, lotId: selected.lotId, quantity: Number(qty) || 1 })
                .then(() => load())
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Dump failed'))
            }
          >
            Dump qty
          </button>
          <button
            type="button"
            className="mart-btn"
            onClick={() =>
              void port
                .correctStock({
                  productId: selected.productId,
                  lotId: selected.lotId,
                  newQuantity: Number(qty) || 0,
                })
                .then(() => load())
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Correct failed'))
            }
          >
            Set quantity
          </button>
          <button type="button" className="mart-btn mart-btn--ghost" onClick={() => setSelected(null)}>Cancel</button>
        </div>
      ) : null}
      <div className="mart-table-wrap">
        <table className="mart-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Lot</th>
              <th>Qty</th>
              <th>MRP</th>
              <th>Expiry</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.lotId}-${row.facilityId}`}>
                <td>{row.productName}</td>
                <td>{row.lotBarcode}</td>
                <td>{row.quantityOnHand}</td>
                <td>₹{row.mrp.toFixed(2)}</td>
                <td>{String(row.expiryDate).slice(0, 10)}</td>
                <td>
                  <button type="button" className="mart-btn mart-btn--ghost" onClick={() => setSelected(row)}>
                    Adjust
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
