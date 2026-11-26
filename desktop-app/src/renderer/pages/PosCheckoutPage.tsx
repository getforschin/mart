import { useRef, useState } from 'react';
import { PaymentChannel } from '../../shared/types';
import { usePosTerminal } from '../hooks/usePosTerminal';
import { LotSelectionModal } from '../components/LotSelectionModal';
import { SyncStatusBar } from '../components/SyncStatusBar';

export function PosCheckoutPage(): JSX.Element {
  const {
    config,
    cartItems,
    lotSelection,
    scanError,
    syncStatus,
    isOnline,
    lastInvoiceId,
    processing,
    totals,
    scanBarcode,
    selectLot,
    cancelLotSelection,
    removeItem,
    clearCart,
    checkout,
  } = usePosTerminal();

  const [barcodeInput, setBarcodeInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleScanSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    const trimmed = barcodeInput.trim();
    if (trimmed.length === 0) return;
    void scanBarcode(trimmed);
    setBarcodeInput('');
    inputRef.current?.focus();
  };

  return (
    <div className="pos-terminal">
      <SyncStatusBar isOnline={isOnline} syncStatus={syncStatus} />

      <header className="pos-header">
        <div>
          <h1>Mart POS Terminal</h1>
          {config !== null && (
            <p className="pos-header__meta">
              Device: {config.deviceId} · Facility: {config.facilityId.slice(0, 8)}…
            </p>
          )}
        </div>
        {lastInvoiceId !== null && (
          <div className="invoice-badge">Last Invoice: {lastInvoiceId.slice(0, 8)}…</div>
        )}
      </header>

      <div className="pos-layout">
        <section className="scan-panel">
          <h2>Barcode Scanner</h2>
          <form onSubmit={handleScanSubmit} className="scan-form">
            <input
              ref={inputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan EAN-13 or LOT-* composite tag…"
              autoFocus
              disabled={processing}
            />
            <button type="submit" disabled={processing}>
              Add Item
            </button>
          </form>
          {scanError !== null && <p className="error-message">{scanError}</p>}

          <div className="scan-hints">
            <p>
              <strong>EAN-13:</strong> Resolves product with FIFO lot selection for multiple MRPs
            </p>
            <p>
              <strong>LOT-* tag:</strong> Direct composite lot lookup — bypasses verification
            </p>
          </div>
        </section>

        <section className="cart-panel">
          <div className="cart-panel__header">
            <h2>Current Sale ({cartItems.length})</h2>
            {cartItems.length > 0 && (
              <button type="button" className="btn btn--secondary btn--sm" onClick={clearCart}>
                Clear
              </button>
            )}
          </div>

          {cartItems.length === 0 ? (
            <p className="empty-cart">Scan items to begin checkout</p>
          ) : (
            <>
              <ul className="cart-lines">
                {cartItems.map((item) => (
                  <li key={item.lotId} className="cart-line">
                    <div className="cart-line__info">
                      <strong>{item.productName}</strong>
                      <span>{item.productSku} · Batch {item.batchNumber}</span>
                      <span className="cart-line__expiry">
                        Exp: {new Date(item.expiryDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="cart-line__pricing">
                      <span>×{item.quantity}</span>
                      <span>₹{(item.unitPrice * item.quantity).toFixed(2)}</span>
                      <button type="button" onClick={() => removeItem(item.lotId)}>
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="cart-totals">
                <div>
                  <span>Subtotal</span>
                  <span>₹{totals.subtotal.toFixed(2)}</span>
                </div>
                <div>
                  <span>Tax ({config?.taxRate ?? 18}%)</span>
                  <span>₹{totals.taxTotal.toFixed(2)}</span>
                </div>
                <div className="cart-totals__final">
                  <span>Total Payable</span>
                  <span>₹{totals.finalPayable.toFixed(2)}</span>
                </div>
              </div>

              <div className="payment-actions">
                <button
                  type="button"
                  className="btn btn--cash"
                  disabled={processing}
                  onClick={() => void checkout(PaymentChannel.CASH)}
                >
                  Cash
                </button>
                <button
                  type="button"
                  className="btn btn--card"
                  disabled={processing}
                  onClick={() => void checkout(PaymentChannel.CARD)}
                >
                  Card
                </button>
                <button
                  type="button"
                  className="btn btn--upi"
                  disabled={processing}
                  onClick={() => void checkout(PaymentChannel.UPI)}
                >
                  UPI
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {lotSelection !== null && (
        <LotSelectionModal
          productName={lotSelection.resolution.productName}
          candidates={lotSelection.resolution.candidateLots}
          fifoRecommendation={lotSelection.resolution.fifoRecommendation}
          onSelect={selectLot}
          onCancel={cancelLotSelection}
        />
      )}
    </div>
  );
}
