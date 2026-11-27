import type {
  CreateCustomerInput,
  CreatePurchaseInput,
  CreateSaleInput,
  MartBarcodeResolution,
  MartCustomer,
  MartDashboard,
  MartExpiryDashboard,
  MartProduct,
  MartProductSearchHit,
  MartPurchase,
  MartSaleRow,
  MartSessionInfo,
  MartStockRow,
  MartSupplier,
  MartStocktakeSession,
  MartExpense,
  MartExpenseSchedule,
  StockCorrectInput,
  StockDumpInput,
  SyncStatusSnapshot,
} from './types';

/** Runtime data access — online (HTTP) or offline (SQLite/IPC). */
export interface DataPort {
  mode: 'online' | 'offline';
  getSessionInfo(): Promise<MartSessionInfo | null>;
  getSyncStatus(): Promise<SyncStatusSnapshot>;
  subscribeSyncStatus?(callback: (status: SyncStatusSnapshot) => void): () => void;
  /** Offline POS: push outbox + pull central (background). Online admin: no-op or refresh. */
  requestManualSync?(): Promise<{ started: boolean; reason?: string }>;

  getDashboard(): Promise<MartDashboard>;
  getExpiry(): Promise<MartExpiryDashboard>;

  listCustomers(query?: string): Promise<MartCustomer[]>;
  saveCustomer(input: CreateCustomerInput): Promise<MartCustomer>;

  listSuppliers(): Promise<MartSupplier[]>;
  saveSupplier(input: { name: string; mobile?: string; email?: string; gstin?: string }): Promise<MartSupplier>;

  listProducts(query?: string): Promise<MartProduct[]>;
  saveProduct(input: {
    name: string;
    sku: string;
    baseBarcode: string;
    brand?: string;
    category?: string;
    hsnCode?: string;
  }): Promise<MartProduct>;

  listStock(query?: string): Promise<MartStockRow[]>;
  dumpStock(input: StockDumpInput): Promise<void>;
  correctStock(input: StockCorrectInput): Promise<void>;
  startStocktake?(remark?: string): Promise<MartStocktakeSession>;
  listStocktakes?(): Promise<MartStocktakeSession[]>;
  getStocktake?(sessionId: string): Promise<MartStocktakeSession>;
  updateStocktakeCount?(input: {
    sessionId: string;
    lotId: string;
    countedQty: number;
    remark?: string;
  }): Promise<MartStocktakeSession>;
  commitStocktake?(sessionId: string): Promise<MartStocktakeSession>;
  cancelStocktake?(sessionId: string): Promise<MartStocktakeSession>;

  listPurchases(): Promise<MartPurchase[]>;
  createPurchase(input: CreatePurchaseInput): Promise<MartPurchase>;
  paySupplier?(input: {
    supplierId: string;
    amount: number;
    paymentMode: string;
    entryDate: string;
    remark?: string;
  }): Promise<{ outstandingDue: number }>;
  getSupplierLedger?(supplierId: string): Promise<Record<string, unknown>>;

  listExpenses?(from?: string, to?: string): Promise<MartExpense[]>;
  createExpense?(input: {
    expenseDate: string;
    amount: number;
    purpose: string;
    category?: string;
    paymentMode?: string;
    payee?: string;
    notes?: string;
  }): Promise<MartExpense>;
  listExpenseSchedules?(): Promise<MartExpenseSchedule[]>;
  upsertExpenseSchedule?(input: {
    id?: string;
    purpose: string;
    amount: number;
    dayOfMonth: number;
    category?: string;
    paymentMode?: string;
    payee?: string;
    notes?: string;
    isActive?: boolean;
  }): Promise<MartExpenseSchedule>;
  runExpenseSchedules?(asOf?: string): Promise<{ posted: number | MartExpense[] }>;
  getProfitLoss?(from: string, to: string): Promise<Record<string, unknown>>;

  listSales(limit?: number): Promise<MartSaleRow[]>;
  createSale?(input: CreateSaleInput): Promise<MartSaleRow>;

  /** POS-parity helpers for billing (optional — online port implements these). */
  resolveBarcode?(barcode: string): Promise<MartBarcodeResolution>;
  searchProductsForBilling?(query: string): Promise<MartProductSearchHit[]>;

  getReports(): Promise<Record<string, unknown>>;
}
