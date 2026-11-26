import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { posDatabaseService } from '../database/pos-database.service';
import {
  BarcodeResolutionResult,
  CreateInvoicePayload,
  LocalAttendanceRecord,
  LocalOrderInvoice,
  LoginRequest,
  PosConfig,
  PosCustomer,
  PosFacility,
  PosSession,
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
    'pos:resolveBarcode',
    wrapHandler((_event: IpcMainInvokeEvent, barcode: string): BarcodeResolutionResult => {
      if (typeof barcode !== 'string') throw new Error('Barcode must be a string');
      return posDatabaseService.resolveBarcode(barcode);
    }),
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
    'pos:checkConnectivity',
    async (): Promise<boolean> => {
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
}
