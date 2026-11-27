import { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { computeChangeDue, recalcLineNet, round2 } from '../../shared/billing-math';
import {
  BarcodeResolutionResult,
  CartLineItem,
  CreateInvoicePayload,
  InvoiceStatus,
  LocalOrderInvoice,
  LocalProductLot,
  PaymentChannel,
  PosConfig,
  PosCustomer,
  PosSession,
  SaleType,
  SyncStatusEvent,
} from '../../shared/types';

function recalcLine(item: CartLineItem): CartLineItem {
  const qty = Math.max(1, Math.floor(item.quantity) || 1);
  const { discountAmount, netAmount, calculatedTax } = recalcLineNet(
    item.unitPrice,
    qty,
    item.discountPercent || 0,
  );
  return {
    ...item,
    quantity: qty,
    pieceQty: qty,
    discountAmount,
    calculatedTax,
    netAmount,
  };
}

export function usePosBilling(session: PosSession) {
  const [config, setConfig] = useState<PosConfig | null>(null);
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [saleType, setSaleType] = useState<SaleType>(SaleType.CASH_SALE);
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [billDiscountPercent, setBillDiscountPercent] = useState(0);
  const [amountTendered, setAmountTendered] = useState(0);
  const [returnOfInvoiceId, setReturnOfInvoiceId] = useState<string | null>(null);
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>(PaymentChannel.CASH);
  const [lotSelection, setLotSelection] = useState<{
    resolution: BarcodeResolutionResult;
  } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusEvent | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<LocalOrderInvoice | null>(null);
  const [processing, setProcessing] = useState(false);
  const [nextInvoicePreview, setNextInvoicePreview] = useState('…');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftInvoiceNumber, setDraftInvoiceNumber] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<LocalOrderInvoice[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const refreshInvoicePreview = useCallback(() => {
    void window.posApi!.previewNextInvoiceNumber().then(setNextInvoicePreview);
  }, []);

  const refreshDrafts = useCallback(() => {
    void window.posApi!.listDraftInvoices().then(setDrafts);
  }, []);

  useEffect(() => {
    void window.posApi!.getConfig().then(setConfig);
    refreshInvoicePreview();
    refreshDrafts();
    const timer = window.setInterval(refreshInvoicePreview, 1000);
    const unsubscribe = window.posApi!.onSyncStatus((event) => {
      setSyncStatus(event);
      setIsOnline(event.online);
    });
    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [refreshInvoicePreview, refreshDrafts]);

  const totals = useMemo(() => {
    const totalMrp = cartItems.reduce((sum, item) => sum + item.mrp * item.quantity, 0);
    const totalSale = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const lineDiscount = cartItems.reduce((sum, item) => sum + item.discountAmount, 0);
    const billDiscount = round2((totalSale * billDiscountPercent) / 100);
    const discountAmount = round2(lineDiscount + billDiscount);
    const netBeforeRound = round2(Math.max(totalSale - discountAmount, 0));
    const rounded = Math.round(netBeforeRound);
    const roundOff = round2(rounded - netBeforeRound);
    const netPay = round2(rounded);
    const changeDue = computeChangeDue(netPay, amountTendered);

    return {
      totalMrp: round2(totalMrp),
      totalSale: round2(totalSale),
      discountAmount,
      roundOff,
      netPay,
      changeDue,
    };
  }, [cartItems, billDiscountPercent, amountTendered]);

  const buildLineItem = useCallback(
    (lot: LocalProductLot, resolution: BarcodeResolutionResult, barcode: string): CartLineItem => {
      const unitPrice = lot.saleRate || lot.mrp;
      return recalcLine({
        lineId: uuidv4(),
        productId: resolution.productId,
        lotId: lot.id,
        barcode,
        productName: resolution.productName,
        productSku: resolution.productSku,
        company: lot.company,
        size: lot.size,
        color: lot.color,
        hsnCode: lot.hsnCode,
        batchNumber: lot.batchNumber,
        serialNumber: '',
        priceType: 'MRP',
        boxQty: 0,
        packetQty: 0,
        pieceQty: 1,
        quantity: 1,
        purchaseRate: lot.costPrice,
        mrp: lot.mrp,
        unitPrice,
        discountPercent: 0,
        discountAmount: 0,
        calculatedTax: 0,
        netAmount: unitPrice,
        expiryDate: lot.expiryDate,
      });
    },
    [],
  );

  const addLotToCart = useCallback(
    (lot: LocalProductLot, resolution: BarcodeResolutionResult, barcode: string) => {
      setCartItems((prev) => {
        const existing = prev.find((item) => item.lotId === lot.id);
        if (existing) {
          return prev.map((item) =>
            item.lotId === lot.id
              ? recalcLine({ ...item, quantity: item.quantity + 1 })
              : item,
          );
        }
        const line = buildLineItem(lot, resolution, barcode);
        setSelectedLineId(line.lineId);
        return [...prev, line];
      });
      setLotSelection(null);
      setScanError(null);
    },
    [buildLineItem],
  );

  const updateLineQuantity = useCallback((lineId: string, quantity: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.lineId === lineId ? recalcLine({ ...item, quantity }) : item,
      ),
    );
  }, []);

  const updateLineDiscountPercent = useCallback((lineId: string, discountPercent: number) => {
    const pct = Math.max(0, Math.min(100, discountPercent || 0));
    setCartItems((prev) =>
      prev.map((item) =>
        item.lineId === lineId ? recalcLine({ ...item, discountPercent: pct }) : item,
      ),
    );
  }, []);

  const bumpSelectedQuantity = useCallback((delta: number) => {
    setCartItems((prev) => {
      if (prev.length === 0) return prev;
      const targetId = selectedLineId ?? prev[prev.length - 1].lineId;
      return prev.map((item) =>
        item.lineId === targetId
          ? recalcLine({ ...item, quantity: Math.max(1, item.quantity + delta) })
          : item,
      );
    });
  }, [selectedLineId]);

  const scanBarcode = useCallback(
    async (barcode: string) => {
      setScanError(null);
      try {
        const resolution = await window.posApi!.resolveBarcode(barcode);
        if (resolution.resolutionType === 'MULTI_MRP_SELECTION') {
          setLotSelection({ resolution });
          return;
        }
        const lot = resolution.suggestedLot ?? resolution.candidateLots[0];
        if (!lot) {
          setScanError('No stock available for this barcode');
          return;
        }
        addLotToCart(lot, resolution, barcode);
      } catch (error) {
        setScanError(error instanceof Error ? error.message : 'Scan failed');
      }
    },
    [addLotToCart],
  );

  const searchProducts = useCallback(async (query: string) => {
    return window.posApi!.searchProducts(query);
  }, []);

  const searchCustomers = useCallback(async (query: string) => {
    return window.posApi!.searchCustomers(query);
  }, []);

  const addProductByBarcode = useCallback(
    async (barcode: string) => {
      await scanBarcode(barcode);
    },
    [scanBarcode],
  );

  const applyCustomer = useCallback((selected: PosCustomer) => {
    setCustomer(selected);
    setCustomerMobile(selected.mobile);
    setCustomerName(selected.name);
  }, []);

  const clearCustomer = useCallback(() => {
    setCustomer(null);
    setCustomerMobile('');
    setCustomerName('');
  }, []);

  const saveCustomer = useCallback(
    async (input: { name: string; mobile: string; email?: string | null }) => {
      const saved = await window.posApi!.upsertCustomer(input);
      applyCustomer(saved);
      return saved;
    },
    [applyCustomer],
  );

  const lookupCustomer = useCallback(async (mobile: string) => {
    const result = await window.posApi!.lookupCustomerByMobile(mobile);
    if (result) {
      setCustomer(result);
      setCustomerMobile(result.mobile);
      setCustomerName(result.name);
    }
    return result;
  }, []);

  const resetBill = useCallback(() => {
    setCartItems([]);
    setCustomer(null);
    setCustomerMobile('');
    setCustomerName('');
    setBillDiscountPercent(0);
    setAmountTendered(0);
    setReturnOfInvoiceId(null);
    setDraftId(null);
    setDraftInvoiceNumber(null);
    setSaleType(SaleType.CASH_SALE);
    setPaymentChannel(PaymentChannel.CASH);
    setSelectedLineId(null);
    setScanError(null);
  }, []);

  const deleteDraft = useCallback(
    async (invoiceId: string) => {
      setProcessing(true);
      try {
        await window.posApi!.deleteDraftInvoice(invoiceId);
        if (draftId === invoiceId) {
          resetBill();
        }
        refreshDrafts();
        refreshInvoicePreview();
        setScanError(null);
      } catch (error) {
        setScanError(error instanceof Error ? error.message : 'Failed to delete draft');
      } finally {
        setProcessing(false);
      }
    },
    [draftId, refreshDrafts, refreshInvoicePreview, resetBill],
  );

  const loadDraft = useCallback(async (invoiceId: string) => {
    setProcessing(true);
    try {
      const invoice = await window.posApi!.getInvoice(invoiceId);
      if (invoice.status !== InvoiceStatus.DRAFT) {
        setScanError('Only draft invoices can be edited');
        return;
      }
      setDraftId(invoice.id);
      setDraftInvoiceNumber(invoice.invoiceNumber);
      setCartItems(invoice.items.map((item) => recalcLine(item)));
      setSaleType(invoice.saleType);
      setPaymentChannel(invoice.paymentChannel);
      setCustomerMobile(invoice.customerMobile || '');
      const name =
        invoice.customerPayload?.name && invoice.customerPayload.name !== 'Walk-in Customer'
          ? invoice.customerPayload.name
          : '';
      setCustomerName(name);
      setCustomer(
        invoice.customerMobile
          ? {
              id: `draft-cust-${invoice.id}`,
              name: name || 'Walk-in',
              mobile: invoice.customerMobile,
              email: invoice.customerPayload?.email || null,
              previousDue: 0,
              membershipCard: null,
              loyaltyPoints: 0,
            }
          : null,
      );
      setBillDiscountPercent(invoice.billDiscountPercent || 0);
      setAmountTendered(invoice.amountTendered || 0);
      setReturnOfInvoiceId(invoice.returnOfInvoiceId);
      setSelectedLineId(invoice.items[0]?.lineId ?? null);
      setScanError(null);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Failed to open draft');
    } finally {
      setProcessing(false);
    }
  }, []);

  const saveInvoice = useCallback(
    async (status: InvoiceStatus) => {
      if (status === InvoiceStatus.COMPLETED && cartItems.length === 0) {
        setScanError('Add at least one item before saving invoice');
        return null;
      }

      setProcessing(true);
      try {
        const customerPayload: PosCustomer | null =
          customer ??
          (customerMobile.trim().length >= 10
            ? {
                id: `walkin-${customerMobile.trim()}`,
                name: customerName.trim() || 'Walk-in',
                mobile: customerMobile.trim(),
                email: null,
                previousDue: 0,
                membershipCard: null,
                loyaltyPoints: 0,
              }
            : null);

        const payload: CreateInvoicePayload = {
          draftId,
          items: cartItems,
          saleType,
          paymentChannel:
            saleType === SaleType.CREDIT_SALE ? PaymentChannel.CREDIT : paymentChannel,
          customer: customerPayload,
          customerMobile,
          employeeName: session.user.displayName,
          billDiscountPercent,
          billDiscountAmount: 0,
          roundOff: totals.roundOff,
          amountTendered:
            paymentChannel === PaymentChannel.CASH && saleType !== SaleType.CREDIT_SALE
              ? amountTendered || totals.netPay
              : 0,
          returnOfInvoiceId,
          status,
        };

        const invoice = await window.posApi!.createInvoice(payload);
        setLastInvoice(invoice);
        refreshInvoicePreview();
        refreshDrafts();
        if (status === InvoiceStatus.COMPLETED) {
          try {
            await window.posApi!.printReceipt(invoice.id);
          } catch {
            // Print is best-effort; sale already saved.
          }
          resetBill();
        } else {
          setDraftId(invoice.id);
          setDraftInvoiceNumber(invoice.invoiceNumber);
        }
        setScanError(null);
        return invoice;
      } catch (error) {
        setScanError(error instanceof Error ? error.message : 'Save failed');
        return null;
      } finally {
        setProcessing(false);
      }
    },
    [
      cartItems,
      draftId,
      saleType,
      paymentChannel,
      customer,
      customerMobile,
      customerName,
      session.user.displayName,
      billDiscountPercent,
      amountTendered,
      returnOfInvoiceId,
      totals.roundOff,
      totals.netPay,
      refreshInvoicePreview,
      refreshDrafts,
      resetBill,
    ],
  );

  const removeLine = useCallback((lineId: string) => {
    setCartItems((prev) => prev.filter((item) => item.lineId !== lineId));
    setSelectedLineId((prev) => (prev === lineId ? null : prev));
  }, []);

  const clearCart = useCallback(() => {
    resetBill();
    refreshDrafts();
  }, [resetBill, refreshDrafts]);

  return {
    config,
    session,
    cartItems,
    saleType,
    setSaleType,
    customerMobile,
    setCustomerMobile,
    customerName,
    setCustomerName,
    customer,
    applyCustomer,
    clearCustomer,
    saveCustomer,
    lookupCustomer,
    searchCustomers,
    deleteDraft,
    billDiscountPercent,
    setBillDiscountPercent,
    amountTendered,
    setAmountTendered,
    returnOfInvoiceId,
    setReturnOfInvoiceId,
    paymentChannel,
    setPaymentChannel,
    lotSelection,
    scanError,
    setScanError,
    syncStatus,
    isOnline,
    lastInvoice,
    nextInvoicePreview,
    draftId,
    draftInvoiceNumber,
    drafts,
    refreshDrafts,
    loadDraft,
    processing,
    totals,
    selectedLineId,
    setSelectedLineId,
    bumpSelectedQuantity,
    scanBarcode,
    searchProducts,
    addProductByBarcode,
    updateLineQuantity,
    updateLineDiscountPercent,
    selectLot: (lot: LocalProductLot) => {
      if (!lotSelection) return;
      addLotToCart(lot, lotSelection.resolution, lot.baseBarcode);
    },
    cancelLotSelection: () => setLotSelection(null),
    removeLine,
    clearCart,
    saveInvoice,
  };
}
