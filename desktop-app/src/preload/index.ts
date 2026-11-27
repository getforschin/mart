import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  BarcodeResolutionResult,
  CreateInvoicePayload,
  InventoryRow,
  LocalAttendanceRecord,
  LocalOrderInvoice,
  LoginRequest,
  PosApi,
  PosConfig,
  PosCustomer,
  PosFacility,
  PosSession,
  ProductSearchHit,
  SalesReportSummary,
  SyncStatusEvent,
} from '../shared/types';

const posApi: PosApi = {
  getConfig: (): Promise<PosConfig> => ipcRenderer.invoke('pos:getConfig'),
  getFacilities: (): Promise<PosFacility[]> => ipcRenderer.invoke('pos:getFacilities'),
  login: (credentials: LoginRequest): Promise<PosSession> =>
    ipcRenderer.invoke('pos:login', credentials),
  logout: (): Promise<void> => ipcRenderer.invoke('pos:logout'),
  getSession: (): Promise<PosSession | null> => ipcRenderer.invoke('pos:getSession'),
  lookupCustomerByMobile: (mobile: string): Promise<PosCustomer | null> =>
    ipcRenderer.invoke('pos:lookupCustomerByMobile', mobile),
  searchCustomers: (query: string): Promise<PosCustomer[]> =>
    ipcRenderer.invoke('pos:searchCustomers', query),
  upsertCustomer: (input: {
    name: string;
    mobile: string;
    email?: string | null;
  }): Promise<PosCustomer> => ipcRenderer.invoke('pos:upsertCustomer', input),
  resolveBarcode: (barcode: string): Promise<BarcodeResolutionResult> =>
    ipcRenderer.invoke('pos:resolveBarcode', barcode),
  searchProducts: (query: string): Promise<ProductSearchHit[]> =>
    ipcRenderer.invoke('pos:searchProducts', query),
  previewNextInvoiceNumber: (): Promise<string> =>
    ipcRenderer.invoke('pos:previewNextInvoiceNumber'),
  listInventory: (
    query?: string,
    options?: { inStockOnly?: boolean; sortBy?: 'name' | 'mrp' | 'qty' },
  ): Promise<InventoryRow[]> => ipcRenderer.invoke('pos:listInventory', query ?? '', options ?? {}),
  listInvoices: (limit?: number): Promise<LocalOrderInvoice[]> =>
    ipcRenderer.invoke('pos:listInvoices', limit ?? 100),
  listDraftInvoices: (): Promise<LocalOrderInvoice[]> =>
    ipcRenderer.invoke('pos:listDraftInvoices'),
  getInvoice: (invoiceId: string): Promise<LocalOrderInvoice> =>
    ipcRenderer.invoke('pos:getInvoice', invoiceId),
  deleteDraftInvoice: (invoiceId: string): Promise<void> =>
    ipcRenderer.invoke('pos:deleteDraftInvoice', invoiceId),
  getSalesReportSummary: (): Promise<SalesReportSummary> =>
    ipcRenderer.invoke('pos:getSalesReportSummary'),
  createInvoice: (payload: CreateInvoicePayload): Promise<LocalOrderInvoice> =>
    ipcRenderer.invoke('pos:createInvoice', payload),
  getUnsyncedInvoices: (): Promise<LocalOrderInvoice[]> =>
    ipcRenderer.invoke('pos:getUnsyncedInvoices'),
  getUnsyncedAttendance: (): Promise<LocalAttendanceRecord[]> =>
    ipcRenderer.invoke('pos:getUnsyncedAttendance'),
  getPendingSyncCounts: () => ipcRenderer.invoke('pos:getPendingSyncCounts'),
  getSyncMeta: () => ipcRenderer.invoke('pos:getSyncMeta'),
  listAllCustomers: (query?: string) => ipcRenderer.invoke('pos:listAllCustomers', query ?? ''),
  listSuppliers: () => ipcRenderer.invoke('pos:listSuppliers'),
  upsertSupplier: (input) => ipcRenderer.invoke('pos:upsertSupplier', input),
  listPurchases: () => ipcRenderer.invoke('pos:listPurchases'),
  createPurchase: (input) => ipcRenderer.invoke('pos:createPurchase', input),
  dumpStock: (input) => ipcRenderer.invoke('pos:dumpStock', input),
  correctStock: (input) => ipcRenderer.invoke('pos:correctStock', input),
  checkConnectivity: (): Promise<boolean> => ipcRenderer.invoke('pos:checkConnectivity'),
  requestManualSync: (): Promise<{ started: boolean; reason?: string }> =>
    ipcRenderer.invoke('pos:requestManualSync'),
  onSyncStatus: (callback: (event: SyncStatusEvent) => void): (() => void) => {
    const listener = (_ipcEvent: IpcRendererEvent, syncEvent: SyncStatusEvent): void => {
      callback(syncEvent);
    };
    ipcRenderer.on('sync:status', listener);
    return () => ipcRenderer.removeListener('sync:status', listener);
  },
};

contextBridge.exposeInMainWorld('posApi', posApi);
