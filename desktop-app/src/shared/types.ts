export enum PaymentChannel {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
  WALLET = 'WALLET',
  CREDIT = 'CREDIT',
  MIXED = 'MIXED',
}

export enum SaleType {
  CASH_SALE = 'CASH_SALE',
  CREDIT_SALE = 'CREDIT_SALE',
  RETURN = 'RETURN',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
  RETURNED = 'RETURNED',
}

export enum OrderOriginSource {
  OFFLINE_POS = 'OFFLINE_POS',
  WEB_STOREFRONT = 'WEB_STOREFRONT',
}

export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  MART_ADMIN = 'MART_ADMIN',
  STORE_MANAGER = 'STORE_MANAGER',
  CASHIER = 'CASHIER',
  DELIVERY_AGENT = 'DELIVERY_AGENT',
}

export interface PosConfig {
  tenantId: string;
  facilityId: string;
  facilityName: string;
  cashierId: string;
  deviceId: string;
  apiBaseUrl: string;
  taxRate: number;
  shopName: string;
}

export interface PosFacility {
  id: string;
  name: string;
  type: string;
}

export interface PosUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  facilityId: string;
  facilityName: string;
}

export interface PosSession {
  user: PosUser;
  facility: PosFacility;
  loggedInAt: string;
}

export interface PosCustomer {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  previousDue: number;
  membershipCard: string | null;
  loyaltyPoints: number;
  isSynced?: number;
}

export interface LocalProductLot {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  baseBarcode: string;
  company: string;
  size: string;
  color: string;
  hsnCode: string;
  batchNumber: string;
  costPrice: number;
  mrp: number;
  saleRate: number;
  manufactureDate: string;
  expiryDate: string;
  lotBarcode: string;
  quantityOnHand: number;
  aisleShelfLocation: string | null;
}

export interface BarcodeResolutionResult {
  resolutionType: 'SINGLE_LOT' | 'MULTI_MRP_SELECTION' | 'COMPOSITE_LOT_DIRECT';
  productId: string;
  productName: string;
  productSku: string;
  suggestedLot: LocalProductLot | null;
  candidateLots: LocalProductLot[];
  fifoRecommendation: LocalProductLot | null;
}

export interface CartLineItem {
  lineId: string;
  productId: string;
  lotId: string;
  barcode: string;
  productName: string;
  productSku: string;
  company: string;
  size: string;
  color: string;
  hsnCode: string;
  batchNumber: string;
  serialNumber: string;
  priceType: string;
  boxQty: number;
  packetQty: number;
  pieceQty: number;
  quantity: number;
  purchaseRate: number;
  mrp: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  calculatedTax: number;
  netAmount: number;
  expiryDate: string;
}

export interface CreateInvoicePayload {
  /** When set, updates an existing DRAFT instead of creating a new invoice */
  draftId?: string | null;
  items: CartLineItem[];
  saleType: SaleType;
  paymentChannel: PaymentChannel;
  customer: PosCustomer | null;
  customerMobile: string;
  employeeName: string;
  couponCode: string;
  redeemAmount: number;
  billDiscountPercent: number;
  billDiscountAmount: number;
  roundOff: number;
  status: InvoiceStatus;
}

export interface LocalOrderInvoice {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  facilityId: string;
  cashierId: string;
  cashierName: string;
  saleType: SaleType;
  status: InvoiceStatus;
  customerPayload: Record<string, string>;
  customerMobile: string;
  subtotal: number;
  taxableValue: number;
  taxTotal: number;
  discountTotal: number;
  redeemAmount: number;
  grossSale: number;
  roundOff: number;
  finalPayable: number;
  paymentChannel: PaymentChannel;
  originSource: OrderOriginSource;
  couponCode: string | null;
  isSynced: number;
  createdAt: string;
  items: CartLineItem[];
}

export interface LocalAttendanceRecord {
  id: string;
  tenantId: string;
  userId: string;
  facilityId: string;
  clockIn: string;
  clockOut: string | null;
  biometricSignatureHash: string;
  isSynced: number;
}

export interface SyncPendingCounts {
  bills: number;
  customers: number;
  purchases: number;
  stock: number;
  attendance: number;
}

