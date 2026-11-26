import { useEffect, useRef, useState } from 'react';
import {
  InvoiceStatus,
  LocalProductLot,
  PaymentChannel,
  PosSession,
  SaleType,
} from '../../shared/types';
import { usePosBilling } from '../hooks/usePosBilling';
import { LotSelectionModal } from '../components/LotSelectionModal';

interface PosBillingPageProps {
  session: PosSession;
  onLogout: () => void;
}

export function PosBillingPage({ session, onLogout }: PosBillingPageProps): JSX.Element {
  const billing = usePosBilling(session);
  const [barcodeInput, setBarcodeInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = (event: React.FormEvent): void => {
    event.preventDefault();
    const value = barcodeInput.trim();
    if (!value) return;
    void billing.scanBarcode(value);
    setBarcodeInput('');
    inputRef.current?.focus();
  };

  const handleMobileLookup = (): void => {
    if (billing.customerMobile.length >= 10) {
      void billing.lookupCustomer(billing.customerMobile);
    }
  };

  return (
    <div className="billing-app">
      <header className="billing-topbar">
        <div className="billing-topbar__left">
          <strong>{billing.config?.shopName ?? 'Mart POS'}</strong>
          <span>{session.facility.name}</span>
          <span className={`status-pill ${billing.isOnline ? 'online' : 'offline'}`}>
            {billing.isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <nav className="billing-nav">
          <span>Sale POS</span>
          <span>Inventory</span>
          <span>Purchase</span>
          <span>Reports</span>
          <span>GST</span>
          <span>Customer</span>
        </nav>
        <div className="billing-topbar__right">
          <span>{session.user.displayName}</span>
          <button type="button" className="btn btn--ghost" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="shortcut-bar">
        <span>F2 Barcode</span>
        <span>F3 Item Search</span>
        <span>Alt+M Mobile</span>
        <span>Alt+P Print Bill</span>
        <span>Alt+S Save Draft</span>
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
            <input readOnly value={billing.nextInvoicePreview} />
          </label>
          <label>
            Mobile No
            <input
              value={billing.customerMobile}
              onChange={(e) => billing.setCustomerMobile(e.target.value)}
              onBlur={handleMobileLookup}
              placeholder="Customer mobile"
            />
          </label>
          <label>
            Employee
            <input readOnly value={session.user.displayName} />
          </label>
        </div>
      </section>

      <div className="billing-main">
        <div className="billing-left">
          <form onSubmit={handleScan} className="scan-row">
            <input
              ref={inputRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan barcode (F2) or enter item code…"
              disabled={billing.processing}
            />
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
                  <th>HSN</th>
                  <th>Qty</th>
                  <th>MRP</th>
                  <th>Rate</th>
                  <th>Disc</th>
                  <th>Tax</th>
                  <th>Net</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {billing.cartItems.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="empty-row">
                      Scan items to begin billing
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
                      <td>{item.hsnCode}</td>
                      <td>{item.quantity}</td>
                      <td>₹{item.mrp.toFixed(2)}</td>
                      <td>₹{item.unitPrice.toFixed(2)}</td>
                      <td>₹{item.discountAmount.toFixed(2)}</td>
                      <td>₹{item.calculatedTax.toFixed(2)}</td>
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
            <span>Operator Today Credit Sale: —</span>
          </div>
        </div>

        <aside className="billing-right">
          <div className="summary-card">
            <label>
              Membership Card
              <input
                readOnly
                value={billing.customer?.membershipCard ?? ''}
                placeholder="Scan membership card"
              />
            </label>
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
                <dt>Taxable Value</dt>
                <dd>₹{billing.totals.taxableValue.toFixed(2)}</dd>
              </div>
              <div>
                <dt>GST Amount</dt>
                <dd>₹{billing.totals.gstAmount.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Gross Sale</dt>
                <dd>₹{billing.totals.grossSale.toFixed(2)}</dd>
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
              Save as Draft
            </button>
            <button type="button" className="btn btn--ghost btn--block" onClick={billing.clearCart}>
              Clear Bill
            </button>

            {billing.lastInvoice !== null && (
              <p className="last-invoice">
                Saved: {billing.lastInvoice.invoiceNumber} — ₹
                {billing.lastInvoice.finalPayable.toFixed(2)}
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
    </div>
  );
}

function billDiscountPercentSafe(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
