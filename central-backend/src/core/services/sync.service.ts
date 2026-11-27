import { EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { getDataSource } from '../database/data-source';
import { logError, logInfo, logWarn } from '../logging/logger';
import { publishNotification } from '../redis/redis-client';
import { createAppError } from '../interceptors/error-handler.middleware';
import {
  SyncPushRequestDto,
  SyncPushResponseDto,
  SyncEventResultDto,
  SyncOrderInvoiceDto,
  SyncAttendanceDto,
  SyncCustomerDto,
  SyncPurchaseDto,
  SyncSupplierPaymentDto,
  SyncExpenseDto,
  SyncStockEventDto,
  SyncPullRequestDto,
  SyncPullResponseDto,
} from '../../dtos';
import {
  User,
  UserRole,
  OrderInvoice,
  OrderItem,
  WorkforceAttendance,
  SyncEventLog,
  LotInventoryStock,
  ProductLot,
  Product,
  Customer,
  StockMovement,
  SyncEventType,
  SyncResultStatus,
  GstMode,
  PurchaseStatus,
  StockMovementType,
  ExpenseCategory,
} from '../../models';
import { erpService } from './erp.service';
import { stockDeltaForSaleType } from './billing-math';

function num(value: unknown): number {
  return Number(value ?? 0);
}


const LEGACY_POS_MANAGER_AS_WAREHOUSE_ID = '00000000-0000-0000-0000-000000000004';
const DEMO_MANAGER_ID = '00000000-0000-0000-0000-000000000006';
const DEMO_CASHIER_ID = '00000000-0000-0000-0000-000000000003';

export class SyncService {
  async pushOfflineEvents(request: SyncPushRequestDto): Promise<SyncPushResponseDto> {
    const results: SyncEventResultDto[] = [];
    const invoices = request.invoices ?? [];
    const attendanceRecords = request.attendanceRecords ?? [];
    const customers = request.customers ?? [];
    const purchases = request.purchases ?? [];
    const supplierPayments = request.supplierPayments ?? [];
    const expenses = request.expenses ?? [];
    const stockEvents = request.stockEvents ?? [];

    logInfo('SyncService.pushOfflineEvents', 'Processing offline sync batch', {
      tenantId: request.tenantId,
      facilityId: request.facilityId,
      deviceId: request.deviceId,
      invoiceCount: invoices.length,
      attendanceCount: attendanceRecords.length,
      customerCount: customers.length,
      purchaseCount: purchases.length,
      supplierPaymentCount: supplierPayments.length,
      expenseCount: expenses.length,
      stockEventCount: stockEvents.length,
    });

    for (const customer of customers) {
      results.push(await this.processCustomerEvent(customer, request.tenantId));
    }
    for (const purchase of purchases) {
      results.push(await this.processPurchaseEvent(purchase, request.tenantId));
    }
    for (const payment of supplierPayments) {
      results.push(await this.processSupplierPaymentEvent(payment, request.tenantId));
    }
    for (const expense of expenses) {
      results.push(await this.processExpenseEvent(expense, request.tenantId));
    }
    for (const stockEvent of stockEvents) {
      results.push(await this.processStockEvent(stockEvent, request.tenantId));
    }
    for (const invoice of invoices) {
      results.push(await this.processInvoiceEvent(invoice, request.tenantId));
    }
    for (const attendance of attendanceRecords) {
      results.push(await this.processAttendanceEvent(attendance, request.tenantId));
    }

    const acceptedCount = results.filter((r) => r.status === SyncResultStatus.ACCEPTED).length;
    const duplicateCount = results.filter((r) => r.status === SyncResultStatus.DUPLICATE).length;
    const rejectedCount = results.filter((r) => r.status === SyncResultStatus.REJECTED).length;

    await publishNotification(`tenant:${request.tenantId}:sync`, {
      deviceId: request.deviceId,
      facilityId: request.facilityId,
      acceptedCount,
      duplicateCount,
      rejectedCount,
      timestamp: new Date().toISOString(),
    });

    return {
      processedCount: results.length,
      acceptedCount,
      duplicateCount,
      rejectedCount,
      results,
    };
  }

  async pullCentralState(request: SyncPullRequestDto): Promise<SyncPullResponseDto> {
    const ds = getDataSource();
    const since = request.since ? new Date(request.since) : null;

    const customerQb = ds
      .getRepository(Customer)
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId: request.tenantId });
    if (since) customerQb.andWhere('c.updatedAt > :since', { since });
    const customers = await customerQb.orderBy('c.updatedAt', 'ASC').getMany();

    const stockQb = ds
      .getRepository(LotInventoryStock)
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.lot', 'lot')
      .innerJoinAndSelect('lot.product', 'product')
      .where('product.tenantId = :tenantId', { tenantId: request.tenantId })
      .andWhere('s.facilityId = :facilityId', { facilityId: request.facilityId });
    if (since) stockQb.andWhere('s.updatedAt > :since', { since });
    const stocks = await stockQb.getMany();

    const pulledAt = new Date().toISOString();
    return {
      pulledAt,
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        mobile: c.mobile,
        email: c.email,
        previousDue: num(c.outstandingDue),
        membershipCard: c.membershipCard,
        loyaltyPoints: 0,
        updatedAt: c.updatedAt?.toISOString?.() ?? pulledAt,
      })),
      lots: stocks.map((s) => {
        const lot = s.lot as ProductLot & { product: Product };
        const product = lot.product;
        return {
          id: lot.id,
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          baseBarcode: product.baseBarcode,
          company: product.brand ?? '',
          size: '',
          color: '',
          hsnCode: product.hsnCode ?? '',
          batchNumber: lot.batchNumber,
          costPrice: num(lot.costPrice),
          mrp: num(lot.mrp),
          saleRate: num(lot.mrp),
          manufactureDate: lot.manufactureDate instanceof Date ? lot.manufactureDate.toISOString() : String(lot.manufactureDate),
          expiryDate: lot.expiryDate instanceof Date ? lot.expiryDate.toISOString() : String(lot.expiryDate),
          lotBarcode: lot.lotBarcode,
          quantityOnHand: num(s.quantityOnHand),
          aisleShelfLocation: s.aisleShelfLocation,
          facilityId: s.facilityId,
          updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : pulledAt,
        };
      }),
    };
  }

  private async processCustomerEvent(
    customer: SyncCustomerDto,
    expectedTenantId: string,
  ): Promise<SyncEventResultDto> {
    if (customer.tenantId !== expectedTenantId) {
      return {
        clientEventId: customer.id,
        eventType: 'CUSTOMER',
        status: SyncResultStatus.REJECTED,
        message: 'Customer tenantId does not match sync request tenant context',
      };
    }

    try {
      const dataSource = getDataSource();
      const existingLog = await dataSource.getRepository(SyncEventLog).findOne({
        where: { clientEventId: customer.id },
      });
      if (existingLog !== null) {
        // Allow re-upsert of customer by unique client event — treat content updates via mobile key
        // Duplicate event id means already accepted once; still upsert latest fields without re-log
        await erpService.upsertCustomer(expectedTenantId, {
          id: customer.id,
          name: customer.name,
          mobile: customer.mobile,
          email: customer.email ?? null,
          membershipCard: customer.membershipCard ?? null,
          outstandingDue: customer.previousDue ?? 0,
        });
        return {
          clientEventId: customer.id,
          eventType: 'CUSTOMER',
          status: SyncResultStatus.DUPLICATE,
          message: 'Customer already processed (idempotent duplicate)',
        };
      }

      await erpService.upsertCustomer(expectedTenantId, {
        id: customer.id,
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email ?? null,
        membershipCard: customer.membershipCard ?? null,
        outstandingDue: customer.previousDue ?? 0,
      });
      await dataSource.transaction(async (manager: EntityManager) => {
        await this.recordSyncEvent(manager, customer.id, customer.tenantId, SyncEventType.CUSTOMER, customer);
      });

      return {
        clientEventId: customer.id,
        eventType: 'CUSTOMER',
        status: SyncResultStatus.ACCEPTED,
        message: 'Customer upserted',
      };
    } catch (error) {
      logError('SyncService.processCustomerEvent', error, { clientEventId: customer.id });
      return {
        clientEventId: customer.id,
        eventType: 'CUSTOMER',
        status: SyncResultStatus.REJECTED,
        message: error instanceof Error ? error.message : 'Unknown error during customer processing',
      };
    }
  }

  private async processPurchaseEvent(
    purchase: SyncPurchaseDto,
    expectedTenantId: string,
  ): Promise<SyncEventResultDto> {
    if (purchase.tenantId !== expectedTenantId) {
      return {
        clientEventId: purchase.id,
        eventType: 'PURCHASE',
        status: SyncResultStatus.REJECTED,
        message: 'Purchase tenantId does not match sync request tenant context',
      };
    }

    try {
      const dataSource = getDataSource();
      const existingLog = await dataSource.getRepository(SyncEventLog).findOne({
        where: { clientEventId: purchase.id },
      });
      if (existingLog !== null) {
        return {
          clientEventId: purchase.id,
          eventType: 'PURCHASE',
          status: SyncResultStatus.DUPLICATE,
          message: 'Purchase already processed (idempotent duplicate)',
        };
      }

      await erpService.createPurchase(expectedTenantId, {
        id: purchase.id,
        facilityId: purchase.facilityId,
        supplierId: purchase.supplierId,
        invoiceNumber: purchase.invoiceNumber,
        invoiceDate: purchase.invoiceDate,
        gstMode: (purchase.gstMode as GstMode) ?? GstMode.NON_GST,
        remark: purchase.remark,
        status: (purchase.status as PurchaseStatus) ?? PurchaseStatus.COMPLETED,
        otherCharges: purchase.otherCharges ?? 0,
        paidAmount: purchase.paidAmount ?? 0,
        paymentMode: purchase.paymentMode,
        items: purchase.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          barcode: item.barcode,
          sku: item.sku,
          quantity: item.quantity,
          purchaseRate: item.purchaseRate,
          mrp: item.mrp,
          saleRate: item.saleRate,
          gstPercent: item.gstPercent,
          isNewProduct: item.isNewProduct,
        })),
      });
      await dataSource.transaction(async (manager: EntityManager) => {
        await this.recordSyncEvent(manager, purchase.id, purchase.tenantId, SyncEventType.PURCHASE, purchase);
      });

      return {
        clientEventId: purchase.id,
        eventType: 'PURCHASE',
        status: SyncResultStatus.ACCEPTED,
        message: 'Purchase persisted and stock increased',
      };
    } catch (error) {
      logError('SyncService.processPurchaseEvent', error, { clientEventId: purchase.id });
      return {
        clientEventId: purchase.id,
        eventType: 'PURCHASE',
        status: SyncResultStatus.REJECTED,
        message: error instanceof Error ? error.message : 'Unknown error during purchase processing',
      };
    }
  }

  private async processSupplierPaymentEvent(
    payment: SyncSupplierPaymentDto,
    expectedTenantId: string,
  ): Promise<SyncEventResultDto> {
    if (payment.tenantId !== expectedTenantId) {
      return {
        clientEventId: payment.id,
        eventType: 'SUPPLIER_PAYMENT',
        status: SyncResultStatus.REJECTED,
        message: 'Supplier payment tenantId does not match sync request tenant context',
      };
    }

    try {
      const dataSource = getDataSource();
      const existingLog = await dataSource.getRepository(SyncEventLog).findOne({
        where: { clientEventId: payment.id },
      });
      if (existingLog !== null) {
        return {
          clientEventId: payment.id,
          eventType: 'SUPPLIER_PAYMENT',
          status: SyncResultStatus.DUPLICATE,
          message: 'Supplier payment already processed (idempotent duplicate)',
        };
      }

      await erpService.paySupplier(expectedTenantId, {
        id: payment.id,
        supplierId: payment.supplierId,
        amount: payment.amount,
        paymentMode: payment.paymentMode,
        entryDate: payment.entryDate,
        remark: payment.remark,
        referenceNo: payment.referenceNo ?? payment.id,
      });
      await dataSource.transaction(async (manager: EntityManager) => {
        await this.recordSyncEvent(
          manager,
          payment.id,
          payment.tenantId,
          SyncEventType.SUPPLIER_PAYMENT,
          payment,
        );
      });

      return {
        clientEventId: payment.id,
        eventType: 'SUPPLIER_PAYMENT',
        status: SyncResultStatus.ACCEPTED,
        message: 'Supplier payment applied',
      };
    } catch (error) {
      logError('SyncService.processSupplierPaymentEvent', error, { clientEventId: payment.id });
      return {
        clientEventId: payment.id,
        eventType: 'SUPPLIER_PAYMENT',
        status: SyncResultStatus.REJECTED,
        message: error instanceof Error ? error.message : 'Unknown error during supplier payment processing',
      };
    }
  }

  private async processExpenseEvent(
    expense: SyncExpenseDto,
    expectedTenantId: string,
  ): Promise<SyncEventResultDto> {
    if (expense.tenantId !== expectedTenantId) {
      return {
        clientEventId: expense.id,
        eventType: 'EXPENSE',
        status: SyncResultStatus.REJECTED,
        message: 'Expense tenantId does not match sync request tenant context',
      };
    }

    try {
      const dataSource = getDataSource();
      const existingLog = await dataSource.getRepository(SyncEventLog).findOne({
        where: { clientEventId: expense.id },
      });
      if (existingLog !== null) {
        return {
          clientEventId: expense.id,
          eventType: 'EXPENSE',
          status: SyncResultStatus.DUPLICATE,
          message: 'Expense already processed (idempotent duplicate)',
        };
      }

      await erpService.createExpense(expectedTenantId, {
        id: expense.id,
        facilityId: expense.facilityId,
        expenseDate: expense.expenseDate,
        amount: expense.amount,
        purpose: expense.purpose,
        category: (expense.category as ExpenseCategory | undefined) ?? ExpenseCategory.MISC,
        paymentMode: expense.paymentMode,
        payee: expense.payee,
        notes: expense.notes,
        createdBy: expense.createdBy,
        scheduleId: expense.scheduleId,
        periodKey: expense.periodKey,
        isRecurringGenerated: expense.isRecurringGenerated,
      });
      await dataSource.transaction(async (manager: EntityManager) => {
        await this.recordSyncEvent(manager, expense.id, expense.tenantId, SyncEventType.EXPENSE, expense);
      });

      return {
        clientEventId: expense.id,
        eventType: 'EXPENSE',
        status: SyncResultStatus.ACCEPTED,
        message: 'Expense persisted',
      };
    } catch (error) {
      logError('SyncService.processExpenseEvent', error, { clientEventId: expense.id });
      return {
        clientEventId: expense.id,
        eventType: 'EXPENSE',
        status: SyncResultStatus.REJECTED,
        message: error instanceof Error ? error.message : 'Unknown error during expense processing',
      };
    }
  }

  private async processStockEvent(
    event: SyncStockEventDto,
    expectedTenantId: string,
  ): Promise<SyncEventResultDto> {
    if (event.tenantId !== expectedTenantId) {
      return {
        clientEventId: event.id,
        eventType: 'STOCK_EVENT',
        status: SyncResultStatus.REJECTED,
        message: 'Stock event tenantId does not match sync request tenant context',
      };
    }

    try {
      const dataSource = getDataSource();
      const existingLog = await dataSource.getRepository(SyncEventLog).findOne({
        where: { clientEventId: event.id },
      });
      if (existingLog !== null) {
        return {
          clientEventId: event.id,
          eventType: 'STOCK_EVENT',
          status: SyncResultStatus.DUPLICATE,
          message: 'Stock event already processed (idempotent duplicate)',
        };
      }

      if (event.eventType === 'DUMP') {
        await erpService.dumpStock(expectedTenantId, {
          facilityId: event.facilityId,
          productId: event.productId,
          lotId: event.lotId,
          quantity: event.quantity,
          remark: event.remark,
        });
      } else if (event.eventType === 'CORRECTION') {
        await erpService.correctStock(expectedTenantId, {
          facilityId: event.facilityId,
          productId: event.productId,
          lotId: event.lotId,
          newQuantity: event.newQuantity ?? event.quantity,
          remark: event.remark,
        });
      } else if (event.eventType === 'TRANSFER') {
        if (!event.toFacilityId) {
          throw createAppError('Transfer requires toFacilityId', 400, 'INVALID_TRANSFER');
        }
        await erpService.createTransfer(expectedTenantId, {
          fromFacilityId: event.facilityId,
          toFacilityId: event.toFacilityId,
          productId: event.productId,
          lotId: event.lotId,
          quantity: event.quantity,
          remark: event.remark,
        });
      } else {
        throw createAppError(`Unknown stock event type ${event.eventType}`, 400, 'INVALID_STOCK_EVENT');
      }
      await dataSource.transaction(async (manager: EntityManager) => {
        await this.recordSyncEvent(manager, event.id, event.tenantId, SyncEventType.STOCK_EVENT, event);
      });

      return {
        clientEventId: event.id,
        eventType: 'STOCK_EVENT',
        status: SyncResultStatus.ACCEPTED,
        message: `Stock ${event.eventType} applied`,
      };
    } catch (error) {
      logError('SyncService.processStockEvent', error, { clientEventId: event.id });
      return {
        clientEventId: event.id,
        eventType: 'STOCK_EVENT',
        status: SyncResultStatus.REJECTED,
        message: error instanceof Error ? error.message : 'Unknown error during stock event processing',
      };
    }
  }


  private async resolveCashierIdForSync(
    manager: EntityManager,
    cashierId: string,
    tenantId: string,
  ): Promise<string> {
    const userRepo = manager.getRepository(User);
    const candidates = [cashierId];
    if (cashierId === LEGACY_POS_MANAGER_AS_WAREHOUSE_ID) {
      candidates.push(DEMO_MANAGER_ID, DEMO_CASHIER_ID);
    }
    for (const id of candidates) {
      const found = await userRepo.findOne({ where: { id } });
      if (found) return found.id;
    }
    const fallback = await userRepo.findOne({
      where: { tenantId, role: UserRole.CASHIER, isActive: true },
    });
    if (fallback) return fallback.id;
    const anyUser = await userRepo.findOne({ where: { tenantId, isActive: true } });
    if (anyUser) return anyUser.id;
    return cashierId;
  }

  private async processInvoiceEvent(
    invoice: SyncOrderInvoiceDto,
    expectedTenantId: string,
  ): Promise<SyncEventResultDto> {
    if (invoice.tenantId !== expectedTenantId) {
      logWarn('SyncService.processInvoiceEvent', 'Tenant mismatch in invoice', {
        clientEventId: invoice.id,
        expectedTenantId,
        invoiceTenantId: invoice.tenantId,
      });
      return {
        clientEventId: invoice.id,
        eventType: 'ORDER_INVOICE',
        status: SyncResultStatus.REJECTED,
        message: 'Invoice tenantId does not match sync request tenant context',
      };
    }

    try {
      const dataSource = getDataSource();
      const existingLog = await dataSource.getRepository(SyncEventLog).findOne({
        where: { clientEventId: invoice.id },
      });

      if (existingLog !== null) {
        logInfo('SyncService.processInvoiceEvent', 'Duplicate invoice event detected', {
          clientEventId: invoice.id,
        });
        return {
          clientEventId: invoice.id,
          eventType: 'ORDER_INVOICE',
          status: SyncResultStatus.DUPLICATE,
          message: 'Invoice already processed (idempotent duplicate)',
        };
      }

      await dataSource.transaction(async (manager: EntityManager) => {
        await this.persistInvoiceWithDeltaStockReduction(manager, invoice);
        await this.recordSyncEvent(manager, invoice.id, invoice.tenantId, SyncEventType.ORDER_INVOICE, invoice);
      });

      logInfo('SyncService.processInvoiceEvent', 'Invoice accepted', { clientEventId: invoice.id });
      return {
        clientEventId: invoice.id,
        eventType: 'ORDER_INVOICE',
        status: SyncResultStatus.ACCEPTED,
        message: 'Invoice persisted and inventory adjusted via delta operations',
      };
    } catch (error) {
      logError('SyncService.processInvoiceEvent', error, { clientEventId: invoice.id });
      return {
        clientEventId: invoice.id,
        eventType: 'ORDER_INVOICE',
        status: SyncResultStatus.REJECTED,
        message: error instanceof Error ? error.message : 'Unknown error during invoice processing',
      };
    }
  }


  /**
   * Create missing product/lot/stock so an offline POS invoice can land.
   * Initial on-hand is set so the subsequent sale/return delta does not go negative.
   */
  private async ensureStockRowForInvoiceItem(
    manager: EntityManager,
    invoice: SyncOrderInvoiceDto,
    item: SyncOrderInvoiceDto['items'][number],
    isReturn: boolean,
  ): Promise<LotInventoryStock> {
    const productRepo = manager.getRepository(Product);
    const lotRepo = manager.getRepository(ProductLot);
    const stockRepo = manager.getRepository(LotInventoryStock);

    let product = await productRepo.findOne({ where: { id: item.productId } });
    if (!product) {
      const sku = `POS-${item.productId.replace(/-/g, '').slice(0, 12)}`;
      const barcode = (item.barcode && item.barcode.trim()) || sku.slice(0, 32);
      product = productRepo.create({
        id: item.productId,
        tenantId: invoice.tenantId,
        sku,
        baseBarcode: barcode.slice(0, 32),
        name: item.barcode ? `Item ${item.barcode}` : `POS product ${item.productId.slice(0, 8)}`,
        mrp: item.mrp ?? item.unitPrice,
        saleRate: item.unitPrice,
        purchaseRate: 0,
        isActive: true,
      });
      await productRepo.save(product);
      logWarn('SyncService.ensureStockRowForInvoiceItem', 'Created missing product from invoice line', {
        productId: product.id,
        invoiceId: invoice.id,
      });
    }

    let lot = await lotRepo.findOne({ where: { id: item.lotId } });
    if (!lot) {
      const now = new Date();
      const expiry = new Date(now);
      expiry.setFullYear(expiry.getFullYear() + 2);
      const batch = (item.batchNumber && item.batchNumber.trim()) || `POS-${item.lotId.slice(0, 8)}`;
      lot = lotRepo.create({
        id: item.lotId,
        productId: product.id,
        batchNumber: batch,
        costPrice: 0,
        mrp: item.mrp ?? item.unitPrice,
        manufactureDate: now,
        expiryDate: expiry,
        lotBarcode: `LOT-${item.lotId.replace(/-/g, '').slice(0, 20)}`,
        isActive: true,
      });
      await lotRepo.save(lot);
      logWarn('SyncService.ensureStockRowForInvoiceItem', 'Created missing lot from invoice line', {
        lotId: lot.id,
        invoiceId: invoice.id,
      });
    }

    // Sale needs enough qty to cover delta; return starts at 0 then adds back.
    const initialQty = isReturn ? 0 : Math.max(0, Number(item.quantity) || 0);
    const created = stockRepo.create({
      lotId: item.lotId,
      facilityId: invoice.facilityId,
      quantityOnHand: initialQty,
      aisleShelfLocation: null,
    });
    await stockRepo.save(created);
    logWarn('SyncService.ensureStockRowForInvoiceItem', 'Created missing facility stock from invoice line', {
      lotId: item.lotId,
      facilityId: invoice.facilityId,
      initialQty,
      invoiceId: invoice.id,
    });

    const locked = await stockRepo.findOne({
      where: { lotId: item.lotId, facilityId: invoice.facilityId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!locked) {
      throw createAppError(
        `Failed to create inventory stock for lot ${item.lotId} at facility ${invoice.facilityId}`,
        500,
        'STOCK_CREATE_FAILED',
        { lotId: item.lotId, facilityId: invoice.facilityId },
      );
    }
    return locked;
  }

  private async persistInvoiceWithDeltaStockReduction(
    manager: EntityManager,
    invoice: SyncOrderInvoiceDto,
  ): Promise<void> {
    const orderRepository = manager.getRepository(OrderInvoice);
    const itemRepository = manager.getRepository(OrderItem);
    const stockRepository = manager.getRepository(LotInventoryStock);
    const movementRepository = manager.getRepository(StockMovement);
    const saleType = invoice.saleType ?? 'CASH_SALE';
    const isReturn = saleType === 'RETURN';

    const existingOrder = await orderRepository.findOne({ where: { id: invoice.id } });
    if (existingOrder !== null) {
      throw createAppError('Order invoice already exists', 409, 'DUPLICATE_ORDER', {
        orderId: invoice.id,
      });
    }

    const cashierId = await this.resolveCashierIdForSync(
      manager,
      invoice.cashierId,
      invoice.tenantId,
    );

    const orderEntity = orderRepository.create({
      id: invoice.id,
      tenantId: invoice.tenantId,
      facilityId: invoice.facilityId,
      cashierId,
      cashierName: invoice.cashierName ?? null,
      customerPayload: invoice.customerPayload,
      invoiceNumber: invoice.invoiceNumber ?? null,
      saleType,
      status: invoice.status ?? 'COMPLETED',
      customerMobile: invoice.customerMobile ?? null,
      subtotal: invoice.subtotal,
      taxableValue: invoice.taxableValue ?? invoice.subtotal,
      taxTotal: invoice.taxTotal,
      discountTotal: invoice.discountTotal,
      billDiscountPercent: invoice.billDiscountPercent ?? 0,
      redeemAmount: invoice.redeemAmount ?? 0,
      grossSale: invoice.grossSale ?? invoice.finalPayable,
      roundOff: invoice.roundOff ?? 0,
      amountTendered: invoice.amountTendered ?? 0,
      changeDue: invoice.changeDue ?? 0,
      returnOfInvoiceId: invoice.returnOfInvoiceId ?? null,
      finalPayable: invoice.finalPayable,
      paymentChannel: invoice.paymentChannel,
      originSource: invoice.originSource,
      isSynced: true,
      createdAt: new Date(invoice.createdAt),
    });

    await orderRepository.save(orderEntity);

    if (isReturn && invoice.returnOfInvoiceId) {
      await orderRepository.update(
        { id: invoice.returnOfInvoiceId, status: 'COMPLETED' },
        { status: 'RETURNED' },
      );
    }

    for (const item of invoice.items) {
      const signedDelta = stockDeltaForSaleType(saleType, item.quantity);
      let stockRecord = await stockRepository.findOne({
        where: { lotId: item.lotId, facilityId: invoice.facilityId },
        lock: { mode: 'pessimistic_write' },
      });

      if (stockRecord === null) {
        // Offline POS may sell lots that exist locally (stock import / purchase)
        // before central has a facility stock row. Auto-heal instead of rejecting forever.
        stockRecord = await this.ensureStockRowForInvoiceItem(manager, invoice, item, isReturn);
      }

      const currentQuantity = Number(stockRecord.quantityOnHand);
      let newQuantity = currentQuantity + signedDelta;

      if (newQuantity < 0) {
        // Trust POS: it already completed the sale offline. Clamp rather than reject.
        logWarn('SyncService.persistInvoiceWithDeltaStockReduction', 'Clamping negative stock after offline sale', {
          lotId: item.lotId,
          facilityId: invoice.facilityId,
          currentQuantity,
          signedDelta,
        });
        newQuantity = 0;
      }

      stockRecord.quantityOnHand = newQuantity;
      await stockRepository.save(stockRecord);

      const orderItem = itemRepository.create({
        id: item.id,
        orderId: invoice.id,
        productId: item.productId,
        lotId: item.lotId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        barcode: item.barcode ?? null,
        batchNumber: item.batchNumber ?? null,
        mrp: item.mrp ?? 0,
        discountPercent: item.discountPercent ?? 0,
        discountAmount: item.discountAmount ?? 0,
        calculatedTax: item.calculatedTax,
        netAmount: item.netAmount,
      });

      await itemRepository.save(orderItem);

      await movementRepository.save(
        movementRepository.create({
          tenantId: invoice.tenantId,
          facilityId: invoice.facilityId,
          productId: item.productId,
          lotId: item.lotId,
          movementType: isReturn ? StockMovementType.RETURN : StockMovementType.SALE,
          quantity: Math.abs(signedDelta),
          remark: isReturn ? `Return ${invoice.id}` : `Sale ${invoice.id}`,
          referenceId: invoice.id,
        }),
      );

      logInfo('SyncService.persistInvoiceWithDeltaStockReduction', 'Delta stock applied', {
        lotId: item.lotId,
        facilityId: invoice.facilityId,
        previousQuantity: currentQuantity,
        signedDelta,
        newQuantity,
        saleType,
      });
    }
  }

  private async processAttendanceEvent(
    attendance: SyncAttendanceDto,
    expectedTenantId: string,
  ): Promise<SyncEventResultDto> {
    if (attendance.tenantId !== expectedTenantId) {
      return {
        clientEventId: attendance.id,
        eventType: 'WORKFORCE_ATTENDANCE',
        status: SyncResultStatus.REJECTED,
        message: 'Attendance tenantId does not match sync request tenant context',
      };
    }

    try {
      const dataSource = getDataSource();
      const existingLog = await dataSource.getRepository(SyncEventLog).findOne({
        where: { clientEventId: attendance.id },
      });

      if (existingLog !== null) {
        return {
          clientEventId: attendance.id,
          eventType: 'WORKFORCE_ATTENDANCE',
          status: SyncResultStatus.DUPLICATE,
          message: 'Attendance record already processed (idempotent duplicate)',
        };
      }

      await dataSource.transaction(async (manager: EntityManager) => {
        const attendanceRepository = manager.getRepository(WorkforceAttendance);
        const existing = await attendanceRepository.findOne({ where: { id: attendance.id } });

        if (existing !== null) {
          throw createAppError('Attendance record already exists', 409, 'DUPLICATE_ATTENDANCE', {
            attendanceId: attendance.id,
          });
        }

        const entity = attendanceRepository.create({
          id: attendance.id,
          tenantId: attendance.tenantId,
          userId: attendance.userId,
          facilityId: attendance.facilityId,
          clockIn: new Date(attendance.clockIn),
          clockOut: attendance.clockOut ? new Date(attendance.clockOut) : null,
          biometricSignatureHash: attendance.biometricSignatureHash,
          isSynced: true,
        });

        await attendanceRepository.save(entity);
        await this.recordSyncEvent(
          manager,
          attendance.id,
          attendance.tenantId,
          SyncEventType.WORKFORCE_ATTENDANCE,
          attendance,
        );
      });

      return {
        clientEventId: attendance.id,
        eventType: 'WORKFORCE_ATTENDANCE',
        status: SyncResultStatus.ACCEPTED,
        message: 'Attendance record persisted',
      };
    } catch (error) {
      logError('SyncService.processAttendanceEvent', error, { clientEventId: attendance.id });
      return {
        clientEventId: attendance.id,
        eventType: 'WORKFORCE_ATTENDANCE',
        status: SyncResultStatus.REJECTED,
        message: error instanceof Error ? error.message : 'Unknown error during attendance processing',
      };
    }
  }

  private async recordSyncEvent(
    manager: EntityManager,
    clientEventId: string,
    tenantId: string,
    eventType: SyncEventType,
    payload: unknown,
  ): Promise<void> {
    const syncLogRepository = manager.getRepository(SyncEventLog);
    const logEntry = syncLogRepository.create({
      id: uuidv4(),
      clientEventId,
      tenantId,
      eventType,
      payloadSnapshot: payload as Record<string, unknown>,
    });
    await syncLogRepository.save(logEntry);
  }
}

export const syncService = new SyncService();
