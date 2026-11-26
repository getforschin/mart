import { LocalProductLot } from '../../../shared/types';

interface LotSelectionModalProps {
  productName: string;
  candidates: LocalProductLot[];
  fifoRecommendation: LocalProductLot | null;
  onSelect: (lot: LocalProductLot) => void;
  onCancel: () => void;
}

export function LotSelectionModal({
  productName,
  candidates,
  fifoRecommendation,
  onSelect,
  onCancel,
}: LotSelectionModalProps): JSX.Element {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="lot-modal-title">
      <div className="modal">
        <h2 id="lot-modal-title">Select MRP — {productName}</h2>
        <p className="modal__subtitle">
          Multiple price points detected. FIFO recommends the lot expiring soonest.
        </p>
        <div className="lot-grid">
          {candidates.map((lot) => {
            const isFifo = fifoRecommendation?.id === lot.id;
            return (
              <button
                key={lot.id}
                type="button"
                className={`lot-card ${isFifo ? 'lot-card--fifo' : ''}`}
                onClick={() => onSelect(lot)}
              >
                {isFifo && <span className="fifo-tag">FIFO</span>}
                <span className="lot-card__mrp">₹{lot.mrp.toFixed(2)}</span>
                <span className="lot-card__batch">{lot.batchNumber}</span>
                <span className="lot-card__expiry">
                  Exp: {new Date(lot.expiryDate).toLocaleDateString()}
                </span>
                <span className="lot-card__qty">Stock: {lot.quantityOnHand}</span>
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
