import { useEffect, useState } from 'react';
import { useDataPort } from '../context';
import type { MartProduct, MartPurchase, MartSupplier } from '../types';

export function PurchasesPage(): JSX.Element {
  const port = useDataPort();
  const [rows, setRows] = useState<MartPurchase[]>([]);
  const [suppliers, setSuppliers] = useState<MartSupplier[]>([]);
  const [products, setProducts] = useState<MartProduct[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('0');
  const [mrp, setMrp] = useState('0');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    const [purchases, supplierRows, productRows] = await Promise.all([
      port.listPurchases(),
      port.listSuppliers(),
      port.listProducts(),
    ]);
    setRows(purchases);
    setSuppliers(supplierRows);
    setProducts(productRows);
    if (!supplierId && supplierRows[0]) setSupplierId(supplierRows[0].id);
    if (!productId && productRows[0]) setProductId(productRows[0].id);
  };

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Load failed'));
  }, [port]);

  const create = async (): Promise<void> => {
    const product = products.find((p) => p.id === productId);
    if (!product || !supplierId) {
      setError('Select supplier and product');
      return;
    }
    try {
      await port.createPurchase({
        supplierId,
        invoiceNumber: invoiceNumber || undefined,
        invoiceDate: new Date().toISOString().slice(0, 10),
        items: [
          {
            productId: product.id,
            productName: product.name,
            barcode: product.baseBarcode,
            quantity: Number(qty) || 1,
            purchaseRate: Number(rate) || 0,
            mrp: Number(mrp) || 0,
            saleRate: Number(mrp) || 0,
          },
        ],
      });
      setInvoiceNumber('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  return (
    <div className="mart-page">
      <h2>Purchases</h2>
      <p className="lead">Inbound stock via purchase bills (synced when online).</p>
      {error ? <p className="mart-error">{error}</p> : null}
      <div className="mart-form">
        <select className="mart-select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select className="mart-select" value={productId} onChange={(e) => setProductId(e.target.value)}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input className="mart-input" placeholder="Invoice #" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
        <input className="mart-input" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
        <input className="mart-input" placeholder="Purchase rate" value={rate} onChange={(e) => setRate(e.target.value)} />
        <input className="mart-input" placeholder="MRP" value={mrp} onChange={(e) => setMrp(e.target.value)} />
        <button type="button" className="mart-btn" onClick={() => void create()}>Create purchase</button>
      </div>
      <div className="mart-table-wrap">
        <table className="mart-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Total</th>
              <th>Status</th>
              <th>Sync</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.invoiceNumber ?? row.id.slice(0, 8)}</td>
                <td>{row.invoiceDate}</td>
                <td>₹{Number(row.grandTotal).toFixed(2)}</td>
                <td>{row.status}</td>
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
