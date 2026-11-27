import { Worker } from 'worker_threads';
import path from 'path';
import { BrowserWindow } from 'electron';
import { posDatabaseService } from '../database/pos-database.service';
import { SyncPendingCounts, SyncStatusEvent } from '../../shared/types';

/** Push local outbox often; pull admin/web changes every 5 minutes. */
const PUSH_INTERVAL_MS = 30_000;
const PULL_INTERVAL_MS = 5 * 60_000;

const EMPTY_COUNTS: SyncPendingCounts = {
  bills: 0,
  customers: 0,
  purchases: 0,
  stock: 0,
  attendance: 0,
};

export class SyncDaemon {
  private worker: Worker | null = null;
  private mainWindow: BrowserWindow | null = null;
  private pendingInvoiceIds: string[] = [];
  private pendingAttendanceIds: string[] = [];
  private pendingCustomerIds: string[] = [];
  private pendingPurchaseIds: string[] = [];
  private pendingStockEventIds: string[] = [];
  private syncInFlight = false;

  start(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    const config = posDatabaseService.getConfig();

    const workerPath = path.join(__dirname, 'sync-daemon.worker.js');

    this.worker = new Worker(workerPath, {
      workerData: {
        apiBaseUrl: config.apiBaseUrl,
        tenantId: config.tenantId,
        facilityId: config.facilityId,
        deviceId: config.deviceId,
        pushIntervalMs: PUSH_INTERVAL_MS,
        pullIntervalMs: PULL_INTERVAL_MS,
      },
    });

    this.worker.on('message', (message: Record<string, unknown>) => {
      this.handleWorkerMessage(message);
    });

    this.worker.on('error', (error: Error) => {
      this.syncInFlight = false;
      this.broadcastSyncStatus({
        timestamp: new Date().toISOString(),
        online: false,
        lastApiContactAt: posDatabaseService.getConfigValue('lastApiContactAt'),
        lastSyncAt: posDatabaseService.getConfigValue('lastSyncAt'),
        pending: posDatabaseService.getPendingSyncCounts(),
        lastSynced: EMPTY_COUNTS,
        invoicesSynced: 0,
        attendanceSynced: 0,
        errors: [error.message],
        syncing: false,
      });
    });

    this.worker.postMessage({ type: 'START' });
  }

  stop(): void {
    if (this.worker !== null) {
      this.worker.postMessage({ type: 'STOP' });
      void this.worker.terminate();
      this.worker = null;
    }
  }

  /** Manual Sync Now — push local outbox + pull central changes. Non-blocking for POS UI. */
  requestManualSync(): { started: boolean; reason?: string } {
    if (this.worker === null) {
      return { started: false, reason: 'Sync daemon not running' };
    }
    if (this.syncInFlight) {
      return { started: false, reason: 'Sync already in progress' };
    }
    this.broadcastSyncStatus({
      timestamp: new Date().toISOString(),
      online: posDatabaseService.getConfigValue('lastOnline') === '1',
      lastApiContactAt: posDatabaseService.getConfigValue('lastApiContactAt'),
      lastSyncAt: posDatabaseService.getConfigValue('lastSyncAt'),
      pending: posDatabaseService.getPendingSyncCounts(),
      lastSynced: EMPTY_COUNTS,
      invoicesSynced: 0,
      attendanceSynced: 0,
      errors: [],
      syncing: true,
    });
    this.triggerSyncCycle({ push: true, pull: true });
    return { started: true };
  }

