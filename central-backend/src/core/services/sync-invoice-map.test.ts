import { describe, expect, it } from 'vitest';
import { stockDeltaForSaleType } from './billing-math';
import type { SyncOrderInvoiceDto } from '../../dtos';
import { OrderOriginSource, PaymentChannel } from '../../models/enums';

/** Documents the sync payload contract expected from POS → central. */
function assertSyncInvoiceShape(invoice: SyncOrderInvoiceDto): string[] {
  const missing: string[] = [];
  const required = [
    'id',
    'tenantId',
    'facilityId',
    'cashierId',
    'subtotal',
    'taxTotal',
    'discountTotal',
    'finalPayable',
    'paymentChannel',
    'originSource',
    'createdAt',
    'items',
  ] as const;
  for (const key of required) {
    if (invoice[key] === undefined || invoice[key] === null) missing.push(key);
  }
  if (!Array.isArray(invoice.items) || invoice.items.length === 0) missing.push('items');
  return missing;
}

describe('sync invoice fidelity', () => {
  it('accepts expanded POS invoice payload fields', () => {
    const invoice: SyncOrderInvoiceDto = {
      id: 'inv-1',
      tenantId: 't-1',
      facilityId: 'f-1',
      cashierId: 'c-1',
      cashierName: 'Cashier',
      invoiceNumber: '270320260001',
      saleType: 'RETURN',
      status: 'COMPLETED',
      customerMobile: '9876543210',
      customerPayload: { name: 'Rahul', phone: '9876543210' },
      subtotal: 100,
      taxableValue: 90,
      taxTotal: 0,
      discountTotal: 10,
      billDiscountPercent: 0,
      roundOff: 0,
      amountTendered: 0,
      changeDue: 0,
      returnOfInvoiceId: 'inv-0',
      finalPayable: 90,
      paymentChannel: PaymentChannel.CASH,
      originSource: OrderOriginSource.OFFLINE_POS,
      createdAt: new Date().toISOString(),
      items: [
        {
          id: 'line-1',
          productId: 'p-1',
          lotId: 'l-1',
          quantity: 1,
          unitPrice: 100,
          calculatedTax: 0,
          netAmount: 90,
          discountPercent: 10,
          discountAmount: 10,
          mrp: 100,
          barcode: '8901234567890',
          batchNumber: 'B1',
        },
      ],
    };

    expect(assertSyncInvoiceShape(invoice)).toEqual([]);
    expect(stockDeltaForSaleType(invoice.saleType!, invoice.items[0].quantity)).toBe(1);
  });
});
