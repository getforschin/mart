import { describe, expect, it } from 'vitest';
import { computeInvoiceTotals, stockDeltaForSaleType } from './billing-math';

describe('central billing-math', () => {
  it('keeps tax off and applies cashier bill discount', () => {
    const totals = computeInvoiceTotals({
      items: [{ unitPrice: 499, quantity: 1, discountPercent: 0 }],
      billDiscountAmount: 49,
      roundOff: 0,
    });
    expect(totals.taxTotal).toBe(0);
    expect(totals.finalPayable).toBe(450);
  });

  it('maps return stock as positive delta', () => {
    expect(stockDeltaForSaleType('RETURN', 2)).toBe(2);
    expect(stockDeltaForSaleType('CREDIT_SALE', 2)).toBe(-2);
  });
});
