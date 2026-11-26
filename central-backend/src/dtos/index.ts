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
}

export interface SyncOrderInvoiceDto {
  id: string;
  tenantId: string;
  facilityId: string;
  cashierId: string;
  customerPayload: CustomerPayload;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
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

export interface SyncPushRequestDto {
  tenantId: string;
  facilityId: string;
  deviceId: string;
  invoices: SyncOrderInvoiceDto[];
  attendanceRecords: SyncAttendanceDto[];
}

export interface SyncEventResultDto {
  clientEventId: string;
  eventType: 'ORDER_INVOICE' | 'WORKFORCE_ATTENDANCE';
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
