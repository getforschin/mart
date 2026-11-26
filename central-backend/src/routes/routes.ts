/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import type { TsoaRoute } from '@tsoa/runtime';
import {  fetchMiddlewares, ExpressTemplateService } from '@tsoa/runtime';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { SyncController } from './../controllers/SyncController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { StockController } from './../controllers/StockController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { SmsController } from './../controllers/SmsController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { SchemeController } from './../controllers/SchemeController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { SalesController } from './../controllers/SalesController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { ReportController } from './../controllers/ReportController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { PurchaseController } from './../controllers/PurchaseController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { PartyController } from './../controllers/PartyController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { HealthController } from './../controllers/HealthController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { EcommerceController } from './../controllers/EcommerceController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { DashboardController } from './../controllers/DashboardController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { CatalogController } from './../controllers/CatalogController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { BarcodeController } from './../controllers/BarcodeController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { AuthController } from './../controllers/AuthController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { AnalyticsController } from './../controllers/AnalyticsController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { AdminImportController } from './../controllers/AdminImportController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { AccountController } from './../controllers/AccountController';
import { expressAuthentication } from './../core/security/authentication';
// @ts-ignore - no great way to install types from subpackage
import type { Request as ExRequest, Response as ExResponse, RequestHandler, Router } from 'express';

const expressAuthenticationRecasted = expressAuthentication as (req: ExRequest, securityName: string, scopes?: string[], res?: ExResponse) => Promise<any>;


// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