export interface SyncStatusEvent {
  timestamp: string;
  online: boolean;
  lastApiContactAt: string | null;
  lastSyncAt: string | null;
  pending: SyncPendingCounts;
  lastSynced: SyncPendingCounts;
  /** @deprecated use lastSynced.bills */
  invoicesSynced: number;
  /** @deprecated use lastSynced.attendance */
  attendanceSynced: number;
  errors: string[];
  /** True while a background or manual sync cycle is running */
  syncing?: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
  facilityId: string;
}

export interface ProductSearchHit {
  productId: string;
  productName: string;
  productSku: string;
  baseBarcode: string;
  company: string;
  size: string;
  quantityOnHand: number;
  mrpMin: number;
  mrpMax: number;
  saleRate: number;
}

export interface InventoryRow extends LocalProductLot {
  facilityId: string;
}

export interface SalesReportSummary {
  invoiceCount: number;
  salesTotal: number;
  lastHourInvoiceCount: number;
  lastHourSalesTotal: number;
}

export interface PosApi {
  getConfig: () => Promise<PosConfig>;
  getFacilities: () => Promise<PosFacility[]>;
  login: (credentials: LoginRequest) => Promise<PosSession>;
  logout: () => Promise<void>;
  getSession: () => Promise<PosSession | null>;
  lookupCustomerByMobile: (mobile: string) => Promise<PosCustomer | null>;
  searchCustomers: (query: string) => Promise<PosCustomer[]>;
  upsertCustomer: (input: {
    name: string;
    mobile: string;
    email?: string | null;
  }) => Promise<PosCustomer>;
  resolveBarcode: (barcode: string) => Promise<BarcodeResolutionResult>;
  searchProducts: (query: string) => Promise<ProductSearchHit[]>;
  previewNextInvoiceNumber: () => Promise<string>;
  listInventory: (
    query?: string,
    options?: { inStockOnly?: boolean; sortBy?: 'name' | 'mrp' | 'qty' },
  ) => Promise<InventoryRow[]>;
  listInvoices: (limit?: number) => Promise<LocalOrderInvoice[]>;
  listDraftInvoices: () => Promise<LocalOrderInvoice[]>;
  getInvoice: (invoiceId: string) => Promise<LocalOrderInvoice>;
  deleteDraftInvoice: (invoiceId: string) => Promise<void>;
  getSalesReportSummary: () => Promise<SalesReportSummary>;
  createInvoice: (payload: CreateInvoicePayload) => Promise<LocalOrderInvoice>;
  getUnsyncedInvoices: () => Promise<LocalOrderInvoice[]>;
  getUnsyncedAttendance: () => Promise<LocalAttendanceRecord[]>;
  getPendingSyncCounts: () => Promise<SyncPendingCounts>;
  getSyncMeta: () => Promise<{ lastApiContactAt: string | null; lastSyncAt: string | null }>;
  listAllCustomers: (query?: string) => Promise<PosCustomer[]>;
  listSuppliers: () => Promise<
    Array<{ id: string; name: string; mobile: string | null; email: string | null; gstin: string | null }>
  >;
  upsertSupplier: (input: {
    name: string;
    mobile?: string;
    email?: string;
    gstin?: string;
  }) => Promise<{ id: string; name: string; mobile: string | null; email: string | null; gstin: string | null }>;
  listPurchases: () => Promise<Array<Record<string, unknown>>>;
  createPurchase: (input: {
    supplierId: string;
    invoiceNumber?: string;
    invoiceDate: string;
    remark?: string;
    items: Array<{
      productId: string;
      productName: string;
      barcode?: string;
      quantity: number;
      purchaseRate: number;
      mrp: number;
      saleRate: number;
      gstPercent?: number;
    }>;
  }) => Promise<Record<string, unknown>>;
  dumpStock: (input: {
    productId: string;
    lotId: string;
    quantity: number;
    remark?: string;
  }) => Promise<void>;
  correctStock: (input: {
    productId: string;
    lotId: string;
    newQuantity: number;
    remark?: string;
  }) => Promise<void>;
  onSyncStatus: (callback: (event: SyncStatusEvent) => void) => () => void;
  /** Optional health probe — do not call on billing hot path */
  checkConnectivity: () => Promise<boolean>;
  /** Push local outbox + pull central changes now (background; does not block billing) */
  requestManualSync: () => Promise<{ started: boolean; reason?: string }>;
}

declare global {
  interface Window {
    posApi?: PosApi;
  }
}

export {};
