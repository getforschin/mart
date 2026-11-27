import { describe, expect, it } from 'vitest';
import {
  computeChangeDue,
  computeInvoiceTotals,
  lineDiscountAmount,
  recalcLineNet,
  stockDeltaForSaleType,
} from './billing-math';

describe('billing-math', () => {
  it('computes line discount from percent', () => {
    expect(lineDiscountAmount(100, 2, 10)).toBe(20);
  });

  it('recalculates line net with tax off', () => {
    const line = recalcLineNet(62, 3, 5);
    expect(line.discountAmount).toBe(9.3);
    expect(line.netAmount).toBe(176.7);
    expect(line.calculatedTax).toBe(0);
  });

  it('computes invoice totals with bill discount and round off', () => {
    const totals = computeInvoiceTotals({
      items: [
        { unitPrice: 100, quantity: 2, discountPercent: 10 },
        { unitPrice: 50, quantity: 1, discountAmount: 5 },
      ],
      billDiscountPercent: 10,
      roundOff: 0.2,
    });
    // subtotal 250; line disc 20+5=25; bill disc 10% of 250=25; taxable 200; +0.2
    expect(totals.subtotal).toBe(250);
    expect(totals.lineDiscountTotal).toBe(25);
    expect(totals.billDiscount).toBe(25);
    expect(totals.discountTotal).toBe(50);
    expect(totals.taxTotal).toBe(0);
    expect(totals.finalPayable).toBe(200.2);
  });

  it('computes cash change due', () => {
    expect(computeChangeDue(187.5, 200)).toBe(12.5);
    expect(computeChangeDue(187.5, 100)).toBe(0);
  });

  it('returns signed stock delta by sale type', () => {
    expect(stockDeltaForSaleType('CASH_SALE', 3)).toBe(-3);
    expect(stockDeltaForSaleType('RETURN', 3)).toBe(3);
  });
});
