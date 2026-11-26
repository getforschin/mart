import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarcodeResolutionResult,
  CartLineItem,
  LocalProductLot,
  PaymentChannel,
  PosConfig,
  SyncStatusEvent,
} from '../../shared/types';

interface LotSelectionState {
  resolution: BarcodeResolutionResult;
}

export function usePosTerminal() {
  const [config, setConfig] = useState<PosConfig | null>(null);
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [lotSelection, setLotSelection] = useState<LotSelectionState | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusEvent | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    void window.posApi.getConfig().then(setConfig).catch((error: unknown) => {
      setScanError(error instanceof Error ? error.message : 'Failed to load POS config');
    });

    const unsubscribe = window.posApi.onSyncStatus((event) => {
      setSyncStatus(event);
      setIsOnline(event.online);
    });

    void window.posApi.checkConnectivity().then(setIsOnline);

    return unsubscribe;
  }, []);

  const taxRate = config?.taxRate ?? 18;

  const totals = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const taxTotal = cartItems.reduce((sum, item) => sum + item.calculatedTax, 0);
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      finalPayable: Math.round((subtotal + taxTotal) * 100) / 100,
    };
  }, [cartItems]);

  const addLotToCart = useCallback(
    (lot: LocalProductLot, resolution: BarcodeResolutionResult) => {
      const lineTax = Math.round(lot.mrp * (taxRate / 100) * 100) / 100;
      const lineItem: CartLineItem = {
        productId: resolution.productId,
        lotId: lot.id,
        productName: resolution.productName,
        productSku: resolution.productSku,
        quantity: 1,
        unitPrice: lot.mrp,
        calculatedTax: lineTax,
        netAmount: Math.round((lot.mrp + lineTax) * 100) / 100,
        batchNumber: lot.batchNumber,
        expiryDate: lot.expiryDate,
      };

      setCartItems((prev) => {
        const existing = prev.find((item) => item.lotId === lot.id);
        if (existing) {
          return prev.map((item) =>
            item.lotId === lot.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  calculatedTax: Math.round(item.calculatedTax + lineTax * 100) / 100,
                  netAmount: Math.round((item.netAmount + lot.mrp + lineTax) * 100) / 100,
                }
              : item,
          );
        }
        return [...prev, lineItem];
      });
      setLotSelection(null);
      setScanError(null);
    },
    [taxRate],
  );

  const scanBarcode = useCallback(
    async (barcode: string) => {
      setScanError(null);
      try {
        const resolution = await window.posApi.resolveBarcode(barcode);

        if (resolution.resolutionType === 'COMPOSITE_LOT_DIRECT' && resolution.suggestedLot) {
          addLotToCart(resolution.suggestedLot, resolution);
          return;
        }

        if (resolution.resolutionType === 'MULTI_MRP_SELECTION') {
          setLotSelection({ resolution });
          return;
        }

        if (resolution.suggestedLot) {
          addLotToCart(resolution.suggestedLot, resolution);
          return;
        }

        setScanError('No available lot inventory for scanned barcode');
      } catch (error) {
        setScanError(error instanceof Error ? error.message : 'Barcode scan failed');
      }
    },
    [addLotToCart],
  );

  const selectLot = useCallback(
    (lot: LocalProductLot) => {
      if (lotSelection === null) return;
      addLotToCart(lot, lotSelection.resolution);
    },
    [addLotToCart, lotSelection],
  );

  const removeItem = useCallback((lotId: string) => {
    setCartItems((prev) => prev.filter((item) => item.lotId !== lotId));
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setLastInvoiceId(null);
  }, []);

  const checkout = useCallback(
    async (paymentChannel: PaymentChannel) => {
      if (cartItems.length === 0) {
        setScanError('Cart is empty');
        return;
      }

      setProcessing(true);
      try {
        const invoice = await window.posApi.createInvoice({
          items: cartItems,
          customerPayload: { name: 'Walk-in Customer' },
          paymentChannel,
          discountTotal: 0,
        });
        setLastInvoiceId(invoice.id);
        setCartItems([]);
        setScanError(null);
      } catch (error) {
        setScanError(error instanceof Error ? error.message : 'Checkout failed');
      } finally {
        setProcessing(false);
      }
    },
    [cartItems],
  );

  return {
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
    cancelLotSelection: () => setLotSelection(null),
    removeItem,
    clearCart,
    checkout,
  };
}
