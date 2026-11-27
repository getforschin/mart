import {
  PaymentChannel,
  OrderOriginSource,
  SyncResultStatus,
  TenantStatus,
  UserRole,
  FacilityType,
} from '../models/enums';
import { CustomerPayload, GeoCoordinates, TenantMetadataSchema } from '../models/schemas/tenant-metadata.schema';

export interface ApiErrorResponse {
  success: false;
  errorCode: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface TenantResponseDto {
  id: string;
  name: string;
  subdomain: string;
  status: TenantStatus;
  metadata: TenantMetadataSchema;
  createdAt: string;
}

export interface UserResponseDto {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface FacilityResponseDto {
  id: string;
  tenantId: string;
  type: FacilityType;
  name: string;
  geoCoordinates: GeoCoordinates;
  isActive: boolean;
}

export interface ProductLotResponseDto {
  id: string;
  productId: string;
  batchNumber: string;
  costPrice: number;
  mrp: number;
  manufactureDate: string;
  expiryDate: string;
  lotBarcode: string;
  quantityOnHand: number;
  aisleShelfLocation: string | null;
}

export interface BarcodeResolutionResultDto {
  resolutionType: 'SINGLE_LOT' | 'MULTI_MRP_SELECTION' | 'COMPOSITE_LOT_DIRECT';
  productId: string;
  productName: string;
  productSku: string;
  suggestedLot: ProductLotResponseDto | null;
  candidateLots: ProductLotResponseDto[];
  fifoRecommendation: ProductLotResponseDto | null;
}

export interface ExpiryAlertDto {
  lotId: string;
  productId: string;
  productName: string;
  productSku: string;
  batchNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
  quantityOnHand: number;
  facilityId: string;
  facilityName: string;
  priority: 'CRITICAL' | 'WARNING' | 'NORMAL';
  recommendedAction: string;
}

export interface ExpiryDashboardDto {
  tenantId: string;
  criticalWindowDays: number;
  totalLotsScanned: number;
  criticalAlerts: ExpiryAlertDto[];
  warningAlerts: ExpiryAlertDto[];
  generatedAt: string;
}

export interface SyncOrderItemDto {
  id: string;
  productId: string;
  lotId: string;
  quantity: number;
  unitPrice: number;
  calculatedTax: number;
  netAmount: number;
  barcode?: string | null;
  batchNumber?: string | null;
  mrp?: number;
  discountPercent?: number;
  discountAmount?: number;
}

export interface SyncOrderInvoiceDto {
  id: string;
  tenantId: string;
  facilityId: string;
  cashierId: string;
  cashierName?: string | null;
  customerPayload: CustomerPayload;
  invoiceNumber?: string | null;
  saleType?: string;
  status?: string;
  customerMobile?: string | null;
  subtotal: number;
  taxableValue?: number;
  taxTotal: number;
  discountTotal: number;
  billDiscountPercent?: number;
  redeemAmount?: number;
  grossSale?: number;
  roundOff?: number;
  amountTendered?: number;
  changeDue?: number;
  returnOfInvoiceId?: string | null;
  finalPayable: number;
  paymentChannel: PaymentChannel;
  originSource: OrderOriginSource;
  createdAt: string;
  items: SyncOrderItemDto[];
}

export interface SyncAttendanceDto {
  id: string;
  tenantId: string;
  userId: string;
  facilityId: string;
  clockIn: string;
  clockOut: string | null;
  biometricSignatureHash: string;
}

export interface SyncCustomerDto {
  id: string;
  tenantId: string;
  name: string;
  mobile: string;
  email?: string | null;
  previousDue?: number;
  membershipCard?: string | null;
  loyaltyPoints?: number;
  updatedAt: string;
}

export interface SyncPurchaseItemDto {
  productId?: string;
  productName: string;
  barcode?: string;
  sku?: string;
  quantity: number;
  purchaseRate: number;
  mrp: number;
  saleRate: number;
  gstPercent?: number;
  lotId?: string | null;
  isNewProduct?: boolean;
}

export interface SyncPurchaseDto {
  id: string;
  tenantId: string;
  facilityId: string;
  supplierId: string;
  invoiceNumber?: string;
  invoiceDate: string;
  gstMode?: string;
  remark?: string;
  status?: string;
  otherCharges?: number;
  paidAmount?: number;
  paymentMode?: string;
  items: SyncPurchaseItemDto[];
}

export interface SyncSupplierPaymentDto {
  id: string;
  tenantId: string;
  supplierId: string;
  amount: number;
  paymentMode: string;
  entryDate: string;
  remark?: string;
  referenceNo?: string;
}

export interface SyncExpenseDto {
  id: string;
  tenantId: string;
  facilityId?: string;
  expenseDate: string;
  amount: number;
  purpose: string;
  category?: string;
  paymentMode?: string;
  payee?: string;
  notes?: string;
  scheduleId?: string;
  periodKey?: string;
  isRecurringGenerated?: boolean;
  createdBy?: string;
}

export interface SyncStockEventDto {
  id: string;
  tenantId: string;
  facilityId: string;
  eventType: 'DUMP' | 'CORRECTION' | 'TRANSFER';
  productId: string;
  lotId: string;
  quantity: number;
  newQuantity?: number;
  toFacilityId?: string;
  remark?: string;
  createdAt: string;
}

export interface SyncPushRequestDto {
  tenantId: string;
  facilityId: string;
  deviceId: string;
  invoices?: SyncOrderInvoiceDto[];
  attendanceRecords?: SyncAttendanceDto[];
  customers?: SyncCustomerDto[];
  purchases?: SyncPurchaseDto[];
  supplierPayments?: SyncSupplierPaymentDto[];
  expenses?: SyncExpenseDto[];
  stockEvents?: SyncStockEventDto[];
}

export interface SyncEventResultDto {
  clientEventId: string;
  eventType:
    | 'ORDER_INVOICE'
    | 'WORKFORCE_ATTENDANCE'
    | 'CUSTOMER'
    | 'PURCHASE'
    | 'STOCK_EVENT'
    | 'SUPPLIER_PAYMENT'
    | 'EXPENSE';
  status: SyncResultStatus;
  message: string;
}

export interface SyncPushResponseDto {
  processedCount: number;
  acceptedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  results: SyncEventResultDto[];
}

export interface SyncPullRequestDto {
  tenantId: string;
  facilityId: string;
  deviceId: string;
  since?: string | null;
}

export interface SyncPullLotDto {
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
  facilityId: string;
  updatedAt: string;
}

export interface SyncPullCustomerDto {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  previousDue: number;
  membershipCard: string | null;
  loyaltyPoints: number;
  updatedAt: string;
}

export interface SyncPullResponseDto {
  pulledAt: string;
  customers: SyncPullCustomerDto[];
  lots: SyncPullLotDto[];
}

export interface CreateOrderRequestDto {
  facilityId: string;
  cashierId: string;
  customerPayload: CustomerPayload;
  paymentChannel: PaymentChannel;
  originSource: OrderOriginSource;
  discountTotal?: number;
  items: Array<{
    productId: string;
    lotId: string;
    quantity: number;
  }>;
}

export interface HealthCheckDto {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: boolean;
  redis: boolean;
  uptimeSeconds: number;
  version: string;
}
