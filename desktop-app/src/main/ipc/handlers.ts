import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { posDatabaseService } from '../database/pos-database.service';
import { syncDaemon } from '../sync/sync-daemon';
import {
  BarcodeResolutionResult,
  CreateInvoicePayload,
  InventoryRow,
  LocalAttendanceRecord,
  LocalOrderInvoice,
  LoginRequest,
  PosConfig,
  PosCustomer,
  PosFacility,
  PosSession,
  ProductSearchHit,
  SalesReportSummary,
} from '../../shared/types';

function wrapHandler<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
  return (...args: TArgs): TResult => {
    try {
      return handler(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown IPC handler error';
      throw new Error(message);
    }
  };
}

export function registerIpcHandlers(): void {
  ipcMain.handle('pos:getConfig', wrapHandler((): PosConfig => posDatabaseService.getConfig()));

  ipcMain.handle(
    'pos:getFacilities',
    wrapHandler((): PosFacility[] => posDatabaseService.auth.getFacilities()),
  );

  ipcMain.handle(
    'pos:login',
    wrapHandler((_event: IpcMainInvokeEvent, credentials: LoginRequest): PosSession => {
      if (!credentials?.username || !credentials?.password || !credentials?.facilityId) {
        throw new Error('Username, password, and center are required');
      }
      return posDatabaseService.auth.login(
        credentials.username,
        credentials.password,
        credentials.facilityId,
      );
    }),
  );

  ipcMain.handle('pos:logout', wrapHandler((): void => posDatabaseService.auth.logout()));

  ipcMain.handle(
    'pos:getSession',
    wrapHandler((): PosSession | null => posDatabaseService.auth.getSession()),
  );

  ipcMain.handle(
    'pos:lookupCustomerByMobile',
    wrapHandler((_event: IpcMainInvokeEvent, mobile: string): PosCustomer | null => {
      return posDatabaseService.lookupCustomerByMobile(mobile);
    }),
  );

  ipcMain.handle(
    'pos:upsertCustomer',
    wrapHandler(
      (
        _event: IpcMainInvokeEvent,
        input: { name: string; mobile: string; email?: string | null },
      ): PosCustomer => {
        if (!input || typeof input.name !== 'string' || typeof input.mobile !== 'string') {
          throw new Error('Customer name and mobile are required');
        }
        return posDatabaseService.upsertCustomer(input);
      },
    ),
  );

  ipcMain.handle(
    'pos:searchCustomers',
    wrapHandler((_event: IpcMainInvokeEvent, query: string): PosCustomer[] => {
      if (typeof query !== 'string') throw new Error('Query must be a string');
      return posDatabaseService.searchCustomers(query);
    }),
  );

  ipcMain.handle(
    'pos:resolveBarcode',
    wrapHandler((_event: IpcMainInvokeEvent, barcode: string): BarcodeResolutionResult => {
      if (typeof barcode !== 'string') throw new Error('Barcode must be a string');
      return posDatabaseService.resolveBarcode(barcode);
    }),
  );

  ipcMain.handle(
    'pos:searchProducts',
    wrapHandler((_event: IpcMainInvokeEvent, query: string): ProductSearchHit[] => {
      if (typeof query !== 'string') throw new Error('Query must be a string');
      return posDatabaseService.searchProducts(query);
    }),
  );

  ipcMain.handle(
    'pos:previewNextInvoiceNumber',
    wrapHandler((): string => posDatabaseService.previewNextInvoiceNumber()),
  );

  ipcMain.handle(
    'pos:listInventory',
    wrapHandler(
      (
        _event: IpcMainInvokeEvent,
        query?: string,
        options?: { inStockOnly?: boolean; sortBy?: 'name' | 'mrp' | 'qty' },
      ): InventoryRow[] => {
        return posDatabaseService.listInventory(typeof query === 'string' ? query : '', options ?? {});
      },
    ),
  );

  ipcMain.handle(
    'pos:listInvoices',
    wrapHandler((_event: IpcMainInvokeEvent, limit?: number): LocalOrderInvoice[] => {
      return posDatabaseService.listInvoices(typeof limit === 'number' ? limit : 100);
    }),
  );

  ipcMain.handle(
    'pos:listDraftInvoices',
    wrapHandler((): LocalOrderInvoice[] => posDatabaseService.listDraftInvoices()),
  );

  ipcMain.handle(
    'pos:getInvoice',
    wrapHandler((_event: IpcMainInvokeEvent, invoiceId: string): LocalOrderInvoice => {
      if (typeof invoiceId !== 'string' || !invoiceId) throw new Error('Invoice id required');
      return posDatabaseService.getInvoice(invoiceId);
    }),
  );

  ipcMain.handle(
    'pos:deleteDraftInvoice',
    wrapHandler((_event: IpcMainInvokeEvent, invoiceId: string): void => {
      if (typeof invoiceId !== 'string' || !invoiceId) throw new Error('Invoice id required');
      posDatabaseService.deleteDraftInvoice(invoiceId);
    }),
  );

  ipcMain.handle(
    'pos:getSalesReportSummary',
    wrapHandler((): SalesReportSummary => posDatabaseService.getSalesReportSummary()),
  );

  ipcMain.handle(
    'pos:createInvoice',
    wrapHandler(
      (_event: IpcMainInvokeEvent, payload: CreateInvoicePayload): LocalOrderInvoice => {
        if (!payload) throw new Error('Invalid invoice payload');
        return posDatabaseService.createInvoice(payload);
      },
    ),
  );

  ipcMain.handle(
    'pos:getUnsyncedInvoices',
    wrapHandler((): LocalOrderInvoice[] => posDatabaseService.getUnsyncedInvoices()),
  );

  ipcMain.handle(
    'pos:getUnsyncedAttendance',
    wrapHandler((): LocalAttendanceRecord[] => posDatabaseService.getUnsyncedAttendance()),
  );

  ipcMain.handle(
    'pos:getPendingSyncCounts',
    wrapHandler(() => posDatabaseService.getPendingSyncCounts()),
  );

  ipcMain.handle(
    'pos:getSyncMeta',
    wrapHandler(() => ({
      lastApiContactAt: posDatabaseService.getConfigValue('lastApiContactAt'),
      lastSyncAt: posDatabaseService.getConfigValue('lastSyncAt'),
    })),
  );

  ipcMain.handle(
    'pos:listAllCustomers',
    wrapHandler((_event: IpcMainInvokeEvent, query?: string): PosCustomer[] => {
      return posDatabaseService.listAllCustomers(typeof query === 'string' ? query : '');
    }),
  );

  ipcMain.handle(
    'pos:listSuppliers',
    wrapHandler(() => posDatabaseService.listSuppliersLocal()),
  );

  ipcMain.handle(
    'pos:upsertSupplier',
    wrapHandler(
      (
        _event: IpcMainInvokeEvent,
        input: { name: string; mobile?: string; email?: string; gstin?: string },
      ) => posDatabaseService.upsertSupplierLocal(input),
    ),
  );

  ipcMain.handle(
    'pos:listPurchases',
    wrapHandler(() => posDatabaseService.listPurchasesLocal()),
  );

  ipcMain.handle(
    'pos:createPurchase',
    wrapHandler((_event: IpcMainInvokeEvent, input: Parameters<typeof posDatabaseService.createPurchaseLocal>[0]) =>
      posDatabaseService.createPurchaseLocal(input),
    ),
  );

  ipcMain.handle(
    'pos:dumpStock',
    wrapHandler((_event: IpcMainInvokeEvent, input: Parameters<typeof posDatabaseService.dumpStockLocal>[0]) => {
      posDatabaseService.dumpStockLocal(input);
    }),
  );

  ipcMain.handle(
    'pos:correctStock',
    wrapHandler((_event: IpcMainInvokeEvent, input: Parameters<typeof posDatabaseService.correctStockLocal>[0]) => {
      posDatabaseService.correctStockLocal(input);
    }),
  );

  ipcMain.handle(
    'pos:checkConnectivity',
    async (): Promise<boolean> => {
      // Prefer last known status from sync daemon — avoid blocking POS UI on API.
      const cached = posDatabaseService.getConfigValue('lastOnline');
      if (cached === '1') return true;
      if (cached === '0') return false;
      const config = posDatabaseService.getConfig();
      try {
        const response = await fetch(`${config.apiBaseUrl}/api/v1/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  );

  ipcMain.handle('pos:requestManualSync', wrapHandler(() => syncDaemon.requestManualSync()));
}
