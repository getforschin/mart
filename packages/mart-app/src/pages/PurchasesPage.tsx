import { useEffect, useMemo, useState } from 'react';
import { useDataPort } from '../context';
import type { MartProduct, MartPurchase, MartPurchaseItemInput, MartSupplier } from '../types';

interface DraftLine extends MartPurchaseItemInput {
  key: string;
}

export function PurchasesPage(): JSX.Element {
  const port = useDataPort();
  const [rows, setRows] = useState<MartPurchase[]>([]);
  const [suppliers, setSuppliers] = useState<MartSupplier[]>([]);
  const [products, setProducts] = useState<MartProduct[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [productId, setProductId] = useState('');
  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('0');
  const [mrp, setMrp] = useState('0');
  const [saleRate, setSaleRate] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentMode, setPaymentMode] = useState('CASH');
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

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);
  const grandTotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.purchaseRate, 0),
    [lines],
  );
  const paid = Math.min(Math.max(0, Number(paidAmount) || 0), grandTotal);
  const due = Math.round((grandTotal - paid) * 100) / 100;

  const addLine = (): void => {
    const quantity = Number(qty) || 1;
    const purchaseRate = Number(rate) || 0;
    const mrpValue = Number(mrp) || 0;
    const sale = Number(saleRate) || mrpValue;
    if (mode === 'existing') {
      const product = products.find((p) => p.id === productId);
      if (!product) {
        setError('Select a product');
        return;
      }
      setLines((prev) => [
        ...prev,
        {
          key: `${product.id}-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          barcode: product.baseBarcode,
          quantity,
          purchaseRate,
          mrp: mrpValue,
          saleRate: sale,
          isNewProduct: false,
        },
      ]);
    } else {
      if (!newName.trim()) {
        setError('New product name required');
        return;
      }
      setLines((prev) => [
        ...prev,
        {
          key: `new-${Date.now()}`,
          productName: newName.trim(),
          sku: newSku.trim() || undefined,
          barcode: newBarcode.trim() || undefined,
          quantity,
          purchaseRate,
          mrp: mrpValue,
          saleRate: sale,
          isNewProduct: true,
        },
      ]);
      setNewName('');
      setNewSku('');
      setNewBarcode('');
    }
    setError(null);
  };

  const create = async (): Promise<void> => {
    if (!supplierId || lines.length === 0) {
      setError('Select supplier and add at least one line');
      return;
    }
    try {
      await port.createPurchase({
        supplierId,
        invoiceNumber: invoiceNumber || undefined,
        invoiceDate: new Date().toISOString().slice(0, 10),
        paidAmount: paid,
        paymentMode: paid > 0 ? paymentMode : undefined,
        items: lines.map(({ key: _key, ...item }) => item),
      });
      setInvoiceNumber('');
      setLines([]);
      setPaidAmount('0');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  return (
    <div className="mart-page">
      <h2>Purchases</h2>
      <p className="lead">
        Multi-product supplier bills — existing or new SKUs. Pay now or keep due on supplier.
      </p>
      {error ? <p className="mart-error">{error}</p> : null}

      <div className="mart-form mart-form--wide">
        <label className="mart-field">
          <span className="mart-field__label">Supplier</span>
          <select className="mart-select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.outstandingDue ? ` · due ₹${Number(s.outstandingDue).toFixed(2)}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="mart-field">
          <span className="mart-field__label">Supplier invoice #</span>
          <input
            className="mart-input"
            placeholder="Optional"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
        </label>
        {selectedSupplier?.outstandingDue ? (
          <div className="mart-field">
            <span className="mart-field__label">Current due</span>
            <strong>₹{Number(selectedSupplier.outstandingDue).toFixed(2)}</strong>
          </div>
        ) : null}
      </div>

      <div className="mart-toolbar">
        <button
          type="button"
          className={`mart-btn ${mode === 'existing' ? '' : 'mart-btn--ghost'}`}
          onClick={() => setMode('existing')}
        >
          Existing product
        </button>
        <button
          type="button"
          className={`mart-btn ${mode === 'new' ? '' : 'mart-btn--ghost'}`}
          onClick={() => setMode('new')}
        >
          New product
        </button>
      </div>

      <div className="mart-form mart-form--wide">
        {mode === 'existing' ? (
          <label className="mart-field">
            <span className="mart-field__label">Product</span>
            <select className="mart-select" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="mart-field">
              <span className="mart-field__label">Product name</span>
              <input
                className="mart-input"
                placeholder="Required"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <label className="mart-field">
              <span className="mart-field__label">SKU</span>
              <input
                className="mart-input"
                placeholder="Optional"
                value={newSku}
                onChange={(e) => setNewSku(e.target.value)}
              />
            </label>
            <label className="mart-field">
              <span className="mart-field__label">Barcode</span>
              <input
                className="mart-input"
                placeholder="Optional"
                value={newBarcode}
                onChange={(e) => setNewBarcode(e.target.value)}
              />
            </label>
          </>
        )}
        <label className="mart-field">
          <span className="mart-field__label">Qty</span>
          <input className="mart-input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <label className="mart-field">
          <span className="mart-field__label">Purchase rate</span>
          <input className="mart-input" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <label className="mart-field">
          <span className="mart-field__label">MRP</span>
          <input className="mart-input" inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)} />
        </label>
        <label className="mart-field">
          <span className="mart-field__label">Sale rate</span>
          <input
            className="mart-input"
            inputMode="decimal"
            value={saleRate}
            onChange={(e) => setSaleRate(e.target.value)}
          />
        </label>
        <div className="mart-field mart-field--action">
          <span className="mart-field__label">&nbsp;</span>
          <button type="button" className="mart-btn mart-btn--ghost" onClick={addLine}>
            Add line
          </button>
        </div>
      </div>

      {lines.length > 0 ? (
        <div className="mart-table-wrap">
          <table className="mart-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key}>
                  <td>
                    {line.productName}
                    {line.isNewProduct ? ' · new' : ''}
                  </td>
                  <td>{line.quantity}</td>
                  <td>₹{line.purchaseRate.toFixed(2)}</td>
                  <td>₹{(line.quantity * line.purchaseRate).toFixed(2)}</td>
                  <td>
                    <button
                      type="button"
                      className="mart-btn mart-btn--ghost"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mart-form mart-form--wide">
        <div className="mart-field">
          <span className="mart-field__label">Bill total</span>
          <strong>₹{grandTotal.toFixed(2)}</strong>
        </div>
        <label className="mart-field">
          <span className="mart-field__label">Paid now</span>
          <input
            className="mart-input"
            inputMode="decimal"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
          />
        </label>
        <label className="mart-field">
          <span className="mart-field__label">Payment mode</span>
          <select className="mart-select" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
            <option value="CASH">CASH</option>
            <option value="UPI">UPI</option>
            <option value="BANK">BANK</option>
            <option value="CHEQUE">CHEQUE</option>
          </select>
        </label>
        <div className="mart-field">
          <span className="mart-field__label">Due on supplier</span>
          <strong>₹{due.toFixed(2)}</strong>
        </div>
        <div className="mart-field mart-field--action">
          <span className="mart-field__label">&nbsp;</span>
          <button type="button" className="mart-btn" onClick={() => void create()}>
            Save purchase
          </button>
        </div>
      </div>

      <div className="mart-table-wrap">
        <table className="mart-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Due</th>
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
                <td>₹{Number(row.paidAmount ?? 0).toFixed(2)}</td>
                <td>₹{Number(row.dueAmount ?? 0).toFixed(2)}</td>
                <td>{row.paymentStatus ?? row.status}</td>
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
