/** Pure billing math — tax-off policy (taxTotal always 0). Safe for unit tests. */

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface BillingLineInput {
  unitPrice: number;
  quantity: number;
  discountPercent?: number;
  discountAmount?: number;
}

export interface BillingTotalsInput {
  items: BillingLineInput[];
  billDiscountPercent?: number;
  billDiscountAmount?: number;
  roundOff?: number;
}

export interface BillingTotals {
  subtotal: number;
  lineDiscountTotal: number;
  billDiscount: number;
  discountTotal: number;
  taxTotal: number;
  taxableValue: number;
  grossSale: number;
  roundOff: number;
  finalPayable: number;
}

export function lineDiscountAmount(unitPrice: number, quantity: number, discountPercent: number): number {
  const lineSale = round2(unitPrice * quantity);
  return round2((lineSale * Math.max(0, Math.min(100, discountPercent || 0))) / 100);
}

export function recalcLineNet(unitPrice: number, quantity: number, discountPercent: number): {
  discountAmount: number;
  netAmount: number;
  calculatedTax: number;
} {
  const qty = Math.max(1, Math.floor(quantity) || 1);
  const lineSale = round2(unitPrice * qty);
  const discountAmount = lineDiscountAmount(unitPrice, qty, discountPercent);
  return {
    discountAmount,
    netAmount: round2(lineSale - discountAmount),
    calculatedTax: 0,
  };
}

export function computeInvoiceTotals(input: BillingTotalsInput): BillingTotals {
  const subtotal = round2(
    input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  );
  const lineDiscountTotal = round2(
    input.items.reduce((sum, item) => {
      if (item.discountAmount != null && item.discountAmount > 0) {
        return sum + item.discountAmount;
      }
      return sum + lineDiscountAmount(item.unitPrice, item.quantity, item.discountPercent ?? 0);
    }, 0),
  );
  const billDiscount =
    (input.billDiscountAmount ?? 0) > 0
      ? round2(input.billDiscountAmount ?? 0)
      : round2((subtotal * (input.billDiscountPercent ?? 0)) / 100);
  const discountTotal = round2(lineDiscountTotal + billDiscount);
  const taxTotal = 0;
  const taxableValue = round2(Math.max(subtotal - discountTotal, 0));
  const grossSale = taxableValue;
  const roundOff = round2(input.roundOff ?? 0);
  const finalPayable = round2(Math.max(grossSale + roundOff, 0));
  return {
    subtotal,
    lineDiscountTotal,
    billDiscount,
    discountTotal,
    taxTotal,
    taxableValue,
    grossSale,
    roundOff,
    finalPayable,
  };
}

export function computeChangeDue(finalPayable: number, amountTendered: number | null | undefined): number {
  if (amountTendered == null || amountTendered <= 0) return 0;
  return round2(Math.max(amountTendered - finalPayable, 0));
}

export function stockDeltaForSaleType(saleType: string, quantity: number): number {
  // RETURN restocks (+); sales decrement (−)
  if (saleType === 'RETURN') return Math.abs(quantity);
  return -Math.abs(quantity);
}