  private handleWorkerMessage(message: Record<string, unknown>): void {
    if (message.type === 'REQUEST_PUSH') {
      this.triggerSyncCycle({ push: true, pull: false });
      return;
    }

    if (message.type === 'REQUEST_PULL') {
      this.triggerSyncCycle({ push: false, pull: true });
      return;
    }

    if (message.type === 'SYNC_BUSY') {
      return;
    }

    if (message.type === 'CONNECTIVITY_CHANGE') {
      const online = Boolean(message.online);
      const timestamp = String(message.timestamp);
      posDatabaseService.setConfigValue('lastOnline', online ? '1' : '0');
      if (online) {
        posDatabaseService.setConfigValue('lastApiContactAt', timestamp);
      }
      this.broadcastSyncStatus({
        timestamp,
        online,
        lastApiContactAt: posDatabaseService.getConfigValue('lastApiContactAt'),
        lastSyncAt: posDatabaseService.getConfigValue('lastSyncAt'),
        pending: posDatabaseService.getPendingSyncCounts(),
        lastSynced: EMPTY_COUNTS,
        invoicesSynced: 0,
        attendanceSynced: 0,
        errors: [],
        syncing: this.syncInFlight,
      });
      return;
    }

    if (message.type === 'SYNC_COMPLETE') {
      this.syncInFlight = false;
      const online = Boolean(message.online);
      const timestamp = String(message.timestamp);
      posDatabaseService.setConfigValue('lastOnline', online ? '1' : '0');
      if (online) {
        posDatabaseService.setConfigValue('lastApiContactAt', timestamp);
      }

      const acceptedIds = Array.isArray(message.acceptedIds)
        ? (message.acceptedIds as string[])
        : [];
      const acceptedSet = new Set(acceptedIds);

      const invoiceIds = this.pendingInvoiceIds.filter((id) => acceptedSet.has(id));
      const attendanceIds = this.pendingAttendanceIds.filter((id) => acceptedSet.has(id));
      const customerIds = this.pendingCustomerIds.filter((id) => acceptedSet.has(id));
      const purchaseIds = this.pendingPurchaseIds.filter((id) => acceptedSet.has(id));
      const stockIds = this.pendingStockEventIds.filter((id) => acceptedSet.has(id));

      if (
        invoiceIds.length +
          attendanceIds.length +
          customerIds.length +
          purchaseIds.length +
          stockIds.length >
        0
      ) {
        // Short DB writes only — POS billing continues on its own transactions
        posDatabaseService.markInvoicesSynced(invoiceIds);
        posDatabaseService.markAttendanceSynced(attendanceIds);
        posDatabaseService.markCustomersSynced(customerIds);
        posDatabaseService.markPurchasesSynced(purchaseIds);
        posDatabaseService.markStockEventsSynced(stockIds);
        posDatabaseService.setConfigValue('lastSyncAt', timestamp);
      }

      const pull = message.pull as
        | { customers: unknown[]; lots: unknown[]; pulledAt: string }
        | undefined;
      if (pull && online && message.pulled) {
        // Defer apply so this tick doesn't stall renderer IPC
        setImmediate(() => {
          try {
            posDatabaseService.applyPulledState({
              customers: pull.customers as Parameters<
                typeof posDatabaseService.applyPulledState
              >[0]['customers'],
              lots: pull.lots as Parameters<typeof posDatabaseService.applyPulledState>[0]['lots'],
            });
            posDatabaseService.setConfigValue('lastPullAt', pull.pulledAt);
            this.broadcastSyncStatus({
              timestamp: new Date().toISOString(),
              online: true,
              lastApiContactAt: posDatabaseService.getConfigValue('lastApiContactAt'),
              lastSyncAt: posDatabaseService.getConfigValue('lastSyncAt'),
              pending: posDatabaseService.getPendingSyncCounts(),
              lastSynced: EMPTY_COUNTS,
              invoicesSynced: 0,
              attendanceSynced: 0,
              errors: [],
              syncing: false,
            });
          } catch (error) {
            this.broadcastSyncStatus({
              timestamp: new Date().toISOString(),
              online: true,
              lastApiContactAt: posDatabaseService.getConfigValue('lastApiContactAt'),
              lastSyncAt: posDatabaseService.getConfigValue('lastSyncAt'),
              pending: posDatabaseService.getPendingSyncCounts(),
              lastSynced: EMPTY_COUNTS,
              invoicesSynced: 0,
              attendanceSynced: 0,
              errors: [error instanceof Error ? error.message : 'Pull apply failed'],
              syncing: false,
            });
          }
        });
      }

      const lastSynced: SyncPendingCounts = {
        bills: invoiceIds.length,
        customers: customerIds.length,
        purchases: purchaseIds.length,
        stock: stockIds.length,
        attendance: attendanceIds.length,
      };

      this.pendingInvoiceIds = [];
      this.pendingAttendanceIds = [];
      this.pendingCustomerIds = [];
      this.pendingPurchaseIds = [];
      this.pendingStockEventIds = [];

      this.broadcastSyncStatus({
        timestamp,
        online,
        lastApiContactAt: posDatabaseService.getConfigValue('lastApiContactAt'),
        lastSyncAt: posDatabaseService.getConfigValue('lastSyncAt'),
        pending: posDatabaseService.getPendingSyncCounts(),
        lastSynced,
        invoicesSynced: lastSynced.bills,
        attendanceSynced: lastSynced.attendance,
        errors: Array.isArray(message.errors) ? (message.errors as string[]) : [],
        syncing: Boolean(message.pulled && pull),
      });
      return;
    }

    if (message.type === 'SYNC_ERROR') {
      this.syncInFlight = false;
      this.broadcastSyncStatus({
        timestamp: String(message.timestamp),
        online: Boolean(message.online),
        lastApiContactAt: posDatabaseService.getConfigValue('lastApiContactAt'),
        lastSyncAt: posDatabaseService.getConfigValue('lastSyncAt'),
        pending: posDatabaseService.getPendingSyncCounts(),
        lastSynced: EMPTY_COUNTS,
        invoicesSynced: 0,
        attendanceSynced: 0,
        errors: Array.isArray(message.errors) ? (message.errors as string[]) : ['Sync error'],
        syncing: false,
      });
    }
  }

