import { useRef, useState } from 'react';
import { useCart } from '../hooks/useCart';

export function StorefrontPage(): JSX.Element {
  const {
    items,
    totals,
    scanError,
    lotSelection,
    scanBarcode,
    selectLot,
    cancelLotSelection,
    removeItem,
    clearCart,
  } = useCart();

  const [barcodeInput, setBarcodeInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleScanSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (barcodeInput.trim().length === 0) return;
    void scanBarcode(barcodeInput.trim());
    setBarcodeInput('');
    inputRef.current?.focus();
  };

  return (
    <div className="storefront">
      <header className="storefront__header">
        <h1>Mart Storefront</h1>
        <p>White-labeled B2C e-commerce platform</p>
      </header>

      <section className="scan-section">
        <form onSubmit={handleScanSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="Scan or enter barcode…"
            autoFocus
          />
          <button type="submit">Add to Cart</button>
        </form>
        {scanError !== null && <p className="error">{scanError}</p>}
      </section>

      {lotSelection !== null && (
        <div className="lot-modal-overlay">
          <div className="lot-modal">
            <h2>Select Price — {lotSelection.productName}</h2>
            <p>Multiple MRP lots available. Choose based on FIFO recommendation or customer preference.</p>
            <div className="lot-grid">
              {lotSelection.candidates.map((lot, index) => (
                <button
                  key={lot.id}
                  type="button"
                  className="lot-option"
                  onClick={() => selectLot(lot)}
                >
                  {index === 0 && <span className="fifo-badge">FIFO Recommended</span>}
                  <span className="lot-mrp">₹{lot.mrp.toFixed(2)}</span>
                  <span className="lot-expiry">Exp: {new Date(lot.expiryDate).toLocaleDateString()}</span>
                  <span className="lot-qty">Qty: {lot.quantityOnHand}</span>
                </button>
              ))}
            </div>
            <button type="button" className="cancel-btn" onClick={cancelLotSelection}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <section className="cart-section">
        <h2>Your Cart ({items.length})</h2>
        {items.length === 0 ? (
          <p className="empty">Scan a product to begin shopping.</p>
        ) : (
          <>
            <ul className="cart-list">
              {items.map((item) => (
                <li key={item.lotId} className="cart-item">
                  <div>
                    <strong>{item.name}</strong>
                    <span className="sku">{item.sku}</span>
                  </div>
                  <div className="cart-item__pricing">
                    <span>×{item.quantity}</span>
                    <span>₹{(item.unitPrice * item.quantity).toFixed(2)}</span>
                    <button type="button" onClick={() => removeItem(item.lotId)}>
                      Remove
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
                <span>Tax</span>
                <span>₹{totals.taxTotal.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>Total</span>
                <span>₹{totals.finalPayable.toFixed(2)}</span>
              </div>
            </div>
            <div className="cart-actions">
              <button type="button" onClick={clearCart}>
                Clear Cart
              </button>
              <button type="button" className="checkout-btn">
                Proceed to Checkout
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
