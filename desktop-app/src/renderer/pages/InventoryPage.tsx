import { useEffect, useState } from 'react';
import { InventoryRow, PosSession } from '../../shared/types';

interface InventoryPageProps {
  session: PosSession;
}

type SortBy = 'name' | 'mrp' | 'qty';

export function InventoryPage({ session }: InventoryPageProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('name');

  const load = async (search: string, stockOnly: boolean, sort: SortBy): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.posApi!.listInventory(search, {
        inStockOnly: stockOnly,
        sortBy: sort,
      });
      setRows(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load('', true, 'name');
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(query, inStockOnly, sortBy);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, inStockOnly, sortBy]);

  const totalQty = rows.reduce((sum, row) => sum + row.quantityOnHand, 0);

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h2>Inventory</h2>
          <p>
            {session.facility.name} — {rows.length} lots · {totalQty} units
          </p>
        </div>
        <div className="module-toolbar">
          <label className="filter-check">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
            />
            In stock only
          </label>
          <label className="filter-select">
            Sort
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
              <option value="name">Name</option>
              <option value="mrp">MRP</option>
              <option value="qty">Quantity</option>
            </select>
          </label>
          <input
            className="module-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, SKU, barcode…"
          />
        </div>
      </div>

      {error !== null && <p className="error-banner">{error}</p>}
      {loading && <p className="muted">Loading…</p>}

      <div className="item-grid-wrap">
        <table className="item-grid">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Barcode</th>
              <th>Item</th>
              <th>Company</th>
              <th>Batch</th>
              <th>MRP</th>
              <th>Sale</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-row">
                  No inventory rows found
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={row.quantityOnHand <= 0 ? 'row-muted' : undefined}>
                  <td>{row.productSku}</td>
                  <td>{row.baseBarcode}</td>
                  <td>{row.productName}</td>
                  <td>{row.company || '—'}</td>
                  <td>{row.batchNumber}</td>
                  <td>₹{row.mrp.toFixed(2)}</td>
                  <td>₹{(row.saleRate || row.mrp).toFixed(2)}</td>
                  <td>
                    <strong>{row.quantityOnHand}</strong>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