  private triggerSyncCycle(options: { push: boolean; pull: boolean }): void {
    if (this.worker === null) return;
    if (this.syncInFlight) return;
    this.syncInFlight = true;

    const unsyncedInvoices = options.push ? posDatabaseService.getUnsyncedInvoices() : [];
    const unsyncedAttendance = options.push ? posDatabaseService.getUnsyncedAttendance() : [];
    const unsyncedCustomers = options.push ? posDatabaseService.getUnsyncedCustomers() : [];
    const unsyncedPurchases = options.push ? posDatabaseService.getUnsyncedPurchases() : [];
    const unsyncedStockEvents = options.push ? posDatabaseService.getUnsyncedStockEvents() : [];
    const config = posDatabaseService.getConfig();

    this.pendingInvoiceIds = unsyncedInvoices.map((inv) => inv.id);
    this.pendingAttendanceIds = unsyncedAttendance.map((att) => att.id);
    this.pendingCustomerIds = unsyncedCustomers.map((c) => String(c.id));
    this.pendingPurchaseIds = unsyncedPurchases.map((p) => String(p.id));
    this.pendingStockEventIds = unsyncedStockEvents.map((e) => String(e.id));

    // If push requested but nothing pending and no pull, finish quickly
    const hasPending =
      unsyncedInvoices.length +
        unsyncedAttendance.length +
        unsyncedCustomers.length +
        unsyncedPurchases.length +
        unsyncedStockEvents.length >
      0;
    if (options.push && !options.pull && !hasPending) {
      this.syncInFlight = false;
      // Still ping connectivity via worker with empty push
    }

    const invoicePayloads = unsyncedInvoices.map((invoice) => ({
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
      createdAt: invoice.createdAt,
      items: invoice.items.map((item) => ({
        id: `${invoice.id}-${item.lotId}`,
        productId: item.productId,
        lotId: item.lotId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        calculatedTax: item.calculatedTax,
        netAmount: item.netAmount,
      })),
    }));

    const attendancePayloads = unsyncedAttendance.map((record) => ({
      id: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      facilityId: record.facilityId,
      clockIn: record.clockIn,
      clockOut: record.clockOut,
      biometricSignatureHash: record.biometricSignatureHash,
    }));

    const customerPayloads = unsyncedCustomers.map((c) => ({
      id: String(c.id),
      tenantId: config.tenantId,
      name: String(c.name),
      mobile: String(c.mobile),
      email: c.email ? String(c.email) : null,
      previousDue: Number(c.previous_due ?? 0),
      membershipCard: c.membership_card ? String(c.membership_card) : null,
      loyaltyPoints: Number(c.loyalty_points ?? 0),
      updatedAt: String(c.updated_at ?? new Date().toISOString()),
    }));

    const purchasePayloads = unsyncedPurchases.map((p) => {
      const items = (p.items as Array<Record<string, unknown>> | undefined) ?? [];
      return {
        id: String(p.id),
        tenantId: String(p.tenant_id),
        facilityId: String(p.facility_id),
        supplierId: String(p.supplier_id),
        invoiceNumber: p.invoice_number ? String(p.invoice_number) : undefined,
        invoiceDate: String(p.invoice_date),
        gstMode: String(p.gst_mode ?? 'NON_GST'),
        remark: p.remark ? String(p.remark) : undefined,
        status: String(p.status ?? 'COMPLETED'),
        otherCharges: Number(p.other_charges ?? 0),
        items: items.map((item) => ({
          productId: String(item.product_id),
          productName: String(item.product_name),
          barcode: item.barcode ? String(item.barcode) : undefined,
          quantity: Number(item.quantity),
          purchaseRate: Number(item.purchase_rate),
          mrp: Number(item.mrp),
          saleRate: Number(item.sale_rate),
          gstPercent: Number(item.gst_percent ?? 0),
          lotId: item.lot_id ? String(item.lot_id) : null,
        })),
      };
    });

    const stockEventPayloads = unsyncedStockEvents.map((e) => ({
      id: String(e.id),
      tenantId: String(e.tenant_id),
      facilityId: String(e.facility_id),
      eventType: String(e.event_type) as 'DUMP' | 'CORRECTION' | 'TRANSFER',
      productId: String(e.product_id),
      lotId: String(e.lot_id),
      quantity: Number(e.quantity ?? 0),
      newQuantity:
        e.new_quantity !== null && e.new_quantity !== undefined ? Number(e.new_quantity) : undefined,
      toFacilityId: e.to_facility_id ? String(e.to_facility_id) : undefined,
      remark: e.remark ? String(e.remark) : undefined,
      createdAt: String(e.created_at),
    }));

    this.worker.postMessage({
      type: 'TRIGGER_SYNC',
      push: options.push,
      pull: options.pull,
      unsyncedData: {
        invoices: invoicePayloads,
        attendanceRecords: attendancePayloads,
        customers: customerPayloads,
        purchases: purchasePayloads,
        stockEvents: stockEventPayloads,
      },
      since: posDatabaseService.getConfigValue('lastPullAt') || null,
    });
  }

  private broadcastSyncStatus(event: SyncStatusEvent): void {
    if (this.mainWindow !== null && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('sync:status', event);
    }
  }
}

export const syncDaemon = new SyncDaemon();
