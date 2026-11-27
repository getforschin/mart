/** Pure purchase / supplier / expense finance helpers for unit tests. */

export type PurchasePaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computePurchasePayment(
  grandTotal: number,
  paidAmountInput: number,
): { paidAmount: number; dueAmount: number; paymentStatus: PurchasePaymentStatus } {
  const grand = round2(Math.max(0, grandTotal));
  const paidAmount = round2(Math.min(Math.max(0, paidAmountInput), grand));
  const dueAmount = round2(grand - paidAmount);
  let paymentStatus: PurchasePaymentStatus = 'UNPAID';
  if (dueAmount <= 0) paymentStatus = 'PAID';
  else if (paidAmount > 0) paymentStatus = 'PARTIAL';
  return { paidAmount, dueAmount, paymentStatus };
}

export function applySupplierPayment(
  outstandingDue: number,
  paymentAmount: number,
): { newDue: number; applied: number } {
  const due = round2(Math.max(0, outstandingDue));
  const applied = round2(Math.min(Math.max(0, paymentAmount), due));
  return { newDue: round2(due - applied), applied };
}

export function periodKeyFromDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function shouldPostSchedule(input: {
  dayOfMonth: number;
  asOfDay: number;
  periodKey: string;
  alreadyPostedPeriodKeys: string[];
  isActive: boolean;
  startMonth?: string | null;
  endMonth?: string | null;
}): boolean {
  if (!input.isActive) return false;
  if (input.dayOfMonth < 1 || input.dayOfMonth > 28) return false;
  if (input.asOfDay < input.dayOfMonth) return false;
  if (input.startMonth && input.periodKey < input.startMonth) return false;
  if (input.endMonth && input.periodKey > input.endMonth) return false;
  return !input.alreadyPostedPeriodKeys.includes(input.periodKey);
}

export function computeProfitLoss(input: {
  netSales: number;
  purchaseSpend: number;
  expenses: number;
}): { income: number; costs: number; expenses: number; result: number } {
  const income = round2(input.netSales);
  const costs = round2(input.purchaseSpend);
  const expenses = round2(input.expenses);
  return {
    income,
    costs,
    expenses,
    result: round2(income - costs - expenses),
  };
}
