import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useDataPort } from '../context';
import type {
  MartBarcodeLot,
  MartBarcodeResolution,
  MartCustomer,
  MartProductSearchHit,
} from '../types';

type SaleType = 'CASH_SALE' | 'CREDIT_SALE' | 'RETURN';
type PayChannel = 'CASH' | 'CARD' | 'UPI' | 'CREDIT';

interface CartLine {
  lineId: string;
  productId: string;
  lotId: string;
  barcode: string;
  productName: string;
  productSku: string;
  company: string;
  size: string;
  batchNumber: string;
  quantity: number;
  mrp: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  netAmount: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function recalc(line: CartLine): CartLine {
  const qty = Math.max(1, Math.floor(line.quantity) || 1);
  const lineSale = round2(line.unitPrice * qty);
  const discountAmount = round2((lineSale * (line.discountPercent || 0)) / 100);
  return {
    ...line,
    quantity: qty,
    discountAmount,
    netAmount: round2(lineSale - discountAmount),
  };
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function looksLikeBarcode(value: string): boolean {
  const trimmed = value.trim();
  if (/^LOT-/i.test(trimmed)) return true;
  if (/^\d{8,14}$/.test(trimmed)) return true;
  return false;
}

function looksLikeMobileQuery(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 3 && /^[\d\s+-]+$/.test(value.trim());
}

/**
 * POS-parity billing: mobile card layout + desktop register layout (table + side summary).
 */
export function BillingPage(): JSX.Element {
  const port = useDataPort();
  const [saleType, setSaleType] = useState<SaleType>('CASH_SALE');
  const [paymentChannel, setPaymentChannel] = useState<PayChannel>('CASH');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [billDiscountPercent, setBillDiscountPercent] = useState(0);
  const [redeemAmount, setRedeemAmount] = useState(0);
  const [couponCode, setCouponCode] = useState('');

  const [customer, setCustomer] = useState<MartCustomer | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerHits, setCustomerHits] = useState<MartCustomer[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');

  const [scanInput, setScanInput] = useState('');
  const [searchHits, setSearchHits] = useState<MartProductSearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lotModal, setLotModal] = useState<MartBarcodeResolution | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const scanRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<number | null>(null);
  const customerTimer = useRef<number | null>(null);

  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  const totals = useMemo(() => {
    const totalMrp = cart.reduce((s, i) => s + i.mrp * i.quantity, 0);
    const totalSale = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const lineDiscount = cart.reduce((s, i) => s + i.discountAmount, 0);
    const billDiscount = round2((totalSale * billDiscountPercent) / 100);
    const discountAmount = round2(lineDiscount + billDiscount + redeemAmount);
    const netBeforeRound = round2(Math.max(totalSale - discountAmount, 0));
    const rounded = Math.round(netBeforeRound);
    return {
      totalMrp: round2(totalMrp),
      totalSale: round2(totalSale),
      discountAmount,
      roundOff: round2(rounded - netBeforeRound),
      netPay: round2(rounded),
    };
  }, [cart, billDiscountPercent, redeemAmount]);

  const updateQty = (lineId: string, quantity: number): void => {
    setCart((c) => c.map((x) => (x.lineId === lineId ? recalc({ ...x, quantity }) : x)));
  };

  const updateDisc = (lineId: string, discountPercent: number): void => {
    setCart((c) => c.map((x) => (x.lineId === lineId ? recalc({ ...x, discountPercent }) : x)));
  };

  const removeLine = (lineId: string): void => {
    setCart((c) => c.filter((x) => x.lineId !== lineId));
  };

  const addLotToCart = (
    resolution: MartBarcodeResolution,
    lot: MartBarcodeLot,
    barcode: string,
  ): void => {
    const unitPrice = lot.saleRate || lot.mrp;
    setCart((prev) => {
      const existing = prev.find((l) => l.lotId === lot.id);
      if (existing) {
        return prev.map((l) =>
          l.lotId === lot.id ? recalc({ ...l, quantity: l.quantity + 1 }) : l,
        );
      }
      return [
        ...prev,
        recalc({
          lineId: newId(),
          productId: resolution.productId,
          lotId: lot.id,
          barcode,
          productName: resolution.productName,
          productSku: resolution.productSku,
          company: lot.company ?? '',
          size: lot.size ?? '',
          batchNumber: lot.batchNumber,
          quantity: 1,
          mrp: lot.mrp,
          unitPrice,
          discountPercent: 0,
          discountAmount: 0,
          netAmount: unitPrice,
        }),
      ];
    });
    setError(null);
    setScanInput('');
    setSearchOpen(false);
    scanRef.current?.focus();
  };

  const applyResolution = (resolution: MartBarcodeResolution, barcode: string): void => {
    if (resolution.resolutionType === 'MULTI_MRP_SELECTION' && resolution.candidateLots.length > 1) {
      setLotModal(resolution);
      return;
    }
    const lot = resolution.suggestedLot ?? resolution.fifoRecommendation ?? resolution.candidateLots[0];
    if (!lot) {
      setError('No stock lot found for this item');
      return;
    }
    addLotToCart(resolution, lot, barcode);
  };

  const handleScanSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const value = scanInput.trim();
    if (!value) return;
    setError(null);
    try {
      if (port.resolveBarcode && looksLikeBarcode(value)) {
        applyResolution(await port.resolveBarcode(value), value);
        return;
      }
      if (port.searchProductsForBilling) {
        const hits = await port.searchProductsForBilling(value);
        if (hits.length === 1 && port.resolveBarcode) {
          applyResolution(
            await port.resolveBarcode(hits[0].baseBarcode || hits[0].productSku),
            hits[0].baseBarcode || value,
          );
          return;
        }
        setSearchHits(hits);
        setSearchOpen(hits.length > 0);
        if (hits.length === 0) setError(`No product found for “${value}”`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    }
  };

  const runProductSearch = (value: string): void => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    const trimmed = value.trim();
    if (trimmed.length < 2 || looksLikeBarcode(trimmed) || !port.searchProductsForBilling) {
      setSearchHits([]);
      setSearchOpen(false);
      return;
    }
    searchTimer.current = window.setTimeout(() => {
      void port.searchProductsForBilling!(trimmed).then((hits) => {
        setSearchHits(hits);
        setSearchOpen(hits.length > 0);
      });
    }, 180);
  };

  const pickProductHit = async (hit: MartProductSearchHit): Promise<void> => {
    setSearchOpen(false);
    setScanInput('');
    try {
      if (!port.resolveBarcode) {
        setError('Barcode resolve not available');
        return;
      }
      const resolution = await port.resolveBarcode(hit.baseBarcode || hit.productSku);
      applyResolution(
        {
          ...resolution,
          productName: hit.productName,
          productSku: hit.productSku,
          productId: hit.productId,
        },
        hit.baseBarcode,
      );
    } catch (err) {
      try {
        const stock = await port.listStock(hit.productName);
        const lots = stock.filter((s) => s.productId === hit.productId && s.quantityOnHand > 0);
        if (!lots.length) throw new Error('Out of stock');
        const preferred = [...lots].sort((a, b) => a.mrp - b.mrp)[0];
        const candidates = lots.map((l) => ({
          id: l.lotId,
          productId: l.productId,
          batchNumber: l.batchNumber,
          costPrice: l.costPrice,
          mrp: l.mrp,
          saleRate: l.mrp,
          manufactureDate: '',
          expiryDate: l.expiryDate,
          lotBarcode: l.lotBarcode,
          quantityOnHand: l.quantityOnHand,
          aisleShelfLocation: l.aisleShelfLocation,
        }));
        if (lots.length > 1) {
          setLotModal({
            resolutionType: 'MULTI_MRP_SELECTION',
            productId: hit.productId,
            productName: hit.productName,
            productSku: hit.productSku,
            suggestedLot: null,
            candidateLots: candidates,
            fifoRecommendation: candidates[0],
          });
          return;
        }
        addLotToCart(
          {
            resolutionType: 'SINGLE_LOT',
            productId: hit.productId,
            productName: hit.productName,
            productSku: hit.productSku,
            suggestedLot: null,
            candidateLots: candidates,
            fifoRecommendation: null,
          },
          candidates[0],
          preferred.lotBarcode,
        );
      } catch (inner) {
        setError(inner instanceof Error ? inner.message : err instanceof Error ? err.message : 'Add failed');
      }
    }
  };

  const runCustomerSuggest = (value: string): void => {
    if (customerTimer.current) window.clearTimeout(customerTimer.current);
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setCustomerHits([]);
      setCustomerOpen(false);
      return;
    }
    customerTimer.current = window.setTimeout(() => {
      void port.listCustomers(trimmed).then((hits) => {
        setCustomerHits(hits);
        setCustomerOpen(true);
      });
    }, 180);
  };

