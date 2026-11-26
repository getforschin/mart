import { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function usePosBilling(session: PosSession) {
  const [config, setConfig] = useState<PosConfig | null>(null);
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [saleType, setSaleType] = useState<SaleType>(SaleType.CASH_SALE);
  const [customerMobile, setCustomerMobile] = useState('');
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [redeemAmount, setRedeemAmount] = useState(0);
  const [billDiscountPercent, setBillDiscountPercent] = useState(0);
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>(PaymentChannel.CASH);
  const [lotSelection, setLotSelection] = useState<{
    resolution: BarcodeResolutionResult;
  } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusEvent | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<LocalOrderInvoice | null>(null);
  const [processing, setProcessing] = useState(false);
  const [nextInvoicePreview, setNextInvoicePreview] = useState('NEW');

  const taxRate = config?.taxRate ?? 18;

  useEffect(() => {
    void window.posApi!.getConfig().then(setConfig);
    const unsubscribe = window.posApi!.onSyncStatus((event) => {
      setSyncStatus(event);
      setIsOnline(event.online);
    });
    void window.posApi!.checkConnectivity().then(setIsOnline);
    return unsubscribe;
  }, []);

  const totals = useMemo(() => {
    const totalMrp = cartItems.reduce((sum, item) => sum + item.mrp * item.quantity, 0);
    const totalSale = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const lineDiscount = cartItems.reduce((sum, item) => sum + item.discountAmount, 0);
    const billDiscount = round2((totalSale * billDiscountPercent) / 100);
    const discountAmount = round2(lineDiscount + billDiscount);
    const taxableValue = round2(Math.max(totalSale - billDiscount, 0));
    const gstAmount = cartItems.reduce((sum, item) => sum + item.calculatedTax, 0);
    const grossSale = round2(taxableValue + gstAmount);
    const netBeforeRound = grossSale - redeemAmount;
    const rounded = Math.round(netBeforeRound);
    const roundOff = round2(rounded - netBeforeRound);
    const netPay = round2(rounded);

    return {
      totalMrp: round2(totalMrp),
      totalSale: round2(totalSale),
      discountAmount,
      taxableValue,
      gstAmount: round2(gstAmount),
      grossSale,
      roundOff,
      netPay,
    };
  }, [cartItems, billDiscountPercent, redeemAmount]);

  const buildLineItem = useCallback(
    (lot: LocalProductLot, resolution: BarcodeResolutionResult, barcode: string): CartLineItem => {
      const unitPrice = lot.saleRate || lot.mrp;
      const lineSubtotal = unitPrice;
      const calculatedTax = round2((lineSubtotal * taxRate) / 100);
      return {
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
        calculatedTax,
        netAmount: round2(lineSubtotal + calculatedTax),
        expiryDate: lot.expiryDate,
      };
    },
    [taxRate],
  );

  const addLotToCart = useCallback(
    (lot: LocalProductLot, resolution: BarcodeResolutionResult, barcode: string) => {
      setCartItems((prev) => {
        const existing = prev.find((item) => item.lotId === lot.id);
        if (existing) {
          return prev.map((item) =>
            item.lotId === lot.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  pieceQty: item.pieceQty + 1,
                  calculatedTax: round2(item.calculatedTax + (item.unitPrice * taxRate) / 100),
                  netAmount: round2(
                    item.netAmount + item.unitPrice + (item.unitPrice * taxRate) / 100,
                  ),
                }
              : item,
          );
        }
        return [...prev, buildLineItem(lot, resolution, barcode)];
      });
      setLotSelection(null);
      setScanError(null);
    },
    [buildLineItem, taxRate],
  );

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

  const lookupCustomer = useCallback(async (mobile: string) => {
    const result = await window.posApi!.lookupCustomerByMobile(mobile);
    setCustomer(result);
    return result;
  }, []);

  const saveInvoice = useCallback(
    async (status: InvoiceStatus) => {
      if (status === InvoiceStatus.COMPLETED && cartItems.length === 0) {
        setScanError('Add at least one item before saving invoice');
        return null;
      }

      setProcessing(true);
      try {
        const payload: CreateInvoicePayload = {
          items: cartItems,
          saleType,
          paymentChannel,
          customer,
          customerMobile,
          employeeName: session.user.displayName,
          couponCode,
          redeemAmount,
          billDiscountPercent,
          billDiscountAmount: 0,
          roundOff: totals.roundOff,
          status,
        };

        const invoice = await window.posApi!.createInvoice(payload);
        setLastInvoice(invoice);
        setNextInvoicePreview(invoice.invoiceNumber);
        if (status === InvoiceStatus.COMPLETED) {
          setCartItems([]);
          setCustomer(null);
          setCustomerMobile('');
          setCouponCode('');
          setRedeemAmount(0);
          setBillDiscountPercent(0);
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
      saleType,
      paymentChannel,
      customer,
      customerMobile,
      session.user.displayName,
      couponCode,
      redeemAmount,
      billDiscountPercent,
      totals.roundOff,
    ],
  );

  const removeLine = useCallback((lineId: string) => {
    setCartItems((prev) => prev.filter((item) => item.lineId !== lineId));
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setScanError(null);
  }, []);

  return {
    config,
    session,
    cartItems,
    saleType,
    setSaleType,
    customerMobile,
    setCustomerMobile,
    customer,
    lookupCustomer,
    couponCode,
    setCouponCode,
    redeemAmount,
    setRedeemAmount,
    billDiscountPercent,
    setBillDiscountPercent,
    paymentChannel,
    setPaymentChannel,
    lotSelection,
    scanError,
    syncStatus,
    isOnline,
    lastInvoice,
    nextInvoicePreview,
    processing,
    totals,
    scanBarcode,
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
