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
  SyncStockEventDto,
  SyncPullRequestDto,
  SyncPullResponseDto,
} from '../../dtos';
import {
  OrderInvoice,
  OrderItem,
  WorkforceAttendance,
  SyncEventLog,
  LotInventoryStock,
  ProductLot,
  Product,
  Customer,
  SyncEventType,
  SyncResultStatus,
  GstMode,
  PurchaseStatus,
} from '../../models';
import { erpService } from './erp.service';

function num(value: unknown): number {
  return Number(value ?? 0);
}

export class SyncService {
  async pushOfflineEvents(request: SyncPushRequestDto): Promise<SyncPushResponseDto> {
    const results: SyncEventResultDto[] = [];
    const invoices = request.invoices ?? [];
    const attendanceRecords = request.attendanceRecords ?? [];
    const customers = request.customers ?? [];
    const purchases = request.purchases ?? [];
    const stockEvents = request.stockEvents ?? [];

    logInfo('SyncService.pushOfflineEvents', 'Processing offline sync batch', {
      tenantId: request.tenantId,
      facilityId: request.facilityId,
      deviceId: request.deviceId,
      invoiceCount: invoices.length,
      attendanceCount: attendanceRecords.length,
      customerCount: customers.length,
      purchaseCount: purchases.length,
      stockEventCount: stockEvents.length,
    });

    for (const customer of customers) {
      results.push(await this.processCustomerEvent(customer, request.tenantId));
    }
    for (const purchase of purchases) {
      results.push(await this.processPurchaseEvent(purchase, request.tenantId));
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
        items: purchase.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          barcode: item.barcode,
          quantity: item.quantity,
          purchaseRate: item.purchaseRate,
          mrp: item.mrp,
          saleRate: item.saleRate,
          gstPercent: item.gstPercent,
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
        message: 'Invoice persisted and inventory reduced via delta operations',
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

  private async persistInvoiceWithDeltaStockReduction(
    manager: EntityManager,
    invoice: SyncOrderInvoiceDto,
  ): Promise<void> {
    const orderRepository = manager.getRepository(OrderInvoice);
    const itemRepository = manager.getRepository(OrderItem);
    const stockRepository = manager.getRepository(LotInventoryStock);

    const existingOrder = await orderRepository.findOne({ where: { id: invoice.id } });
    if (existingOrder !== null) {
      throw createAppError('Order invoice already exists', 409, 'DUPLICATE_ORDER', {
        orderId: invoice.id,
      });
    }

    const orderEntity = orderRepository.create({
      id: invoice.id,
      tenantId: invoice.tenantId,
      facilityId: invoice.facilityId,
      cashierId: invoice.cashierId,
      customerPayload: invoice.customerPayload,
      subtotal: invoice.subtotal,
      taxTotal: invoice.taxTotal,
      discountTotal: invoice.discountTotal,
      finalPayable: invoice.finalPayable,
      paymentChannel: invoice.paymentChannel,
      originSource: invoice.originSource,
      isSynced: true,
      createdAt: new Date(invoice.createdAt),
    });

    await orderRepository.save(orderEntity);

    for (const item of invoice.items) {
      const stockRecord = await stockRepository.findOne({
        where: { lotId: item.lotId, facilityId: invoice.facilityId },
        lock: { mode: 'pessimistic_write' },
      });

      if (stockRecord === null) {
        throw createAppError(
          `No inventory stock record for lot ${item.lotId} at facility ${invoice.facilityId}`,
          422,
          'STOCK_NOT_FOUND',
          { lotId: item.lotId, facilityId: invoice.facilityId },
        );
      }

      const currentQuantity = Number(stockRecord.quantityOnHand);
      const deltaQuantity = item.quantity;
      const newQuantity = currentQuantity - deltaQuantity;

      if (newQuantity < 0) {
        throw createAppError(
          `Insufficient stock for lot ${item.lotId}: current=${currentQuantity}, delta=${deltaQuantity}`,
          422,
          'INSUFFICIENT_STOCK',
          { lotId: item.lotId, currentQuantity, deltaQuantity },
        );
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
        calculatedTax: item.calculatedTax,
        netAmount: item.netAmount,
      });

      await itemRepository.save(orderItem);

      logInfo('SyncService.persistInvoiceWithDeltaStockReduction', 'Delta stock reduction applied', {
        lotId: item.lotId,
        facilityId: invoice.facilityId,
        previousQuantity: currentQuantity,
        deltaQuantity,
        newQuantity,
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
