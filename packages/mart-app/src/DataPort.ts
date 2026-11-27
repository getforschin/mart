import type {
  CreateCustomerInput,
  CreatePurchaseInput,
  CreateSaleInput,
  MartCustomer,
  MartDashboard,
  MartExpiryDashboard,
  MartProduct,
  MartPurchase,
  MartSaleRow,
  MartSessionInfo,
  MartStockRow,
  MartSupplier,
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

  listPurchases(): Promise<MartPurchase[]>;
  createPurchase(input: CreatePurchaseInput): Promise<MartPurchase>;

  listSales(limit?: number): Promise<MartSaleRow[]>;
  createSale?(input: CreateSaleInput): Promise<MartSaleRow>;

  getReports(): Promise<Record<string, unknown>>;
}
