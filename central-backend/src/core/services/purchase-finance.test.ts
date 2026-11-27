import { describe, expect, it } from 'vitest';
import {
  applySupplierPayment,
  computeProfitLoss,
  computePurchasePayment,
  periodKeyFromDate,
  shouldPostSchedule,
} from './purchase-finance';

describe('purchase-finance', () => {
  it('computes paid/due/payment status', () => {
    expect(computePurchasePayment(1000, 0)).toEqual({
      paidAmount: 0,
      dueAmount: 1000,
      paymentStatus: 'UNPAID',
    });
    expect(computePurchasePayment(1000, 400)).toEqual({
      paidAmount: 400,
      dueAmount: 600,
      paymentStatus: 'PARTIAL',
    });
    expect(computePurchasePayment(1000, 1000).paymentStatus).toBe('PAID');
    expect(computePurchasePayment(1000, 1500).paidAmount).toBe(1000);
  });

  it('applies multiple supplier payments until cleared', () => {
    let due = 1000;
    due = applySupplierPayment(due, 300).newDue;
    expect(due).toBe(700);
    due = applySupplierPayment(due, 700).newDue;
    expect(due).toBe(0);
    expect(applySupplierPayment(0, 50).applied).toBe(0);
  });

  it('posts recurring schedule once per period', () => {
    expect(
      shouldPostSchedule({
        dayOfMonth: 5,
        asOfDay: 5,
        periodKey: '2026-03',
        alreadyPostedPeriodKeys: [],
        isActive: true,
      }),
    ).toBe(true);
    expect(
      shouldPostSchedule({
        dayOfMonth: 5,
        asOfDay: 4,
        periodKey: '2026-03',
        alreadyPostedPeriodKeys: [],
        isActive: true,
      }),
    ).toBe(false);
    expect(
      shouldPostSchedule({
        dayOfMonth: 5,
        asOfDay: 10,
        periodKey: '2026-03',
        alreadyPostedPeriodKeys: ['2026-03'],
        isActive: true,
      }),
    ).toBe(false);
    expect(periodKeyFromDate('2026-03-15')).toBe('2026-03');
  });

  it('computes P&L result', () => {
    expect(
      computeProfitLoss({ netSales: 100000, purchaseSpend: 60000, expenses: 15000 }),
    ).toEqual({
      income: 100000,
      costs: 60000,
      expenses: 15000,
      result: 25000,
    });
  });
});
