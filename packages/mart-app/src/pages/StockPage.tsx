import { useEffect, useState } from 'react';
import { useDataPort } from '../context';
import type { MartStockRow, MartStocktakeSession } from '../types';

export function StockPage(): JSX.Element {
  const port = useDataPort();
  const [rows, setRows] = useState<MartStockRow[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MartStockRow | null>(null);
  const [qty, setQty] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [stocktake, setStocktake] = useState<MartStocktakeSession | null>(null);
  const [sessions, setSessions] = useState<MartStocktakeSession[]>([]);

  const load = async (): Promise<void> => {
    try {
      setRows(await port.listStock(query));
      if (port.listStocktakes) {
        setSessions(await port.listStocktakes());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock');
    }
  };

  useEffect(() => {
    void load();
  }, [port]);

  const startStocktake = async (): Promise<void> => {
    if (!port.startStocktake) {
      setError('Stocktake not available on this port');
      return;
    }
    try {
      const session = await port.startStocktake('Physical count');
      setStocktake(session);
      setSessions(await (port.listStocktakes?.() ?? Promise.resolve([])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start stocktake');
    }
  };

  const openStocktake = async (sessionId: string): Promise<void> => {
    if (!port.getStocktake) return;
    try {
      setStocktake(await port.getStocktake(sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open stocktake');
    }
  };

  const saveCount = async (lotId: string, countedQty: number): Promise<void> => {
    if (!port.updateStocktakeCount || !stocktake) return;
    try {
      setStocktake(
        await port.updateStocktakeCount({
          sessionId: stocktake.id,
          lotId,
          countedQty,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save count');
    }
  };

  const commit = async (): Promise<void> => {
    if (!port.commitStocktake || !stocktake) return;
    try {
      const done = await port.commitStocktake(stocktake.id);
      setStocktake(done);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit failed');
    }
  };

  return (
    <div className="mart-page">
      <h2>Stock</h2>
      <p className="lead">Lot inventory, dump/correction, and physical stocktake.</p>
      {error ? <p className="mart-error">{error}</p> : null}
      <div className="mart-toolbar">
        <input className="mart-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
        <button type="button" className="mart-btn mart-btn--ghost" onClick={() => void load()}>
          Search
        </button>
        {port.startStocktake ? (
          <button type="button" className="mart-btn" onClick={() => void startStocktake()}>
            Start stocktake
          </button>
        ) : null}
      </div>

      {sessions.length > 0 ? (
        <div className="mart-toolbar">
          <label>
            Stocktake sessions
            <select
              className="mart-input"
              value={stocktake?.id ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                if (id) void openStocktake(id);
                else setStocktake(null);
              }}
            >
              <option value="">Select…</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.status} · {String(s.createdAt).slice(0, 19)}
                </option>
              ))}
            </select>
          </label>
          {stocktake?.status === 'IN_PROGRESS' ? (
            <>
              <button type="button" className="mart-btn" onClick={() => void commit()}>
                Commit variance
              </button>
              {port.cancelStocktake ? (
                <button
                  type="button"
                  className="mart-btn mart-btn--ghost"
                  onClick={() =>
                    void port.cancelStocktake!(stocktake.id).then(setStocktake).then(() => load())
                  }
                >
                  Cancel
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {stocktake ? (
        <div className="mart-table-wrap">
          <h3>
            Stocktake {stocktake.status}
            {stocktake.remark ? ` — ${stocktake.remark}` : ''}
          </h3>
          <table className="mart-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Batch</th>
                <th>Expected</th>
                <th>Counted</th>
                <th>Variance</th>
              </tr>
            </thead>
            <tbody>
              {stocktake.lines.map((line) => {
                const counted = line.countedQty;
                const variance = counted == null ? null : counted - line.expectedQty;
                return (
                  <tr key={line.id}>
                    <td>{line.productName ?? line.productId}</td>
                    <td>{line.batchNumber ?? '—'}</td>
                    <td>{line.expectedQty}</td>
                    <td>
                      {stocktake.status === 'IN_PROGRESS' ? (
                        <input
                          className="mart-input"
                          type="number"
                          min={0}
                          defaultValue={counted ?? ''}
                          onBlur={(e) => {
                            const value = Number(e.target.value);
                            if (!Number.isFinite(value)) return;
                            void saveCount(line.lotId, value);
                          }}
                        />
                      ) : (
                        counted ?? '—'
                      )}
                    </td>
                    <td>{variance == null ? '—' : variance}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected ? (
        <div className="mart-form">
          <strong>{selected.productName}</strong>
          <span className="mart-muted">
            Lot {selected.lotBarcode} · on hand {selected.quantityOnHand}
          </span>
          <input
            className="mart-input"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Quantity / new qty"
          />
          <button
            type="button"
            className="mart-btn mart-btn--danger"
            onClick={() =>
              void port
                .dumpStock({
                  productId: selected.productId,
                  lotId: selected.lotId,
                  quantity: Number(qty) || 1,
                })
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
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : 'Correct failed'),
                )
            }
          >
            Set quantity
          </button>
          <button type="button" className="mart-btn mart-btn--ghost" onClick={() => setSelected(null)}>
            Cancel
          </button>
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
                  <button
                    type="button"
                    className="mart-btn mart-btn--ghost"
                    onClick={() => setSelected(row)}
                  >
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
