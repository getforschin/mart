import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  BarcodeResolutionResult,
  CreateInvoicePayload,
  LocalAttendanceRecord,
  LocalOrderInvoice,
  LoginRequest,
  PosApi,
  PosConfig,
  PosCustomer,
  PosFacility,
  PosSession,
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
  resolveBarcode: (barcode: string): Promise<BarcodeResolutionResult> =>
    ipcRenderer.invoke('pos:resolveBarcode', barcode),
  createInvoice: (payload: CreateInvoicePayload): Promise<LocalOrderInvoice> =>
    ipcRenderer.invoke('pos:createInvoice', payload),
  getUnsyncedInvoices: (): Promise<LocalOrderInvoice[]> =>
    ipcRenderer.invoke('pos:getUnsyncedInvoices'),
  getUnsyncedAttendance: (): Promise<LocalAttendanceRecord[]> =>
    ipcRenderer.invoke('pos:getUnsyncedAttendance'),
  checkConnectivity: (): Promise<boolean> => ipcRenderer.invoke('pos:checkConnectivity'),
  onSyncStatus: (callback: (event: SyncStatusEvent) => void): (() => void) => {
    const listener = (_ipcEvent: IpcRendererEvent, syncEvent: SyncStatusEvent): void => {
      callback(syncEvent);
    };
    ipcRenderer.on('sync:status', listener);
    return () => ipcRenderer.removeListener('sync:status', listener);
  },
};

contextBridge.exposeInMainWorld('posApi', posApi);
