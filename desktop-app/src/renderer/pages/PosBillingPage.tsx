import { useEffect, useRef, useState } from 'react';
import {
  InvoiceStatus,
  LocalProductLot,
  PaymentChannel,
  PosCustomer,
  PosSession,
  ProductSearchHit,
  SaleType,
} from '../../shared/types';
import { usePosBilling } from '../hooks/usePosBilling';
import { LotSelectionModal } from '../components/LotSelectionModal';
import { CustomerEntryModal } from '../components/CustomerEntryModal';

interface PosBillingPageProps {
  session: PosSession;
  onLogout?: () => void;
  embedded?: boolean;
}

function formatCustomerLabel(customer: PosCustomer): string {
  return `${customer.name} · ${customer.mobile}`;
}

function looksLikeMobileQuery(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 3 && /^[\d\s+-]+$/.test(value.trim());
}

export function PosBillingPage({ session, onLogout, embedded = false }: PosBillingPageProps): JSX.Element {
  const billing = usePosBilling(session);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchHits, setSearchHits] = useState<ProductSearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerHits, setCustomerHits] = useState<PosCustomer[]>([]);
  const [customerSuggestOpen, setCustomerSuggestOpen] = useState(false);
  const [customerModal, setCustomerModal] = useState<{
    name: string;
    mobile: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<number | null>(null);
  const customerTimer = useRef<number | null>(null);

  useEffect(() => {
    if (billing.customer) {
      setCustomerQuery(formatCustomerLabel(billing.customer));
      setCustomerHits([]);
      setCustomerSuggestOpen(false);
    } else if (!billing.customerMobile && !billing.customerName) {
      setCustomerQuery('');
    }
  }, [billing.customer, billing.customerMobile, billing.customerName]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'F2' || event.key === 'F3') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const runSearch = (value: string): void => {
    if (searchTimer.current !== null) {
      window.clearTimeout(searchTimer.current);
    }
    const trimmed = value.trim();
    if (trimmed.length < 2 || looksLikeBarcode(trimmed)) {
      setSearchHits([]);
      setSearchOpen(false);
      return;
    }
    searchTimer.current = window.setTimeout(() => {
      void billing.searchProducts(trimmed).then((hits) => {
        setSearchHits(hits);
        setSearchOpen(hits.length > 0);
      });
    }, 180);
  };

  const runCustomerSuggest = (value: string): void => {
    if (customerTimer.current !== null) {
      window.clearTimeout(customerTimer.current);
    }
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setCustomerHits([]);
      setCustomerSuggestOpen(false);
      return;
    }
    customerTimer.current = window.setTimeout(() => {
      void billing.searchCustomers(trimmed).then((hits) => {
        setCustomerHits(hits);
        setCustomerSuggestOpen(true);
      });
    }, 180);
  };

  const openNewCustomerModal = (raw: string): void => {
    const trimmed = raw.trim();
    if (looksLikeMobileQuery(trimmed)) {
      setCustomerModal({
        name: '',
        mobile: trimmed.replace(/\D/g, '').slice(0, 10),
      });
    } else {
      setCustomerModal({
        name: trimmed,
        mobile: '',
      });
    }
    setCustomerSuggestOpen(false);
  };

  const handleScan = (event: React.FormEvent): void => {
    event.preventDefault();
    const value = barcodeInput.trim();
    if (!value) return;

    if (!looksLikeBarcode(value)) {
      void (async () => {
        try {
          const hits =
            searchHits.length > 0 ? searchHits : await billing.searchProducts(value);
          if (hits.length === 0) {
            billing.setScanError(`No products matching "${value}"`);
            setSearchHits([]);
            setSearchOpen(false);
            return;
          }
          setSearchHits(hits);
          setSearchOpen(true);
          await pickProduct(hits[0]);
        } catch (error) {
          billing.setScanError(
            error instanceof Error ? error.message : 'Product search failed',
          );
        }
      })();
      return;
    }

    void billing.scanBarcode(value);
    setBarcodeInput('');
    setSearchHits([]);
    setSearchOpen(false);
    inputRef.current?.focus();
  };

  const pickProduct = async (hit: ProductSearchHit): Promise<void> => {
    setBarcodeInput('');
    setSearchHits([]);
    setSearchOpen(false);
    await billing.addProductByBarcode(hit.baseBarcode);
    inputRef.current?.focus();
  };

  const pickCustomer = (selected: PosCustomer): void => {
    billing.applyCustomer(selected);
    setCustomerQuery(formatCustomerLabel(selected));
    setCustomerHits([]);
    setCustomerSuggestOpen(false);
    setCustomerModal(null);
  };

  const handleCustomerQueryChange = (value: string): void => {
    setCustomerQuery(value);
    if (billing.customer) {
      billing.clearCustomer();
    }
    runCustomerSuggest(value);
  };

  const handleCustomerEnter = async (): Promise<void> => {
    const trimmed = customerQuery.trim();
    if (!trimmed) return;

    const hits =
      customerHits.length > 0 ? customerHits : await billing.searchCustomers(trimmed);

    if (hits.length > 0) {
      pickCustomer(hits[0]);
      return;
    }

    openNewCustomerModal(trimmed);
  };

  const handleCustomerKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleCustomerEnter();
      return;
    }
    if (event.key === 'Escape') {
      setCustomerSuggestOpen(false);
      if (billing.customer) {
        setCustomerQuery(formatCustomerLabel(billing.customer));
      }
    }
    if (event.key === 'ArrowDown' && customerHits.length > 0) {
      event.preventDefault();
      setCustomerSuggestOpen(true);
    }
  };

  const handleClearCustomer = (): void => {
    billing.clearCustomer();
    setCustomerQuery('');
    setCustomerHits([]);
    setCustomerSuggestOpen(false);
    customerInputRef.current?.focus();
  };

  const handleDeleteDraft = (): void => {
    if (!billing.draftId) return;
    const ok = window.confirm(`Delete draft ${billing.draftInvoiceNumber}?`);
    if (!ok) return;
    void billing.deleteDraft(billing.draftId);
  };

  return (
    <div className={`billing-app ${embedded ? 'billing-app--embedded' : ''}`}>
      {!embedded && (
        <header className="billing-topbar">
          <div className="billing-topbar__left">
            <strong>{billing.config?.shopName ?? 'Mart POS'}</strong>
            <span>{session.facility.name}</span>
            <span className={`status-pill ${billing.isOnline ? 'online' : 'offline'}`}>
              {billing.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="billing-topbar__right">
            <span>{session.user.displayName}</span>
            {onLogout && (
              <button type="button" className="btn btn--ghost" onClick={onLogout}>
                Logout
              </button>
            )}
          </div>
        </header>
      )}

      <div className="shortcut-bar">
        <span>F2 / F3 Item search or barcode</span>
        <span>Customer: type mobile or name → Enter</span>
        <span className={`status-pill ${billing.isOnline ? 'online' : 'offline'}`}>
          {billing.isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      <section className="billing-toolbar">
        <div className="sale-type-group">
          {[
            { type: SaleType.CASH_SALE, label: 'Cash Sale' },
            { type: SaleType.CREDIT_SALE, label: 'Credit Sale' },
            { type: SaleType.RETURN, label: 'Return / Credit Note' },
          ].map(({ type, label }) => (
            <button
              key={type}
              type="button"
              className={`sale-type-btn ${billing.saleType === type ? 'active' : ''}`}
              onClick={() => billing.setSaleType(type)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="billing-fields">
          <label>
            Invoice No
            <input
              readOnly
              value={billing.draftInvoiceNumber ?? billing.nextInvoicePreview}
              title={
                billing.draftId
                  ? 'Editing draft — number kept on complete'
                  : 'DDMMYYYY + daily sequence (assigned at save)'
              }
            />
          </label>
          <div className="draft-controls">
            <label>
              Open Draft
              <select
                value={billing.draftId ?? ''}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) {
                    billing.clearCart();
                    return;
                  }
                  void billing.loadDraft(id);
                }}
                disabled={billing.processing}
              >
                <option value="">New bill</option>
                {billing.drafts.map((draft) => (
                  <option key={draft.id} value={draft.id}>
                    {draft.invoiceNumber} · ₹{draft.finalPayable.toFixed(2)} ·{' '}
                    {draft.customerMobile || 'Walk-in'}
                  </option>
                ))}
              </select>
            </label>
            {billing.draftId && (
              <button
                type="button"
                className="btn btn--ghost draft-delete-btn"
                disabled={billing.processing}
                onClick={handleDeleteDraft}
              >
                Delete draft
              </button>
            )}
          </div>
          <label className="billing-field--suggest billing-field--customer">
            Customer
            <div className="customer-search-row">
              <input
                ref={customerInputRef}
                value={customerQuery}
                onChange={(e) => handleCustomerQueryChange(e.target.value)}
                onKeyDown={handleCustomerKeyDown}
                onBlur={() => {
                  window.setTimeout(() => setCustomerSuggestOpen(false), 150);
                }}
                onFocus={() => {
                  if (customerQuery.trim().length >= 2) {
                    runCustomerSuggest(customerQuery);
                  }
                }}
                placeholder="Type mobile or name…"
                autoComplete="off"
              />
              {(billing.customer || customerQuery) && (
                <button
                  type="button"
                  className="btn btn--ghost customer-clear-btn"
                  onClick={handleClearCustomer}
                  title="Clear customer"
                >
                  ✕
                </button>
              )}
            </div>
            {customerSuggestOpen && (
              <ul className="product-suggest customer-suggest">
                {customerHits.length > 0 ? (
                  customerHits.map((hit) => (
                    <li key={hit.id}>
                      <button type="button" onMouseDown={() => pickCustomer(hit)}>
                        <span className="product-suggest__name">{hit.name}</span>
                        <span className="product-suggest__meta">
                          {hit.mobile}
                          {hit.previousDue > 0
                            ? ` · due ₹${hit.previousDue.toFixed(2)}`
                            : ''}
                        </span>
                      </button>
                    </li>
                  ))
                ) : (
                  <li>
                    <button
                      type="button"
                      className="customer-suggest__new"
                      onMouseDown={() => openNewCustomerModal(customerQuery)}
                    >
                      <span className="product-suggest__name">
                        Add new customer “{customerQuery.trim()}”
                      </span>
                      <span className="product-suggest__meta">Press Enter to create</span>
                    </button>
                  </li>
                )}
              </ul>
            )}
          </label>
          <label>
            Employee
            <input readOnly value={session.user.displayName} />
          </label>
        </div>
      </section>

      <div className="billing-main">
        <div className="billing-left">
          <form onSubmit={handleScan} className="scan-row scan-row--search">
            <div className="scan-input-wrap">
              <input
                ref={inputRef}
                value={barcodeInput}
                onChange={(e) => {
                  setBarcodeInput(e.target.value);
                  runSearch(e.target.value);
                }}
                onFocus={() => {
                  if (searchHits.length > 0) setSearchOpen(true);
                }}
                onBlur={() => {
                  window.setTimeout(() => setSearchOpen(false), 150);
                }}
                placeholder="Scan barcode, or type product name…"
                disabled={billing.processing}
                autoComplete="off"
              />
              {searchOpen && searchHits.length > 0 && (
                <ul className="product-suggest">
                  {searchHits.map((hit) => (
                    <li key={hit.productId}>
                      <button type="button" onMouseDown={() => void pickProduct(hit)}>
                        <span className="product-suggest__name">{hit.productName}</span>
                        <span className="product-suggest__meta">
                          {hit.baseBarcode} · qty {hit.quantityOnHand} · ₹
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
            <button type="submit" className="btn btn--primary">
              Add
            </button>
          </form>

          {billing.scanError !== null && <p className="error-banner">{billing.scanError}</p>}

          <div className="item-grid-wrap">
            <table className="item-grid">
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
                {billing.cartItems.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="empty-row">
                      Scan barcode or type a product name to begin billing
                    </td>
                  </tr>
                ) : (
                  billing.cartItems.map((item, index) => (
                    <tr key={item.lineId}>
                      <td>{index + 1}</td>
                      <td>{item.barcode || item.productSku}</td>
                      <td>{item.productName}</td>
                      <td>{item.company}</td>
                      <td>{item.size}</td>
                      <td>{item.batchNumber}</td>
                      <td>
                        <input
                          className="qty-input"
                          type="number"
                          min={1}
                          step={1}
                          value={item.quantity}
                          onChange={(e) =>
                            billing.updateLineQuantity(item.lineId, Number(e.target.value))
                          }
                        />
                      </td>
                      <td>₹{item.mrp.toFixed(2)}</td>
                      <td>₹{item.unitPrice.toFixed(2)}</td>
                      <td>
                        <input
                          className="qty-input"
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={item.discountPercent}
                          onChange={(e) =>
                            billing.updateLineDiscountPercent(
                              item.lineId,
                              Number(e.target.value),
                            )
                          }
                        />
                      </td>
                      <td>₹{item.discountAmount.toFixed(2)}</td>
                      <td>₹{item.netAmount.toFixed(2)}</td>
                      <td>
                        <button type="button" onClick={() => billing.removeLine(item.lineId)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="billing-footer">
            <span>
              Customer Previous Due: ₹{(billing.customer?.previousDue ?? 0).toFixed(2)}
            </span>
          </div>
        </div>

        <aside className="billing-right">
          <div className="summary-card">
            <label>
              Apply Coupon
              <input
                value={billing.couponCode}
                onChange={(e) => billing.setCouponCode(e.target.value)}
                placeholder="Coupon code"
              />
            </label>
            <label>
              Bill Discount %
              <input
                type="number"
                min={0}
                max={100}
                value={billDiscountPercentSafe(billing.billDiscountPercent)}
                onChange={(e) => billing.setBillDiscountPercent(Number(e.target.value))}
              />
            </label>
            <label>
              Redeem Amount
              <input
                type="number"
                min={0}
                value={billing.redeemAmount}
                onChange={(e) => billing.setRedeemAmount(Number(e.target.value))}
              />
            </label>

            <dl className="summary-lines">
              <div>
                <dt>Total MRP</dt>
                <dd>₹{billing.totals.totalMrp.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Total Sale</dt>
                <dd>₹{billing.totals.totalSale.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Discount</dt>
                <dd>₹{billing.totals.discountAmount.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Round Off</dt>
                <dd>₹{billing.totals.roundOff.toFixed(2)}</dd>
              </div>
              <div className="summary-lines__total">
                <dt>Net Payable</dt>
                <dd>₹{billing.totals.netPay.toFixed(2)}</dd>
              </div>
            </dl>

            <div className="payment-row">
              {[
                PaymentChannel.CASH,
                PaymentChannel.CARD,
                PaymentChannel.UPI,
                PaymentChannel.CREDIT,
              ].map((channel) => (
                <button
                  key={channel}
                  type="button"
                  className={`pay-btn ${billing.paymentChannel === channel ? 'active' : ''}`}
                  onClick={() => billing.setPaymentChannel(channel)}
                >
                  {channel}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn btn--success btn--block"
              disabled={billing.processing}
              onClick={() => void billing.saveInvoice(InvoiceStatus.COMPLETED)}
            >
              Save &amp; Print Invoice
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--block"
              disabled={billing.processing}
              onClick={() => void billing.saveInvoice(InvoiceStatus.DRAFT)}
            >
              {billing.draftId ? 'Update Draft' : 'Save as Draft'}
            </button>
            <button type="button" className="btn btn--ghost btn--block" onClick={billing.clearCart}>
              {billing.draftId ? 'Close Draft / New Bill' : 'Clear Bill'}
            </button>

            {billing.draftId && (
              <p className="last-invoice">Editing draft {billing.draftInvoiceNumber}</p>
            )}

            {billing.lastInvoice !== null && (
              <p className="last-invoice">
                Saved: {billing.lastInvoice.invoiceNumber} — ₹
                {billing.lastInvoice.finalPayable.toFixed(2)} (
                {billing.lastInvoice.status})
              </p>
            )}
          </div>
        </aside>
      </div>

      {billing.lotSelection !== null && (
        <LotSelectionModal
          productName={billing.lotSelection.resolution.productName}
          candidates={billing.lotSelection.resolution.candidateLots}
          fifoRecommendation={billing.lotSelection.resolution.fifoRecommendation}
          onSelect={(lot: LocalProductLot) => billing.selectLot(lot)}
          onCancel={billing.cancelLotSelection}
        />
      )}

      {customerModal !== null && (
        <CustomerEntryModal
          initialName={customerModal.name}
          initialMobile={customerModal.mobile}
          onCancel={() => setCustomerModal(null)}
          onSave={async (input) => {
            const saved = await billing.saveCustomer(input);
            pickCustomer(saved);
          }}
        />
      )}
    </div>
  );
}

function billDiscountPercentSafe(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function looksLikeBarcode(value: string): boolean {
  const trimmed = value.trim();
  if (/^LOT-/i.test(trimmed)) return true;
  if (/^\d{8,14}$/.test(trimmed)) return true;
  if (/^[A-Za-z]{1,4}\d{1,6}$/.test(trimmed) && trimmed.length <= 10) return true;
  return false;
}