  const pickCustomer = (c: MartCustomer): void => {
    setCustomer(c);
    setCustomerQuery(`${c.name} · ${c.mobile}`);
    setCustomerHits([]);
    setCustomerOpen(false);
    setNewCustomerOpen(false);
  };

  const clearCustomer = (): void => {
    setCustomer(null);
    setCustomerQuery('');
    setCustomerHits([]);
  };

  const openNewCustomer = (raw: string): void => {
    const trimmed = raw.trim();
    if (looksLikeMobileQuery(trimmed)) {
      setNewMobile(trimmed.replace(/\D/g, '').slice(0, 10));
      setNewName('');
    } else {
      setNewName(trimmed);
      setNewMobile('');
    }
    setNewCustomerOpen(true);
    setCustomerOpen(false);
  };

  const saveNewCustomer = async (): Promise<void> => {
    try {
      pickCustomer(await port.saveCustomer({ name: newName, mobile: newMobile }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save customer');
    }
  };

  const clearBill = (): void => {
    setCart([]);
    setBillDiscountPercent(0);
    setRedeemAmount(0);
    setCouponCode('');
    setMessage(null);
    setError(null);
    clearCustomer();
    setSaleType('CASH_SALE');
    setPaymentChannel('CASH');
    scanRef.current?.focus();
  };

  const completeSale = async (): Promise<void> => {
    if (!port.createSale) {
      setError('createSale is not available');
      return;
    }
    if (cart.length === 0) {
      setError('Add at least one item');
      return;
    }
    if (saleType === 'CREDIT_SALE' && !customer) {
      setError('Credit sale requires a customer');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const sale = await port.createSale({
        customerName: customer?.name ?? 'Walk-in',
        customerMobile: customer?.mobile,
        paymentChannel: saleType === 'CREDIT_SALE' ? 'CREDIT' : paymentChannel,
        saleType,
        discountTotal: totals.discountAmount,
        items: cart.map((line) => ({
          productId: line.productId,
          lotId: line.lotId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        })),
      });
      setMessage(
        `Saved ${sale.invoiceNumber ?? sale.id.slice(0, 8)} · ₹${Number(sale.finalPayable).toFixed(2)}`,
      );
      setCart([]);
      setBillDiscountPercent(0);
      setRedeemAmount(0);
      setCouponCode('');
      scanRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sale failed');
    } finally {
      setProcessing(false);
    }
  };

  const customerBlock = (
    <label className="pos-reg__field pos-reg__field--customer">
      Customer
      <div className="pos-reg__customer-row">
        <input
          value={customerQuery}
          placeholder="Type mobile or name…"
          autoComplete="off"
          onChange={(e) => {
            setCustomerQuery(e.target.value);
            if (customer) setCustomer(null);
            runCustomerSuggest(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (customerHits[0]) pickCustomer(customerHits[0]);
              else if (customerQuery.trim()) openNewCustomer(customerQuery);
            }
          }}
          onBlur={() => window.setTimeout(() => setCustomerOpen(false), 150)}
        />
        {(customer || customerQuery) && (
          <button type="button" className="pos-reg__ghost" onClick={clearCustomer}>
            ✕
          </button>
        )}
      </div>
      {customerOpen && (
        <ul className="pos-reg__suggest">
          {customerHits.length > 0 ? (
            customerHits.map((hit) => (
              <li key={hit.id}>
                <button type="button" onMouseDown={() => pickCustomer(hit)}>
                  <strong>{hit.name}</strong>
                  <span>
                    {hit.mobile}
                    {hit.previousDue > 0 ? ` · due ₹${hit.previousDue.toFixed(2)}` : ''}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li>
              <button type="button" onMouseDown={() => openNewCustomer(customerQuery)}>
                Add new customer “{customerQuery.trim()}”
              </button>
            </li>
          )}
        </ul>
      )}
    </label>
  );

  const scanBlock = (
    <form className="pos-reg__scan" onSubmit={(e) => void handleScanSubmit(e)}>
      <div className="pos-reg__scan-wrap">
        <input
          ref={scanRef}
          value={scanInput}
          placeholder="Scan barcode, or type product name…"
          autoComplete="off"
          disabled={processing}
          onChange={(e) => {
            setScanInput(e.target.value);
            runProductSearch(e.target.value);
          }}
          onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
        />
        {searchOpen && searchHits.length > 0 && (
          <ul className="pos-reg__suggest pos-reg__suggest--scan">
            {searchHits.map((hit) => (
              <li key={hit.productId}>
                <button type="button" onMouseDown={() => void pickProductHit(hit)}>
                  <strong>{hit.productName}</strong>
                  <span>
                    qty {hit.quantityOnHand} · ₹
                    {hit.mrpMin === hit.mrpMax
                      ? hit.mrpMin.toFixed(2)
                      : `${hit.mrpMin.toFixed(0)}–${hit.mrpMax.toFixed(0)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit" className="pos-reg__btn pos-reg__btn--primary" disabled={processing}>
        Add
      </button>
    </form>
  );

  const summaryBlock = (
    <div className="pos-reg__summary">
      <label>
        Apply Coupon
        <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Coupon code" />
      </label>
      <label>
        Bill Discount %
        <input
          type="number"
          min={0}
          max={100}
          value={billDiscountPercent}
          onChange={(e) => setBillDiscountPercent(Number(e.target.value))}
        />
      </label>
      <label>
        Redeem Amount
        <input
          type="number"
          min={0}
          value={redeemAmount}
          onChange={(e) => setRedeemAmount(Number(e.target.value))}
        />
      </label>

      <dl className="pos-reg__totals">
        <div>
          <dt>Total MRP</dt>
          <dd>₹{totals.totalMrp.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Total Sale</dt>
          <dd>₹{totals.totalSale.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd>₹{totals.discountAmount.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Round Off</dt>
          <dd>₹{totals.roundOff.toFixed(2)}</dd>
        </div>
        <div className="pos-reg__totals-net">
          <dt>Net Payable</dt>
          <dd>₹{totals.netPay.toFixed(2)}</dd>
        </div>
      </dl>

      <div className="pos-reg__pay">
        {(['CASH', 'CARD', 'UPI', 'CREDIT'] as const).map((ch) => (
          <button
            key={ch}
            type="button"
            className={paymentChannel === ch ? 'active' : undefined}
            disabled={saleType === 'CREDIT_SALE' && ch !== 'CREDIT'}
            onClick={() => setPaymentChannel(ch)}
          >
            {ch}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="pos-reg__btn pos-reg__btn--success pos-reg__btn--block"
        disabled={processing || cart.length === 0}
        onClick={() => void completeSale()}
      >
        {processing ? 'Saving…' : 'Save & Print Invoice'}
      </button>
      <button type="button" className="pos-reg__btn pos-reg__btn--ghost pos-reg__btn--block" onClick={clearBill}>
        Clear Bill
      </button>
      {message ? <p className="pos-reg__saved">{message}</p> : null}
    </div>
  );

  return (
    <div className="pos-reg">
      <div className="pos-reg__shortcuts">
        <span>Scan barcode or type product name</span>
        <span>Customer: mobile or name → Enter</span>
      </div>

      <section className="pos-reg__toolbar">
        <div className="pos-reg__sale-types">
          {(
            [
              ['CASH_SALE', 'Cash Sale'],
              ['CREDIT_SALE', 'Credit Sale'],
              ['RETURN', 'Return / Credit Note'],
            ] as const
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              className={saleType === type ? 'active' : undefined}
              onClick={() => {
                setSaleType(type);
                if (type === 'CREDIT_SALE') setPaymentChannel('CREDIT');
                if (type === 'CASH_SALE' && paymentChannel === 'CREDIT') setPaymentChannel('CASH');
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="pos-reg__fields">
          {customerBlock}
          <label className="pos-reg__field">
            Mode
            <input readOnly value={port.mode === 'online' ? 'Admin (online)' : 'POS (local)'} />
          </label>
        </div>
      </section>

      {error ? <p className="pos-reg__error">{error}</p> : null}

      <div className="pos-reg__main">
        <div className="pos-reg__left">
          {scanBlock}

          {/* Mobile cards */}
          <div className="pos-reg__cards">
            {cart.length === 0 ? (
              <p className="pos-reg__empty">Scan barcode or type a product name to begin billing</p>
            ) : (
              cart.map((line, index) => (
                <article key={line.lineId} className="pos-reg__card">
                  <header>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{line.productName}</strong>
                      <small>
                        {line.barcode || line.productSku}
                        {line.batchNumber ? ` · ${line.batchNumber}` : ''}
                      </small>
                    </div>
                    <button type="button" onClick={() => removeLine(line.lineId)}>
                      ✕
                    </button>
                  </header>
                  <div className="pos-reg__card-grid">
                    <label>
                      Qty
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateQty(line.lineId, Number(e.target.value))}
                      />
                    </label>
                    <label>
                      Disc %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={line.discountPercent}
                        onChange={(e) => updateDisc(line.lineId, Number(e.target.value))}
                      />
                    </label>
                    <div>
                      <small>MRP</small>
                      <strong>₹{line.mrp.toFixed(2)}</strong>
                    </div>
                    <div>
                      <small>Net</small>
                      <strong>₹{line.netAmount.toFixed(2)}</strong>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          {/* Desktop POS table */}
          <div className="pos-reg__table-wrap">
            <table className="pos-reg__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Barcode</th>
                  <th>Item</th>
                  <th>Company</th>
                  <th>Size</th>
                  <th>Batch</th>
                  <th>Qty</th>
                  <th>MRP</th>
                  <th>Sale</th>
                  <th>Disc %</th>
                  <th>Disc</th>
                  <th>Net</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="pos-reg__empty-row">
                      Scan barcode or type a product name to begin billing
                    </td>
                  </tr>
                ) : (
                  cart.map((line, index) => (
                    <tr key={line.lineId}>
                      <td>{index + 1}</td>
                      <td>{line.barcode || line.productSku}</td>
                      <td>{line.productName}</td>
                      <td>{line.company || '—'}</td>
                      <td>{line.size || '—'}</td>
                      <td>{line.batchNumber || '—'}</td>
                      <td>
                        <input
                          className="pos-reg__qty"
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) => updateQty(line.lineId, Number(e.target.value))}
                        />
                      </td>
                      <td>₹{line.mrp.toFixed(2)}</td>
                      <td>₹{line.unitPrice.toFixed(2)}</td>
                      <td>
                        <input
                          className="pos-reg__qty"
                          type="number"
                          min={0}
                          max={100}
                          value={line.discountPercent}
                          onChange={(e) => updateDisc(line.lineId, Number(e.target.value))}
                        />
                      </td>
                      <td>₹{line.discountAmount.toFixed(2)}</td>
                      <td>₹{line.netAmount.toFixed(2)}</td>
                      <td>
                        <button type="button" onClick={() => removeLine(line.lineId)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pos-reg__footer">
            Customer Previous Due: ₹{(customer?.previousDue ?? 0).toFixed(2)}
          </div>
        </div>

        <aside className="pos-reg__right">{summaryBlock}</aside>
      </div>

      {/* Mobile sticky summary (hidden on desktop) */}
      <div className="pos-reg__mobile-summary">{summaryBlock}</div>

      {lotModal && (
        <div className="pos-reg__modal" role="dialog">
          <div className="pos-reg__modal-card">
            <h3>Select MRP / lot</h3>
            <p>{lotModal.productName}</p>
            <ul>
              {lotModal.candidateLots.map((lot) => (
                <li key={lot.id}>
                  <button
                    type="button"
                    onClick={() => {
                      addLotToCart(lotModal, lot, lot.lotBarcode);
                      setLotModal(null);
                    }}
                  >
                    <strong>₹{lot.mrp.toFixed(2)}</strong>
                    <span>
                      {lot.lotBarcode} · qty {lot.quantityOnHand} · exp{' '}
                      {String(lot.expiryDate).slice(0, 10)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="pos-reg__btn pos-reg__btn--ghost" onClick={() => setLotModal(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {newCustomerOpen && (
        <div className="pos-reg__modal" role="dialog">
          <div className="pos-reg__modal-card">
            <h3>New customer</h3>
            <label>
              Name
              <input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </label>
            <label>
              Mobile
              <input value={newMobile} onChange={(e) => setNewMobile(e.target.value)} />
            </label>
            <div className="pos-reg__modal-actions">
              <button type="button" className="pos-reg__btn pos-reg__btn--primary" onClick={() => void saveNewCustomer()}>
                Save
              </button>
              <button type="button" className="pos-reg__btn pos-reg__btn--ghost" onClick={() => setNewCustomerOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
