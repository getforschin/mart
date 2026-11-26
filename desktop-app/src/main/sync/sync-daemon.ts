import { Worker } from 'worker_threads';
import path from 'path';
import { BrowserWindow } from 'electron';
import { posDatabaseService } from '../database/pos-database.service';
import { SyncStatusEvent } from '../../shared/types';

const POLL_INTERVAL_MS = 10_000;

export class SyncDaemon {
  private worker: Worker | null = null;
  private mainWindow: BrowserWindow | null = null;
  private pendingInvoiceIds: string[] = [];
  private pendingAttendanceIds: string[] = [];

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
        pollIntervalMs: POLL_INTERVAL_MS,
      },
    });

    this.worker.on('message', (message: Record<string, unknown>) => {
      this.handleWorkerMessage(message);
    });

    this.worker.on('error', (error: Error) => {
      this.broadcastSyncStatus({
        timestamp: new Date().toISOString(),
        online: false,
        invoicesSynced: 0,
        attendanceSynced: 0,
        errors: [error.message],
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

  private handleWorkerMessage(message: Record<string, unknown>): void {
    if (message.type === 'REQUEST_UNSYNCED_DATA') {
      this.triggerSyncCycle();
      return;
    }

    if (message.type === 'CONNECTIVITY_CHANGE') {
      this.broadcastSyncStatus({
        timestamp: String(message.timestamp),
        online: Boolean(message.online),
        invoicesSynced: 0,
        attendanceSynced: 0,
        errors: [],
      });
      return;
    }

    if (message.type === 'SYNC_COMPLETE' && Boolean(message.online)) {
      const invoicesSynced = Number(message.invoicesSynced ?? 0);
      const attendanceSynced = Number(message.attendanceSynced ?? 0);

      if (invoicesSynced > 0 || attendanceSynced > 0) {
        this.commitSyncedRecords();
      }

      this.broadcastSyncStatus({
        timestamp: String(message.timestamp),
        online: true,
        invoicesSynced,
        attendanceSynced,
        errors: Array.isArray(message.errors) ? (message.errors as string[]) : [],
      });
      return;
    }

    if (message.type === 'SYNC_ERROR') {
      this.broadcastSyncStatus({
        timestamp: String(message.timestamp),
        online: Boolean(message.online),
        invoicesSynced: 0,
        attendanceSynced: 0,
        errors: Array.isArray(message.errors) ? (message.errors as string[]) : ['Sync error'],
      });
    }
  }

  private triggerSyncCycle(): void {
    if (this.worker === null) return;

    const unsyncedInvoices = posDatabaseService.getUnsyncedInvoices();
    const unsyncedAttendance = posDatabaseService.getUnsyncedAttendance();

    this.pendingInvoiceIds = unsyncedInvoices.map((inv) => inv.id);
    this.pendingAttendanceIds = unsyncedAttendance.map((att) => att.id);

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

    this.worker.postMessage({
      type: 'TRIGGER_SYNC',
      unsyncedData: {
        invoices: invoicePayloads,
        attendanceRecords: attendancePayloads,
      },
    });
  }

  private commitSyncedRecords(): void {
    const { getDatabase } = require('../database/sqlite-manager') as {
      getDatabase: () => import('better-sqlite3').Database;
    };

    const db = getDatabase();
    const commitTransaction = db.transaction(() => {
      posDatabaseService.markInvoicesSynced(this.pendingInvoiceIds);
      posDatabaseService.markAttendanceSynced(this.pendingAttendanceIds);
    });

    commitTransaction();
    this.pendingInvoiceIds = [];
    this.pendingAttendanceIds = [];
  }

  private broadcastSyncStatus(event: SyncStatusEvent): void {
    if (this.mainWindow !== null && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('sync:status', event);
    }
  }
}

export const syncDaemon = new SyncDaemon();
