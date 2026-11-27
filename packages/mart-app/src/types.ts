export type MartModule =
  | 'dashboard'
  | 'billing'
  | 'customers'
  | 'suppliers'
  | 'purchases'
  | 'stock'
  | 'products'
  | 'sales'
  | 'reports'
  | 'expiry';

export interface SyncPendingCounts {
  bills: number;
  customers: number;
  purchases: number;
  stock: number;
  attendance: number;
}

export interface SyncStatusSnapshot {
  online: boolean;
  timestamp: string;
  lastApiContactAt: string | null;
  lastSyncAt: string | null;
  pending: SyncPendingCounts;
  lastSynced: SyncPendingCounts;
  errors: string[];
  syncing?: boolean;
}

export interface MartCustomer {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  previousDue: number;
  membershipCard: string | null;
  loyaltyPoints: number;
  isSynced?: number;
}

export interface MartSupplier {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  gstin: string | null;
}

export interface MartProduct {
  id: string;
  name: string;
  sku: string;
  baseBarcode: string;
  brand: string | null;
  category: string | null;
  hsnCode: string | null;
}

export interface MartStockRow {
  lotId: string;
  productId: string;
  productName: string;
  sku: string;
  batchNumber: string;
  mrp: number;
  costPrice: number;
  quantityOnHand: number;
  lotBarcode: string;
  facilityId: string;
  expiryDate: string;
  aisleShelfLocation: string | null;
}

export interface MartPurchaseItemInput {
  productId: string;
  productName: string;
  barcode?: string;
  quantity: number;
  purchaseRate: number;
  mrp: number;
  saleRate: number;
  gstPercent?: number;
}

export interface MartPurchase {
  id: string;
  facilityId: string;
  supplierId: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  grandTotal: number;
  status: string;
  isSynced?: number;
  items?: MartPurchaseItemInput[];
}

export interface MartSaleRow {
  id: string;
  invoiceNumber?: string;
  finalPayable: number;
  paymentChannel: string;
  createdAt: string;
  isSynced?: number;
  customerName?: string;
}

export interface MartDashboard {
  totalProducts?: number;
  totalCustomers?: number;
  totalSales?: number;
  lowStockCount?: number;
  [key: string]: unknown;
}

export interface MartExpiryAlert {
  lotId: string;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
  quantityOnHand: number;
  priority: string;
  recommendedAction: string;
}

export interface MartExpiryDashboard {
  criticalAlerts: MartExpiryAlert[];
  warningAlerts: MartExpiryAlert[];
  totalLotsScanned: number;
  generatedAt: string;
}

export interface MartSessionInfo {
  displayName: string;
  facilityName: string;
  role?: string;
}

export interface CreateCustomerInput {
  name: string;
  mobile: string;
  email?: string | null;
}

export interface CreatePurchaseInput {
  supplierId: string;
  invoiceNumber?: string;
  invoiceDate: string;
  remark?: string;
  items: MartPurchaseItemInput[];
}

export interface StockDumpInput {
  productId: string;
  lotId: string;
  quantity: number;
  remark?: string;
}

export interface StockCorrectInput {
  productId: string;
  lotId: string;
  newQuantity: number;
  remark?: string;
}

export interface CreateSaleInput {
  customerName?: string;
  customerMobile?: string;
  paymentChannel: string;
  items: Array<{
    productId: string;
    lotId: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export const EMPTY_PENDING: SyncPendingCounts = {
  bills: 0,
  customers: 0,
  purchases: 0,
  stock: 0,
  attendance: 0,
};

export const MODULE_LABELS: Record<MartModule, string> = {
  dashboard: 'Dashboard',
  billing: 'Sale / Billing',
  customers: 'Customers',
  suppliers: 'Suppliers',
  purchases: 'Purchases',
  stock: 'Stock',
  products: 'Products',
  sales: 'Sales',
  reports: 'Reports',
  expiry: 'Expiry',
};
