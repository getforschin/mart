import { useCallback, useMemo, useState } from 'react';
import { CartItem, calculateCartTotals, resolveProductBarcode } from '../services/storefront';

const DEFAULT_TAX_RATE = parseFloat(import.meta.env.VITE_TAX_RATE ?? '18');

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lotSelection, setLotSelection] = useState<{
    productName: string;
    candidates: Array<{ id: string; mrp: number; expiryDate: string; quantityOnHand: number }>;
    pendingProduct: { productId: string; productSku: string };
  } | null>(null);

  const totals = useMemo(() => calculateCartTotals(items, DEFAULT_TAX_RATE), [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.lotId === item.lotId);
      if (existing) {
        return prev.map((i) =>
          i.lotId === item.lotId ? { ...i, quantity: i.quantity + item.quantity } : i,
        );
      }
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((lotId: string) => {
    setItems((prev) => prev.filter((i) => i.lotId !== lotId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const scanBarcode = useCallback(
    async (barcode: string) => {
      setScanError(null);
      try {
        const result = await resolveProductBarcode(barcode);

        if (result.candidateLots.length > 1 && result.suggestedLot === null) {
          setLotSelection({
            productName: result.productName,
            candidates: result.candidateLots,
            pendingProduct: { productId: result.productId, productSku: result.productSku },
          });
          return;
        }

        const lot = result.suggestedLot ?? result.candidateLots[0];
        if (!lot) {
          setScanError('No available inventory for this product');
          return;
        }

        addItem({
          productId: result.productId,
          lotId: lot.id,
          name: result.productName,
          sku: result.productSku,
          quantity: 1,
          unitPrice: lot.mrp,
          mrp: lot.mrp,
        });
      } catch (error) {
        setScanError(error instanceof Error ? error.message : 'Scan failed');
      }
    },
    [addItem],
  );

  const selectLot = useCallback(
    (lot: { id: string; mrp: number; expiryDate: string }) => {
      if (lotSelection === null) return;
      addItem({
        productId: lotSelection.pendingProduct.productId,
        lotId: lot.id,
        name: lotSelection.productName,
        sku: lotSelection.pendingProduct.productSku,
        quantity: 1,
        unitPrice: lot.mrp,
        mrp: lot.mrp,
      });
      setLotSelection(null);
    },
    [addItem, lotSelection],
  );

  return {
    items,
    totals,
    scanError,
    lotSelection,
    scanBarcode,
    selectLot,
    cancelLotSelection: () => setLotSelection(null),
    removeItem,
    clearCart,
  };
}
