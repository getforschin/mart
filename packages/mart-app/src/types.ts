export type MartModule =
  | 'dashboard'
  | 'billing'
  | 'customers'
  | 'suppliers'
  | 'purchases'
  | 'expenses'
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
  outstandingDue?: number;
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
  productId?: string;
  productName: string;
  barcode?: string;
  sku?: string;
  quantity: number;
  purchaseRate: number;
  mrp: number;
  saleRate: number;
  gstPercent?: number;
  isNewProduct?: boolean;
}

export interface MartPurchase {
  id: string;
  facilityId: string;
  supplierId: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  grandTotal: number;
  paidAmount?: number;
  dueAmount?: number;
  paymentStatus?: string;
  status: string;
  isSynced?: number;
  items?: MartPurchaseItemInput[];
}

export interface MartExpense {
  id: string;
  expenseDate: string;
  amount: number;
  purpose: string;
  category: string;
  paymentMode?: string | null;
  payee?: string | null;
  notes?: string | null;
  isRecurringGenerated?: boolean;
}

export interface MartExpenseSchedule {
  id: string;
  purpose: string;
  category: string;
  amount: number;
  dayOfMonth: number;
  paymentMode?: string | null;
  payee?: string | null;
  notes?: string | null;
  isActive: boolean;
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

export interface MartDashboardHourlyPoint {
  hour: number;
  label: string;
  orders: number;
  sales: number;
}

export interface MartDashboardPaymentMix {
  channel: string;
  amount: number;
}

export interface MartDashboardLowStockItem {
  productId: string;
  productName: string;
  sku: string;
  quantityOnHand: number;
  minStock: number;
}

export interface MartDashboard {
  totalProducts?: number;
  productCount?: number;
  totalCustomers?: number;
  customerCount?: number;
  totalSales?: number;
  salesTotal?: number;
  todayNetSales?: number;
  lowStockCount?: number;
  outOfStockCount?: number;
  todayInvoiceCount?: number;
  todayOrderCount?: number;
  newCustomersThisMonth?: number;
  discountTotalToday?: number;
  stockValueAtCost?: number;
  todayHourlyOrders?: MartDashboardHourlyPoint[];
  paymentMixToday?: MartDashboardPaymentMix[];
  lowStockItems?: MartDashboardLowStockItem[];
  recentSales?: Array<{
    id: string;
    invoiceNumber?: string | null;
    finalPayable: number;
    paymentChannel: string;
    createdAt: string;
    customerMobile?: string | null;
  }>;
  [key: string]: unknown;
}

export interface MartStocktakeLine {
  id: string;
  sessionId: string;
  productId: string;
  lotId: string;
  productName?: string;
  batchNumber?: string;
  expectedQty: number;
  countedQty: number | null;
  remark: string | null;
}

export interface MartStocktakeSession {
  id: string;
  tenantId?: string;
  facilityId: string;
  startedBy?: string;
  status: 'IN_PROGRESS' | 'COMMITTED' | 'CANCELLED' | string;
  remark: string | null;
  committedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  lines: MartStocktakeLine[];
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
  paidAmount?: number;
  paymentMode?: string;
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
  discountTotal?: number;
  saleType?: 'CASH_SALE' | 'CREDIT_SALE' | 'RETURN';
  items: Array<{
    productId: string;
    lotId: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface MartBarcodeLot {
  id: string;
  productId: string;
  batchNumber: string;
  costPrice: number;
  mrp: number;
  saleRate?: number;
  manufactureDate: string;
  expiryDate: string;
  lotBarcode: string;
  quantityOnHand: number;
  aisleShelfLocation: string | null;
  company?: string;
  size?: string;
  color?: string;
  hsnCode?: string;
}

export interface MartBarcodeResolution {
  resolutionType: 'SINGLE_LOT' | 'MULTI_MRP_SELECTION' | 'COMPOSITE_LOT_DIRECT';
  productId: string;
  productName: string;
  productSku: string;
  suggestedLot: MartBarcodeLot | null;
  candidateLots: MartBarcodeLot[];
  fifoRecommendation: MartBarcodeLot | null;
}

export interface MartProductSearchHit {
  productId: string;
  productName: string;
  productSku: string;
  baseBarcode: string;
  quantityOnHand: number;
  mrpMin: number;
  mrpMax: number;
  company?: string;
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
  expenses: 'Expenses',
  stock: 'Stock',
  products: 'Products',
  sales: 'Sales',
  reports: 'Reports',
  expiry: 'Expiry',
};
