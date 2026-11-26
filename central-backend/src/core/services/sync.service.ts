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
} from '../../dtos';
import {
  OrderInvoice,
  OrderItem,
  WorkforceAttendance,
  SyncEventLog,
  LotInventoryStock,
  SyncEventType,
  SyncResultStatus,
} from '../../models';

export class SyncService {
  async pushOfflineEvents(request: SyncPushRequestDto): Promise<SyncPushResponseDto> {
    const results: SyncEventResultDto[] = [];

    logInfo('SyncService.pushOfflineEvents', 'Processing offline sync batch', {
      tenantId: request.tenantId,
      facilityId: request.facilityId,
      deviceId: request.deviceId,
      invoiceCount: request.invoices.length,
      attendanceCount: request.attendanceRecords.length,
    });

    for (const invoice of request.invoices) {
      const result = await this.processInvoiceEvent(invoice, request.tenantId);
      results.push(result);
    }

    for (const attendance of request.attendanceRecords) {
      const result = await this.processAttendanceEvent(attendance, request.tenantId);
      results.push(result);
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
      throw createAppError(
        'Order invoice already exists',
        409,
        'DUPLICATE_ORDER',
        { orderId: invoice.id },
      );
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
    payload: SyncOrderInvoiceDto | SyncAttendanceDto,
  ): Promise<void> {
    const syncLogRepository = manager.getRepository(SyncEventLog);
    const logEntry = syncLogRepository.create({
      id: uuidv4(),
      clientEventId,
      tenantId,
      eventType,
      payloadSnapshot: payload as unknown as Record<string, unknown>,
    });
    await syncLogRepository.save(logEntry);
  }
}

export const syncService = new SyncService();