const models: TsoaRoute.Models = {
    "SyncResultStatus": {
        "dataType": "refEnum",
        "enums": ["ACCEPTED","DUPLICATE","REJECTED"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SyncEventResultDto": {
        "dataType": "refObject",
        "properties": {
            "clientEventId": {"dataType":"string","required":true},
            "eventType": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["ORDER_INVOICE"]},{"dataType":"enum","enums":["WORKFORCE_ATTENDANCE"]}],"required":true},
            "status": {"ref":"SyncResultStatus","required":true},
            "message": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SyncPushResponseDto": {
        "dataType": "refObject",
        "properties": {
            "processedCount": {"dataType":"double","required":true},
            "acceptedCount": {"dataType":"double","required":true},
            "duplicateCount": {"dataType":"double","required":true},
            "rejectedCount": {"dataType":"double","required":true},
            "results": {"dataType":"array","array":{"dataType":"refObject","ref":"SyncEventResultDto"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Record_string.unknown_": {
        "dataType": "refAlias",
        "type": {"dataType":"nestedObjectLiteral","nestedProperties":{},"additionalProperties":{"dataType":"any"},"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ApiErrorResponse": {
        "dataType": "refObject",
        "properties": {
            "success": {"dataType":"enum","enums":[false],"required":true},
            "errorCode": {"dataType":"string","required":true},
            "message": {"dataType":"string","required":true},
            "details": {"ref":"Record_string.unknown_"},
            "timestamp": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CustomerPayload": {
        "dataType": "refObject",
        "properties": {
            "name": {"dataType":"string","required":true},
            "phone": {"dataType":"string"},
            "email": {"dataType":"string"},
            "loyaltyId": {"dataType":"string"},
            "billingAddress": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "PaymentChannel": {
        "dataType": "refEnum",
        "enums": ["CASH","CARD","UPI","WALLET","CREDIT","MIXED"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OrderOriginSource": {
        "dataType": "refEnum",
        "enums": ["OFFLINE_POS","WEB_STOREFRONT"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SyncOrderItemDto": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "productId": {"dataType":"string","required":true},
            "lotId": {"dataType":"string","required":true},
            "quantity": {"dataType":"double","required":true},
            "unitPrice": {"dataType":"double","required":true},
            "calculatedTax": {"dataType":"double","required":true},
            "netAmount": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SyncOrderInvoiceDto": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "facilityId": {"dataType":"string","required":true},
            "cashierId": {"dataType":"string","required":true},
            "customerPayload": {"ref":"CustomerPayload","required":true},
            "subtotal": {"dataType":"double","required":true},
            "taxTotal": {"dataType":"double","required":true},
            "discountTotal": {"dataType":"double","required":true},
            "finalPayable": {"dataType":"double","required":true},
            "paymentChannel": {"ref":"PaymentChannel","required":true},
            "originSource": {"ref":"OrderOriginSource","required":true},
            "createdAt": {"dataType":"string","required":true},
            "items": {"dataType":"array","array":{"dataType":"refObject","ref":"SyncOrderItemDto"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SyncAttendanceDto": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "userId": {"dataType":"string","required":true},
            "facilityId": {"dataType":"string","required":true},
            "clockIn": {"dataType":"string","required":true},
            "clockOut": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "biometricSignatureHash": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SyncPushRequestDto": {
        "dataType": "refObject",
        "properties": {
            "tenantId": {"dataType":"string","required":true},
            "facilityId": {"dataType":"string","required":true},
            "deviceId": {"dataType":"string","required":true},
            "invoices": {"dataType":"array","array":{"dataType":"refObject","ref":"SyncOrderInvoiceDto"},"required":true},
            "attendanceRecords": {"dataType":"array","array":{"dataType":"refObject","ref":"SyncAttendanceDto"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "StockMovementType": {
        "dataType": "refEnum",
        "enums": ["DUMP","AUDIT","CONVERSION","CORRECTION","TRANSFER_OUT","TRANSFER_IN","PURCHASE","SALE","RETURN"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "StockMovement": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "facilityId": {"dataType":"string","required":true},
            "productId": {"dataType":"string","required":true},
            "lotId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "movementType": {"ref":"StockMovementType","required":true},
            "quantity": {"dataType":"double","required":true},
            "remark": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "referenceId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "createdAt": {"dataType":"datetime","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TransferStatus": {
        "dataType": "refEnum",
        "enums": ["PENDING","IN_TRANSIT","RECEIVED","CANCELLED"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "StockTransfer": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "fromFacilityId": {"dataType":"string","required":true},
            "toFacilityId": {"dataType":"string","required":true},
            "productId": {"dataType":"string","required":true},
            "lotId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "quantity": {"dataType":"double","required":true},
            "status": {"ref":"TransferStatus","required":true},
            "transportDetail": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "remark": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SmsChannel": {
        "dataType": "refEnum",
        "enums": ["SMS","WHATSAPP"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SmsMessage": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "channel": {"ref":"SmsChannel","required":true},
            "mobile": {"dataType":"string","required":true},
            "message": {"dataType":"string","required":true},
            "status": {"dataType":"string","required":true},
            "templateName": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "createdAt": {"dataType":"datetime","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SchemeType": {
        "dataType": "refEnum",
        "enums": ["FREE_ITEM","DISCOUNT_ITEM","BILL_DISCOUNT","PERCENT_OFF"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Scheme": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "schemeType": {"ref":"SchemeType","required":true},
            "description": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "buyQuantity": {"dataType":"double","required":true},
            "getQuantity": {"dataType":"double","required":true},
            "discountPercent": {"dataType":"double","required":true},
            "minBillAmount": {"dataType":"double","required":true},
            "startDate": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "endDate": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "isActive": {"dataType":"boolean","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SchemeBody": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string"},
            "name": {"dataType":"string","required":true},
            "schemeType": {"ref":"SchemeType","required":true},
            "description": {"dataType":"string"},
            "buyQuantity": {"dataType":"double"},
            "getQuantity": {"dataType":"double"},
            "discountPercent": {"dataType":"double"},
            "minBillAmount": {"dataType":"double"},
            "startDate": {"dataType":"string"},
            "endDate": {"dataType":"string"},
            "isActive": {"dataType":"boolean"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TenantStatus": {
        "dataType": "refEnum",
        "enums": ["ACTIVE","SUSPENDED","PROVISIONING","DECOMMISSIONED"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TenantThemeVariables": {
        "dataType": "refObject",
        "properties": {
            "primaryColor": {"dataType":"string","required":true},
            "secondaryColor": {"dataType":"string","required":true},
            "accentColor": {"dataType":"string","required":true},
            "logoUrl": {"dataType":"string","required":true},
            "fontFamily": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TenantTaxParameters": {
        "dataType": "refObject",
        "properties": {
            "regionCode": {"dataType":"string","required":true},
            "standardVatRate": {"dataType":"double","required":true},
            "reducedVatRate": {"dataType":"double","required":true},
            "gstRate": {"dataType":"double","required":true},
            "pricesIncludeTax": {"dataType":"boolean","required":true},
            "currencyCode": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TenantFeatureFlags": {
        "dataType": "refObject",
        "properties": {
            "enableLotTracking": {"dataType":"boolean","required":true},
            "enableOfflinePos": {"dataType":"boolean","required":true},
            "enableWebStorefront": {"dataType":"boolean","required":true},
            "enableExpiryAlerts": {"dataType":"boolean","required":true},
            "enableBiometricAttendance": {"dataType":"boolean","required":true},
            "enableMultiMrpSelection": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TenantMetadataSchema": {
        "dataType": "refObject",
        "properties": {
            "theme": {"ref":"TenantThemeVariables","required":true},
            "taxParameters": {"ref":"TenantTaxParameters","required":true},
            "featureFlags": {"ref":"TenantFeatureFlags","required":true},
            "customDomain": {"dataType":"string"},
            "supportEmail": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "UserRole": {
        "dataType": "refEnum",
        "enums": ["SUPERADMIN","MART_ADMIN","STORE_MANAGER","CASHIER","DELIVERY_AGENT","SALESMAN","CUSTOMER"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Tenant": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "subdomain": {"dataType":"string","required":true},
            "status": {"ref":"TenantStatus","required":true},
            "metadata": {"ref":"TenantMetadataSchema","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
            "users": {"dataType":"array","array":{"dataType":"refObject","ref":"User"},"required":true},
            "facilities": {"dataType":"array","array":{"dataType":"refObject","ref":"Facility"},"required":true},
            "products": {"dataType":"array","array":{"dataType":"refObject","ref":"Product"},"required":true},
            "orders": {"dataType":"array","array":{"dataType":"refObject","ref":"OrderInvoice"},"required":true},
            "attendanceRecords": {"dataType":"array","array":{"dataType":"refObject","ref":"WorkforceAttendance"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OrderInvoice": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "facilityId": {"dataType":"string","required":true},
            "cashierId": {"dataType":"string","required":true},
            "customerPayload": {"ref":"CustomerPayload","required":true},
            "subtotal": {"dataType":"double","required":true},
            "taxTotal": {"dataType":"double","required":true},
            "discountTotal": {"dataType":"double","required":true},
            "invoiceNumber": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "saleType": {"dataType":"string","required":true},
            "status": {"dataType":"string","required":true},
            "customerMobile": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "taxableValue": {"dataType":"double","required":true},
            "redeemAmount": {"dataType":"double","required":true},
            "grossSale": {"dataType":"double","required":true},
            "roundOff": {"dataType":"double","required":true},
            "couponCode": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "finalPayable": {"dataType":"double","required":true},
            "paymentChannel": {"ref":"PaymentChannel","required":true},
            "originSource": {"ref":"OrderOriginSource","required":true},
            "isSynced": {"dataType":"boolean","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
            "tenant": {"ref":"Tenant","required":true},
            "facility": {"ref":"Facility","required":true},
            "cashier": {"ref":"User","required":true},
            "items": {"dataType":"array","array":{"dataType":"refObject","ref":"OrderItem"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "User": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "email": {"dataType":"string","required":true},
            "username": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "fullName": {"dataType":"string","required":true},
            "mobile": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "passwordHash": {"dataType":"string","required":true},
            "role": {"ref":"UserRole","required":true},
            "isActive": {"dataType":"boolean","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
            "tenant": {"ref":"Tenant","required":true},
            "processedOrders": {"dataType":"array","array":{"dataType":"refObject","ref":"OrderInvoice"},"required":true},
            "attendanceRecords": {"dataType":"array","array":{"dataType":"refObject","ref":"WorkforceAttendance"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "FacilityType": {
        "dataType": "refEnum",
        "enums": ["WAREHOUSE","RETAIL_STORE"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "GeoCoordinates": {
        "dataType": "refObject",
        "properties": {
            "latitude": {"dataType":"double","required":true},
            "longitude": {"dataType":"double","required":true},
            "altitudeMeters": {"dataType":"double"},
            "accuracyMeters": {"dataType":"double"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ProductLot": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "productId": {"dataType":"string","required":true},
            "batchNumber": {"dataType":"string","required":true},
            "costPrice": {"dataType":"double","required":true},
            "mrp": {"dataType":"double","required":true},
            "manufactureDate": {"dataType":"datetime","required":true},
            "expiryDate": {"dataType":"datetime","required":true},
            "lotBarcode": {"dataType":"string","required":true},
            "isActive": {"dataType":"boolean","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
            "product": {"ref":"Product","required":true},
            "inventoryStocks": {"dataType":"array","array":{"dataType":"refObject","ref":"LotInventoryStock"},"required":true},
            "orderItems": {"dataType":"array","array":{"dataType":"refObject","ref":"OrderItem"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Product": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "sku": {"dataType":"string","required":true},
            "baseBarcode": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "company": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "size": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "color": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "hsnCode": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "category": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "brand": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "subCategory": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "unit": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "gstPercent": {"dataType":"double","required":true},
            "saleRate": {"dataType":"double","required":true},
            "mrp": {"dataType":"double","required":true},
            "purchaseRate": {"dataType":"double","required":true},
            "minStock": {"dataType":"double","required":true},
            "maxStock": {"dataType":"double","required":true},
            "description": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "imageUrl": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "showOnEcommerce": {"dataType":"boolean","required":true},
            "isActive": {"dataType":"boolean","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
            "tenant": {"ref":"Tenant","required":true},
            "lots": {"dataType":"array","array":{"dataType":"refObject","ref":"ProductLot"},"required":true},
            "orderItems": {"dataType":"array","array":{"dataType":"refObject","ref":"OrderItem"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OrderItem": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "orderId": {"dataType":"string","required":true},
            "productId": {"dataType":"string","required":true},
            "lotId": {"dataType":"string","required":true},
            "quantity": {"dataType":"double","required":true},
            "unitPrice": {"dataType":"double","required":true},
            "calculatedTax": {"dataType":"double","required":true},
            "netAmount": {"dataType":"double","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "order": {"ref":"OrderInvoice","required":true},
            "product": {"ref":"Product","required":true},
            "lot": {"ref":"ProductLot","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LotInventoryStock": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "lotId": {"dataType":"string","required":true},
            "facilityId": {"dataType":"string","required":true},
            "quantityOnHand": {"dataType":"double","required":true},
            "aisleShelfLocation": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
            "lot": {"ref":"ProductLot","required":true},
            "facility": {"ref":"Facility","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Facility": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "type": {"ref":"FacilityType","required":true},
            "name": {"dataType":"string","required":true},
            "shortcut": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "state": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "gstin": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "mobile": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "registerType": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "geoCoordinates": {"ref":"GeoCoordinates","required":true},
            "isActive": {"dataType":"boolean","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
            "tenant": {"ref":"Tenant","required":true},
            "lotStocks": {"dataType":"array","array":{"dataType":"refObject","ref":"LotInventoryStock"},"required":true},
            "orders": {"dataType":"array","array":{"dataType":"refObject","ref":"OrderInvoice"},"required":true},
            "attendanceRecords": {"dataType":"array","array":{"dataType":"refObject","ref":"WorkforceAttendance"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "WorkforceAttendance": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "userId": {"dataType":"string","required":true},
            "facilityId": {"dataType":"string","required":true},
            "clockIn": {"dataType":"datetime","required":true},
            "clockOut": {"dataType":"union","subSchemas":[{"dataType":"datetime"},{"dataType":"enum","enums":[null]}],"required":true},
            "biometricSignatureHash": {"dataType":"string","required":true},
            "isSynced": {"dataType":"boolean","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
            "tenant": {"ref":"Tenant","required":true},
            "user": {"ref":"User","required":true},
            "facility": {"ref":"Facility","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SaleBody": {
        "dataType": "refObject",
        "properties": {
            "facilityId": {"dataType":"string","required":true},
            "cashierId": {"dataType":"string","required":true},
            "customerMobile": {"dataType":"string"},
            "customerName": {"dataType":"string"},
            "paymentChannel": {"ref":"PaymentChannel","required":true},
            "originSource": {"ref":"OrderOriginSource","required":true},
            "discountTotal": {"dataType":"double"},
            "items": {"dataType":"array","array":{"dataType":"nestedObjectLiteral","nestedProperties":{"unitPrice":{"dataType":"double","required":true},"quantity":{"dataType":"double","required":true},"lotId":{"dataType":"string","required":true},"productId":{"dataType":"string","required":true}}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "GstMode": {
        "dataType": "refEnum",
        "enums": ["NON_GST","EXCLUSIVE","INCLUSIVE"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "PurchaseStatus": {
        "dataType": "refEnum",
        "enums": ["DRAFT","COMPLETED","RETURNED","CANCELLED"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Purchase": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "facilityId": {"dataType":"string","required":true},
            "supplierId": {"dataType":"string","required":true},
            "invoiceNumber": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "invoiceDate": {"dataType":"string","required":true},
            "gstMode": {"ref":"GstMode","required":true},
            "status": {"ref":"PurchaseStatus","required":true},
            "remark": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "subtotal": {"dataType":"double","required":true},
            "taxTotal": {"dataType":"double","required":true},
            "otherCharges": {"dataType":"double","required":true},
            "grandTotal": {"dataType":"double","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
            "items": {"dataType":"array","array":{"dataType":"refObject","ref":"PurchaseItem"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "PurchaseItem": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "purchaseId": {"dataType":"string","required":true},
            "productId": {"dataType":"string","required":true},
            "lotId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "productName": {"dataType":"string","required":true},
            "barcode": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "quantity": {"dataType":"double","required":true},
            "purchaseRate": {"dataType":"double","required":true},
            "mrp": {"dataType":"double","required":true},
            "saleRate": {"dataType":"double","required":true},
            "gstPercent": {"dataType":"double","required":true},
            "lineTotal": {"dataType":"double","required":true},
            "purchase": {"ref":"Purchase","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "PurchaseBody": {
        "dataType": "refObject",
        "properties": {
            "facilityId": {"dataType":"string","required":true},
            "supplierId": {"dataType":"string","required":true},
            "invoiceNumber": {"dataType":"string"},
            "invoiceDate": {"dataType":"string","required":true},
            "gstMode": {"ref":"GstMode"},
            "remark": {"dataType":"string"},
            "status": {"ref":"PurchaseStatus"},
            "otherCharges": {"dataType":"double"},
            "items": {"dataType":"array","array":{"dataType":"nestedObjectLiteral","nestedProperties":{"gstPercent":{"dataType":"double"},"saleRate":{"dataType":"double","required":true},"mrp":{"dataType":"double","required":true},"purchaseRate":{"dataType":"double","required":true},"quantity":{"dataType":"double","required":true},"barcode":{"dataType":"string"},"productName":{"dataType":"string","required":true},"productId":{"dataType":"string","required":true}}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Customer": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "mobile": {"dataType":"string","required":true},
            "email": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "address": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "city": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "state": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "pincode": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "gstin": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "membershipCard": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "discountPercent": {"dataType":"double","required":true},
            "priceType": {"dataType":"string","required":true},
            "outstandingDue": {"dataType":"double","required":true},
            "creditLimit": {"dataType":"double","required":true},
            "passwordHash": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "isActive": {"dataType":"boolean","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CustomerBody": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string"},
            "name": {"dataType":"string","required":true},
            "mobile": {"dataType":"string","required":true},
            "email": {"dataType":"string"},
            "address": {"dataType":"string"},
            "city": {"dataType":"string"},
            "state": {"dataType":"string"},
            "pincode": {"dataType":"string"},
            "gstin": {"dataType":"string"},
            "membershipCard": {"dataType":"string"},
            "discountPercent": {"dataType":"double"},
            "priceType": {"dataType":"string"},
            "creditLimit": {"dataType":"double"},
            "isActive": {"dataType":"boolean"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Supplier": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "mobile": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "email": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "address": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "state": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "gstin": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "outstandingDue": {"dataType":"double","required":true},
            "isActive": {"dataType":"boolean","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SupplierBody": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string"},
            "name": {"dataType":"string","required":true},
            "mobile": {"dataType":"string"},
            "email": {"dataType":"string"},
            "address": {"dataType":"string"},
            "state": {"dataType":"string"},
            "gstin": {"dataType":"string"},
            "isActive": {"dataType":"boolean"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "HealthCheckDto": {
        "dataType": "refObject",
        "properties": {
            "status": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["healthy"]},{"dataType":"enum","enums":["degraded"]},{"dataType":"enum","enums":["unhealthy"]}],"required":true},
            "database": {"dataType":"boolean","required":true},
            "redis": {"dataType":"boolean","required":true},
            "uptimeSeconds": {"dataType":"double","required":true},
            "version": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Coupon": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "code": {"dataType":"string","required":true},
            "title": {"dataType":"string","required":true},
            "percentOff": {"dataType":"double","required":true},
            "flatOff": {"dataType":"double","required":true},
            "minOrderAmount": {"dataType":"double","required":true},
            "validFrom": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "validTo": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "isActive": {"dataType":"boolean","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "EcommerceOrderStatus": {
        "dataType": "refEnum",
        "enums": ["PLACED","CONFIRMED","PACKED","OUT_FOR_DELIVERY","DELIVERED","CANCELLED"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "EcommerceOrder": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "customerId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "customerName": {"dataType":"string","required":true},
            "customerMobile": {"dataType":"string","required":true},
            "shippingAddress": {"dataType":"string","required":true},
            "pincode": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "items": {"dataType":"array","array":{"dataType":"nestedObjectLiteral","nestedProperties":{"lineTotal":{"dataType":"double","required":true},"unitPrice":{"dataType":"double","required":true},"quantity":{"dataType":"double","required":true},"name":{"dataType":"string","required":true},"productId":{"dataType":"string","required":true}}},"required":true},
            "subtotal": {"dataType":"double","required":true},
            "discountTotal": {"dataType":"double","required":true},
            "deliveryCharge": {"dataType":"double","required":true},
            "grandTotal": {"dataType":"double","required":true},
            "couponCode": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "paymentChannel": {"ref":"PaymentChannel","required":true},
            "status": {"ref":"EcommerceOrderStatus","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ProductBody": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string"},
            "name": {"dataType":"string","required":true},
            "sku": {"dataType":"string","required":true},
            "baseBarcode": {"dataType":"string","required":true},
            "company": {"dataType":"string"},
            "category": {"dataType":"string"},
            "brand": {"dataType":"string"},
            "subCategory": {"dataType":"string"},
            "unit": {"dataType":"string"},
            "hsnCode": {"dataType":"string"},
            "gstPercent": {"dataType":"double"},
            "saleRate": {"dataType":"double"},
            "mrp": {"dataType":"double"},
            "purchaseRate": {"dataType":"double"},
            "minStock": {"dataType":"double"},
            "maxStock": {"dataType":"double"},
            "description": {"dataType":"string"},
            "imageUrl": {"dataType":"string"},
            "showOnEcommerce": {"dataType":"boolean"},
            "isActive": {"dataType":"boolean"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OperatorBody": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string"},
            "email": {"dataType":"string","required":true},
            "username": {"dataType":"string"},
            "fullName": {"dataType":"string","required":true},
            "mobile": {"dataType":"string"},
            "role": {"ref":"UserRole","required":true},
            "password": {"dataType":"string"},
            "isActive": {"dataType":"boolean"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "FinancialSession": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "startDate": {"dataType":"string","required":true},
            "endDate": {"dataType":"string","required":true},
            "isCurrent": {"dataType":"boolean","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ProductLotResponseDto": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "productId": {"dataType":"string","required":true},
            "batchNumber": {"dataType":"string","required":true},
            "costPrice": {"dataType":"double","required":true},
            "mrp": {"dataType":"double","required":true},
            "manufactureDate": {"dataType":"string","required":true},
            "expiryDate": {"dataType":"string","required":true},
            "lotBarcode": {"dataType":"string","required":true},
            "quantityOnHand": {"dataType":"double","required":true},
            "aisleShelfLocation": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "BarcodeResolutionResultDto": {
        "dataType": "refObject",
        "properties": {
            "resolutionType": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["SINGLE_LOT"]},{"dataType":"enum","enums":["MULTI_MRP_SELECTION"]},{"dataType":"enum","enums":["COMPOSITE_LOT_DIRECT"]}],"required":true},
            "productId": {"dataType":"string","required":true},
            "productName": {"dataType":"string","required":true},
            "productSku": {"dataType":"string","required":true},
            "suggestedLot": {"dataType":"union","subSchemas":[{"ref":"ProductLotResponseDto"},{"dataType":"enum","enums":[null]}],"required":true},
            "candidateLots": {"dataType":"array","array":{"dataType":"refObject","ref":"ProductLotResponseDto"},"required":true},
            "fifoRecommendation": {"dataType":"union","subSchemas":[{"ref":"ProductLotResponseDto"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LoginBody": {
        "dataType": "refObject",
        "properties": {
            "username": {"dataType":"string","required":true},
            "password": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ExpiryAlertDto": {
        "dataType": "refObject",
        "properties": {
            "lotId": {"dataType":"string","required":true},
            "productId": {"dataType":"string","required":true},
            "productName": {"dataType":"string","required":true},
            "productSku": {"dataType":"string","required":true},
            "batchNumber": {"dataType":"string","required":true},
            "expiryDate": {"dataType":"string","required":true},
            "daysUntilExpiry": {"dataType":"double","required":true},
            "quantityOnHand": {"dataType":"double","required":true},
            "facilityId": {"dataType":"string","required":true},
            "facilityName": {"dataType":"string","required":true},
            "priority": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["CRITICAL"]},{"dataType":"enum","enums":["WARNING"]},{"dataType":"enum","enums":["NORMAL"]}],"required":true},
            "recommendedAction": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ExpiryDashboardDto": {
        "dataType": "refObject",
        "properties": {
            "tenantId": {"dataType":"string","required":true},
            "criticalWindowDays": {"dataType":"double","required":true},
            "totalLotsScanned": {"dataType":"double","required":true},
            "criticalAlerts": {"dataType":"array","array":{"dataType":"refObject","ref":"ExpiryAlertDto"},"required":true},
            "warningAlerts": {"dataType":"array","array":{"dataType":"refObject","ref":"ExpiryAlertDto"},"required":true},
            "generatedAt": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "BootstrapResponse": {
        "dataType": "refObject",
        "properties": {
            "tenantId": {"dataType":"string","required":true},
            "facilityId": {"dataType":"string","required":true},
            "message": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ImportBatchResponse": {
        "dataType": "refObject",
        "properties": {
            "imported": {"dataType":"double","required":true},
            "totalQty": {"dataType":"double","required":true},
            "stats": {"dataType":"nestedObjectLiteral","nestedProperties":{"qty":{"dataType":"double","required":true},"lots":{"dataType":"double","required":true},"products":{"dataType":"double","required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "StockImportItem": {
        "dataType": "refObject",
        "properties": {
            "itemId": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
            "barcode": {"dataType":"string","required":true},
            "brand": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "size": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "color": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "mrp": {"dataType":"double","required":true},
            "saleRate": {"dataType":"double","required":true},
            "costPrice": {"dataType":"double","required":true},
            "quantityOnHand": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ImportBatchBody": {
        "dataType": "refObject",
        "properties": {
            "clearExisting": {"dataType":"boolean"},
            "items": {"dataType":"array","array":{"dataType":"refObject","ref":"StockImportItem"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "AccountHead": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "groupName": {"dataType":"string","required":true},
            "nature": {"dataType":"string","required":true},
            "openingBalance": {"dataType":"double","required":true},
            "isActive": {"dataType":"boolean","required":true},
            "createdAt": {"dataType":"datetime","required":true},
            "updatedAt": {"dataType":"datetime","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "AccountEntryType": {
        "dataType": "refEnum",
        "enums": ["PAYMENT","RECEIPT","JOURNAL","CONTRA","BILL"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "PartyType": {
        "dataType": "refEnum",
        "enums": ["SUPPLIER","CUSTOMER","EMPLOYEE"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "AccountEntry": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "tenantId": {"dataType":"string","required":true},
            "entryType": {"ref":"AccountEntryType","required":true},
            "accountHeadId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "partyType": {"dataType":"union","subSchemas":[{"ref":"PartyType"},{"dataType":"enum","enums":[null]}],"required":true},
            "partyId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "partyName": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "entryDate": {"dataType":"string","required":true},
            "amount": {"dataType":"double","required":true},
            "paymentMode": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "narration": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "referenceNo": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "createdAt": {"dataType":"datetime","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
};
const templateService = new ExpressTemplateService(models, {"noImplicitAdditionalProperties":"throw-on-extras","bodyCoercion":true});

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa




export function RegisterRoutes(app: Router) {

    // ###########################################################################################################
    //  NOTE: If you do not see routes for all of your controllers in this file, then you might not have informed tsoa of where to look
    //      Please look into the "controllerPathGlobs" config option described in the readme: https://github.com/lukeautry/tsoa
    // ###########################################################################################################


    
        const argsSyncController_pushOfflineEvents: Record<string, TsoaRoute.ParameterSchema> = {
                body: {"in":"body","name":"body","required":true,"ref":"SyncPushRequestDto"},
        };
        app.post('/api/v1/sync/push',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(SyncController)),
            ...(fetchMiddlewares<RequestHandler>(SyncController.prototype.pushOfflineEvents)),

            async function SyncController_pushOfflineEvents(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSyncController_pushOfflineEvents, request, response });

                const controller = new SyncController();

              await templateService.apiHandler({
                methodName: 'pushOfflineEvents',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsStockController_list: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                facilityId: {"in":"query","name":"facilityId","dataType":"string"},
        };
        app.get('/api/v1/stock',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(StockController)),
            ...(fetchMiddlewares<RequestHandler>(StockController.prototype.list)),

            async function StockController_list(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsStockController_list, request, response });

                const controller = new StockController();

              await templateService.apiHandler({
                methodName: 'list',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsStockController_movements: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/stock/movements',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(StockController)),
            ...(fetchMiddlewares<RequestHandler>(StockController.prototype.movements)),

            async function StockController_movements(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsStockController_movements, request, response });

                const controller = new StockController();

              await templateService.apiHandler({
                methodName: 'movements',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsStockController_dump: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"remark":{"dataType":"string"},"quantity":{"dataType":"double","required":true},"lotId":{"dataType":"string","required":true},"productId":{"dataType":"string","required":true},"facilityId":{"dataType":"string","required":true}}},
        };
        app.post('/api/v1/stock/dump',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(StockController)),
            ...(fetchMiddlewares<RequestHandler>(StockController.prototype.dump)),

            async function StockController_dump(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsStockController_dump, request, response });

                const controller = new StockController();

              await templateService.apiHandler({
                methodName: 'dump',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsStockController_correct: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"remark":{"dataType":"string"},"newQuantity":{"dataType":"double","required":true},"lotId":{"dataType":"string","required":true},"productId":{"dataType":"string","required":true},"facilityId":{"dataType":"string","required":true}}},
        };
        app.post('/api/v1/stock/correct',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(StockController)),
            ...(fetchMiddlewares<RequestHandler>(StockController.prototype.correct)),

            async function StockController_correct(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsStockController_correct, request, response });

                const controller = new StockController();

              await templateService.apiHandler({
                methodName: 'correct',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsStockController_transfers: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/stock/transfers',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(StockController)),
            ...(fetchMiddlewares<RequestHandler>(StockController.prototype.transfers)),

            async function StockController_transfers(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsStockController_transfers, request, response });

                const controller = new StockController();

              await templateService.apiHandler({
                methodName: 'transfers',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsStockController_createTransfer: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"remark":{"dataType":"string"},"transportDetail":{"dataType":"string"},"quantity":{"dataType":"double","required":true},"lotId":{"dataType":"string","required":true},"productId":{"dataType":"string","required":true},"toFacilityId":{"dataType":"string","required":true},"fromFacilityId":{"dataType":"string","required":true}}},
        };
        app.post('/api/v1/stock/transfers',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(StockController)),
            ...(fetchMiddlewares<RequestHandler>(StockController.prototype.createTransfer)),

            async function StockController_createTransfer(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsStockController_createTransfer, request, response });

                const controller = new StockController();

              await templateService.apiHandler({
                methodName: 'createTransfer',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSmsController_list: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/sms',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(SmsController)),
            ...(fetchMiddlewares<RequestHandler>(SmsController.prototype.list)),

            async function SmsController_list(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSmsController_list, request, response });

                const controller = new SmsController();

              await templateService.apiHandler({
                methodName: 'list',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSmsController_send: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"templateName":{"dataType":"string"},"message":{"dataType":"string","required":true},"mobile":{"dataType":"string","required":true},"channel":{"ref":"SmsChannel","required":true}}},
        };
        app.post('/api/v1/sms/send',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(SmsController)),
            ...(fetchMiddlewares<RequestHandler>(SmsController.prototype.send)),

            async function SmsController_send(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSmsController_send, request, response });

                const controller = new SmsController();

              await templateService.apiHandler({
                methodName: 'send',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSchemeController_list: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/schemes',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(SchemeController)),
            ...(fetchMiddlewares<RequestHandler>(SchemeController.prototype.list)),

            async function SchemeController_list(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSchemeController_list, request, response });

                const controller = new SchemeController();

              await templateService.apiHandler({
                methodName: 'list',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSchemeController_upsert: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"ref":"SchemeBody"},
        };
        app.post('/api/v1/schemes',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(SchemeController)),
            ...(fetchMiddlewares<RequestHandler>(SchemeController.prototype.upsert)),

            async function SchemeController_upsert(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSchemeController_upsert, request, response });

                const controller = new SchemeController();

              await templateService.apiHandler({
                methodName: 'upsert',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSalesController_list: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/sales',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(SalesController)),
            ...(fetchMiddlewares<RequestHandler>(SalesController.prototype.list)),

            async function SalesController_list(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSalesController_list, request, response });

                const controller = new SalesController();

              await templateService.apiHandler({
                methodName: 'list',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSalesController_create: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"ref":"SaleBody"},
        };
        app.post('/api/v1/sales',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(SalesController)),
            ...(fetchMiddlewares<RequestHandler>(SalesController.prototype.create)),

            async function SalesController_create(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSalesController_create, request, response });

                const controller = new SalesController();

              await templateService.apiHandler({
                methodName: 'create',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsReportController_getReports: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/reports',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(ReportController)),
            ...(fetchMiddlewares<RequestHandler>(ReportController.prototype.getReports)),

            async function ReportController_getReports(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsReportController_getReports, request, response });

                const controller = new ReportController();

              await templateService.apiHandler({
                methodName: 'getReports',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsPurchaseController_list: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/purchases',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(PurchaseController)),
            ...(fetchMiddlewares<RequestHandler>(PurchaseController.prototype.list)),

            async function PurchaseController_list(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsPurchaseController_list, request, response });

                const controller = new PurchaseController();

              await templateService.apiHandler({
                methodName: 'list',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsPurchaseController_create: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"ref":"PurchaseBody"},
        };
        app.post('/api/v1/purchases',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(PurchaseController)),
            ...(fetchMiddlewares<RequestHandler>(PurchaseController.prototype.create)),

            async function PurchaseController_create(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsPurchaseController_create, request, response });

                const controller = new PurchaseController();

              await templateService.apiHandler({
                methodName: 'create',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsPartyController_listCustomers: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/parties/customers',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(PartyController)),
            ...(fetchMiddlewares<RequestHandler>(PartyController.prototype.listCustomers)),

            async function PartyController_listCustomers(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsPartyController_listCustomers, request, response });

                const controller = new PartyController();

              await templateService.apiHandler({
                methodName: 'listCustomers',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsPartyController_upsertCustomer: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"ref":"CustomerBody"},
        };
        app.post('/api/v1/parties/customers',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(PartyController)),
            ...(fetchMiddlewares<RequestHandler>(PartyController.prototype.upsertCustomer)),

            async function PartyController_upsertCustomer(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsPartyController_upsertCustomer, request, response });

                const controller = new PartyController();

              await templateService.apiHandler({
                methodName: 'upsertCustomer',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsPartyController_listSuppliers: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/parties/suppliers',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(PartyController)),
            ...(fetchMiddlewares<RequestHandler>(PartyController.prototype.listSuppliers)),

            async function PartyController_listSuppliers(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsPartyController_listSuppliers, request, response });

                const controller = new PartyController();

              await templateService.apiHandler({
                methodName: 'listSuppliers',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsPartyController_upsertSupplier: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"ref":"SupplierBody"},
        };
        app.post('/api/v1/parties/suppliers',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(PartyController)),
            ...(fetchMiddlewares<RequestHandler>(PartyController.prototype.upsertSupplier)),

            async function PartyController_upsertSupplier(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsPartyController_upsertSupplier, request, response });

                const controller = new PartyController();

              await templateService.apiHandler({
                methodName: 'upsertSupplier',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHealthController_getHealth: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/v1/health',
            ...(fetchMiddlewares<RequestHandler>(HealthController)),
            ...(fetchMiddlewares<RequestHandler>(HealthController.prototype.getHealth)),

            async function HealthController_getHealth(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHealthController_getHealth, request, response });

                const controller = new HealthController();

              await templateService.apiHandler({
                methodName: 'getHealth',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsEcommerceController_coupons: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/ecommerce/coupons',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(EcommerceController)),
            ...(fetchMiddlewares<RequestHandler>(EcommerceController.prototype.coupons)),

            async function EcommerceController_coupons(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsEcommerceController_coupons, request, response });

                const controller = new EcommerceController();

              await templateService.apiHandler({
                methodName: 'coupons',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsEcommerceController_upsertCoupon: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"isActive":{"dataType":"boolean"},"validTo":{"dataType":"string"},"validFrom":{"dataType":"string"},"minOrderAmount":{"dataType":"double"},"flatOff":{"dataType":"double"},"percentOff":{"dataType":"double"},"title":{"dataType":"string","required":true},"code":{"dataType":"string","required":true},"id":{"dataType":"string"}}},
        };
        app.post('/api/v1/ecommerce/coupons',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(EcommerceController)),
            ...(fetchMiddlewares<RequestHandler>(EcommerceController.prototype.upsertCoupon)),

            async function EcommerceController_upsertCoupon(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsEcommerceController_upsertCoupon, request, response });

                const controller = new EcommerceController();

              await templateService.apiHandler({
                methodName: 'upsertCoupon',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsEcommerceController_orders: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/ecommerce/orders',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(EcommerceController)),
            ...(fetchMiddlewares<RequestHandler>(EcommerceController.prototype.orders)),

            async function EcommerceController_orders(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsEcommerceController_orders, request, response });

                const controller = new EcommerceController();

              await templateService.apiHandler({
                methodName: 'orders',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsEcommerceController_placeOrder: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"items":{"dataType":"array","array":{"dataType":"nestedObjectLiteral","nestedProperties":{"unitPrice":{"dataType":"double","required":true},"quantity":{"dataType":"double","required":true},"name":{"dataType":"string","required":true},"productId":{"dataType":"string","required":true}}},"required":true},"paymentChannel":{"ref":"PaymentChannel"},"couponCode":{"dataType":"string"},"pincode":{"dataType":"string"},"shippingAddress":{"dataType":"string","required":true},"customerMobile":{"dataType":"string","required":true},"customerName":{"dataType":"string","required":true},"customerId":{"dataType":"string"}}},
        };
        app.post('/api/v1/ecommerce/orders',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(EcommerceController)),
            ...(fetchMiddlewares<RequestHandler>(EcommerceController.prototype.placeOrder)),

            async function EcommerceController_placeOrder(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsEcommerceController_placeOrder, request, response });

                const controller = new EcommerceController();

              await templateService.apiHandler({
                methodName: 'placeOrder',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsEcommerceController_updateStatus: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                orderId: {"in":"path","name":"orderId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"status":{"ref":"EcommerceOrderStatus","required":true}}},
        };
        app.put('/api/v1/ecommerce/orders/:orderId/status',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(EcommerceController)),
            ...(fetchMiddlewares<RequestHandler>(EcommerceController.prototype.updateStatus)),

            async function EcommerceController_updateStatus(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsEcommerceController_updateStatus, request, response });

                const controller = new EcommerceController();

              await templateService.apiHandler({
                methodName: 'updateStatus',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsDashboardController_getDashboard: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/dashboard',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(DashboardController)),
            ...(fetchMiddlewares<RequestHandler>(DashboardController.prototype.getDashboard)),

            async function DashboardController_getDashboard(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsDashboardController_getDashboard, request, response });

                const controller = new DashboardController();

              await templateService.apiHandler({
                methodName: 'getDashboard',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCatalogController_listProducts: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                ecommerceOnly: {"in":"query","name":"ecommerceOnly","dataType":"boolean"},
        };
        app.get('/api/v1/catalog/products',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(CatalogController)),
            ...(fetchMiddlewares<RequestHandler>(CatalogController.prototype.listProducts)),

            async function CatalogController_listProducts(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCatalogController_listProducts, request, response });

                const controller = new CatalogController();

              await templateService.apiHandler({
                methodName: 'listProducts',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCatalogController_upsertProduct: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"ref":"ProductBody"},
        };
        app.post('/api/v1/catalog/products',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(CatalogController)),
            ...(fetchMiddlewares<RequestHandler>(CatalogController.prototype.upsertProduct)),

            async function CatalogController_upsertProduct(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCatalogController_upsertProduct, request, response });

                const controller = new CatalogController();

              await templateService.apiHandler({
                methodName: 'upsertProduct',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCatalogController_listOperators: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/catalog/operators',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(CatalogController)),
            ...(fetchMiddlewares<RequestHandler>(CatalogController.prototype.listOperators)),

            async function CatalogController_listOperators(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCatalogController_listOperators, request, response });

                const controller = new CatalogController();

              await templateService.apiHandler({
                methodName: 'listOperators',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCatalogController_upsertOperator: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"ref":"OperatorBody"},
        };
        app.post('/api/v1/catalog/operators',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(CatalogController)),
            ...(fetchMiddlewares<RequestHandler>(CatalogController.prototype.upsertOperator)),

            async function CatalogController_upsertOperator(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCatalogController_upsertOperator, request, response });

                const controller = new CatalogController();

              await templateService.apiHandler({
                methodName: 'upsertOperator',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCatalogController_listFacilities: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/catalog/facilities',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(CatalogController)),
            ...(fetchMiddlewares<RequestHandler>(CatalogController.prototype.listFacilities)),

            async function CatalogController_listFacilities(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCatalogController_listFacilities, request, response });

                const controller = new CatalogController();

              await templateService.apiHandler({
                methodName: 'listFacilities',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCatalogController_listSessions: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/catalog/sessions',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(CatalogController)),
            ...(fetchMiddlewares<RequestHandler>(CatalogController.prototype.listSessions)),

            async function CatalogController_listSessions(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCatalogController_listSessions, request, response });

                const controller = new CatalogController();

              await templateService.apiHandler({
                methodName: 'listSessions',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsBarcodeController_resolveBarcode: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                facilityId: {"in":"query","name":"facilityId","required":true,"dataType":"string"},
                barcode: {"in":"path","name":"barcode","required":true,"dataType":"string"},
        };
        app.get('/api/v1/barcode/resolve/:barcode',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(BarcodeController)),
            ...(fetchMiddlewares<RequestHandler>(BarcodeController.prototype.resolveBarcode)),

            async function BarcodeController_resolveBarcode(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsBarcodeController_resolveBarcode, request, response });

                const controller = new BarcodeController();

              await templateService.apiHandler({
                methodName: 'resolveBarcode',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAuthController_login: Record<string, TsoaRoute.ParameterSchema> = {
                body: {"in":"body","name":"body","required":true,"ref":"LoginBody"},
        };
        app.post('/api/v1/auth/login',
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.login)),

            async function AuthController_login(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_login, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'login',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAnalyticsController_getExpiryDashboard: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"path","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/analytics/expiry/:tenantId',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(AnalyticsController)),
            ...(fetchMiddlewares<RequestHandler>(AnalyticsController.prototype.getExpiryDashboard)),

            async function AnalyticsController_getExpiryDashboard(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAnalyticsController_getExpiryDashboard, request, response });

                const controller = new AnalyticsController();

              await templateService.apiHandler({
                methodName: 'getExpiryDashboard',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAdminImportController_bootstrap: Record<string, TsoaRoute.ParameterSchema> = {
                importSecret: {"in":"header","name":"x-import-secret","dataType":"string"},
        };
        app.post('/api/v1/admin/bootstrap',
            ...(fetchMiddlewares<RequestHandler>(AdminImportController)),
            ...(fetchMiddlewares<RequestHandler>(AdminImportController.prototype.bootstrap)),

            async function AdminImportController_bootstrap(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAdminImportController_bootstrap, request, response });

                const controller = new AdminImportController();

              await templateService.apiHandler({
                methodName: 'bootstrap',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAdminImportController_importStock: Record<string, TsoaRoute.ParameterSchema> = {
                body: {"in":"body","name":"body","required":true,"ref":"ImportBatchBody"},
                importSecret: {"in":"header","name":"x-import-secret","dataType":"string"},
        };
        app.post('/api/v1/admin/import-stock',
            ...(fetchMiddlewares<RequestHandler>(AdminImportController)),
            ...(fetchMiddlewares<RequestHandler>(AdminImportController.prototype.importStock)),

            async function AdminImportController_importStock(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAdminImportController_importStock, request, response });

                const controller = new AdminImportController();

              await templateService.apiHandler({
                methodName: 'importStock',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAdminImportController_importStats: Record<string, TsoaRoute.ParameterSchema> = {
                importSecret: {"in":"header","name":"x-import-secret","dataType":"string"},
        };
        app.get('/api/v1/admin/import-stats',
            ...(fetchMiddlewares<RequestHandler>(AdminImportController)),
            ...(fetchMiddlewares<RequestHandler>(AdminImportController.prototype.importStats)),

            async function AdminImportController_importStats(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAdminImportController_importStats, request, response });

                const controller = new AdminImportController();

              await templateService.apiHandler({
                methodName: 'importStats',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAccountController_heads: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
        };
        app.get('/api/v1/accounts/heads',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(AccountController)),
            ...(fetchMiddlewares<RequestHandler>(AccountController.prototype.heads)),

            async function AccountController_heads(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAccountController_heads, request, response });

                const controller = new AccountController();

              await templateService.apiHandler({
                methodName: 'heads',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAccountController_upsertHead: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"isActive":{"dataType":"boolean"},"openingBalance":{"dataType":"double"},"nature":{"dataType":"string"},"groupName":{"dataType":"string","required":true},"name":{"dataType":"string","required":true},"id":{"dataType":"string"}}},
        };
        app.post('/api/v1/accounts/heads',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(AccountController)),
            ...(fetchMiddlewares<RequestHandler>(AccountController.prototype.upsertHead)),

            async function AccountController_upsertHead(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAccountController_upsertHead, request, response });

                const controller = new AccountController();

              await templateService.apiHandler({
                methodName: 'upsertHead',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAccountController_entries: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                partyType: {"in":"query","name":"partyType","ref":"PartyType"},
        };
        app.get('/api/v1/accounts/entries',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(AccountController)),
            ...(fetchMiddlewares<RequestHandler>(AccountController.prototype.entries)),

            async function AccountController_entries(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAccountController_entries, request, response });

                const controller = new AccountController();

              await templateService.apiHandler({
                methodName: 'entries',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAccountController_createEntry: Record<string, TsoaRoute.ParameterSchema> = {
                tenantId: {"in":"query","name":"tenantId","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"referenceNo":{"dataType":"string"},"narration":{"dataType":"string"},"paymentMode":{"dataType":"string"},"amount":{"dataType":"double","required":true},"entryDate":{"dataType":"string","required":true},"partyName":{"dataType":"string"},"partyId":{"dataType":"string"},"partyType":{"ref":"PartyType"},"accountHeadId":{"dataType":"string"},"entryType":{"ref":"AccountEntryType","required":true}}},
        };
        app.post('/api/v1/accounts/entries',
            authenticateMiddleware([{"tenantHeader":[]}]),
            ...(fetchMiddlewares<RequestHandler>(AccountController)),
            ...(fetchMiddlewares<RequestHandler>(AccountController.prototype.createEntry)),

            async function AccountController_createEntry(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAccountController_createEntry, request, response });

                const controller = new AccountController();

              await templateService.apiHandler({
                methodName: 'createEntry',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa


    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

    function authenticateMiddleware(security: TsoaRoute.Security[] = []) {
        return async function runAuthenticationMiddleware(request: any, response: any, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            // keep track of failed auth attempts so we can hand back the most
            // recent one.  This behavior was previously existing so preserving it
            // here
            const failedAttempts: any[] = [];
            const pushAndRethrow = (error: any) => {
                failedAttempts.push(error);
                throw error;
            };

            const secMethodOrPromises: Promise<any>[] = [];
            for (const secMethod of security) {
                if (Object.keys(secMethod).length > 1) {
                    const secMethodAndPromises: Promise<any>[] = [];

                    for (const name in secMethod) {
                        secMethodAndPromises.push(
                            expressAuthenticationRecasted(request, name, secMethod[name], response)
                                .catch(pushAndRethrow)
                        );
                    }

                    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

                    secMethodOrPromises.push(Promise.all(secMethodAndPromises)
                        .then(users => { return users[0]; }));
                } else {
                    for (const name in secMethod) {
                        secMethodOrPromises.push(
                            expressAuthenticationRecasted(request, name, secMethod[name], response)
                                .catch(pushAndRethrow)
                        );
                    }
                }
            }

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            try {
                request['user'] = await Promise.any(secMethodOrPromises);

                // Response was sent in middleware, abort
                if (response.writableEnded) {
                    return;
                }

                next();
            }
            catch(err) {
                // Show most recent error as response
                const error = failedAttempts.pop();
                error.status = error.status || 401;

                // Response was sent in middleware, abort
                if (response.writableEnded) {
                    return;
                }
                next(error);
            }

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        }
    }

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
}

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
