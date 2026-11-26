/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import type { TsoaRoute } from '@tsoa/runtime';
import {  fetchMiddlewares, ExpressTemplateService } from '@tsoa/runtime';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { SyncController } from './../controllers/SyncController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { HealthController } from './../controllers/HealthController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { BarcodeController } from './../controllers/BarcodeController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { AnalyticsController } from './../controllers/AnalyticsController';
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
