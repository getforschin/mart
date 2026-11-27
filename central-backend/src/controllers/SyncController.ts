import {
  Body,
  Controller,
  Post,
  Route,
  Tags,
  Security,
  SuccessResponse,
  Response,
} from 'tsoa';
import { syncService } from '../core/services/sync.service';
import {
  SyncPushRequestDto,
  SyncPushResponseDto,
  SyncPullRequestDto,
  SyncPullResponseDto,
  ApiErrorResponse,
} from '../dtos';
import { logInfo } from '../core/logging/logger';

@Route('api/v1/sync')
@Tags('Sync')
export class SyncController extends Controller {
  /**
   * Push offline-generated events from POS terminals (invoices, customers, purchases, stock, attendance).
   * Uses client-generated UUIDs for idempotent append-only event processing.
   */
  @Post('push')
  @Security('tenantHeader')
  @SuccessResponse(200, 'Sync batch processed')
  @Response<ApiErrorResponse>(400, 'Invalid sync payload')
  @Response<ApiErrorResponse>(403, 'Tenant inactive or unauthorized')
  @Response<ApiErrorResponse>(500, 'Sync processing failure')
  public async pushOfflineEvents(@Body() body: SyncPushRequestDto): Promise<SyncPushResponseDto> {
    logInfo('SyncController.pushOfflineEvents', 'Received sync push request', {
      tenantId: body.tenantId,
      facilityId: body.facilityId,
      deviceId: body.deviceId,
    });

    const invoices = body.invoices ?? [];
    const attendance = body.attendanceRecords ?? [];
    const customers = body.customers ?? [];
    const purchases = body.purchases ?? [];
    const stockEvents = body.stockEvents ?? [];

    if (
      invoices.length === 0 &&
      attendance.length === 0 &&
      customers.length === 0 &&
      purchases.length === 0 &&
      stockEvents.length === 0
    ) {
      this.setStatus(400);
      throw new Error('Sync payload must contain at least one event');
    }

    const result = await syncService.pushOfflineEvents(body);
    this.setStatus(200);
    return result;
  }

  /**
   * Pull central catalog/customers/stock into a POS terminal (delta by `since` cursor).
   */
  @Post('pull')
  @Security('tenantHeader')
  @SuccessResponse(200, 'Pull snapshot')
  @Response<ApiErrorResponse>(400, 'Invalid pull payload')
  @Response<ApiErrorResponse>(500, 'Pull processing failure')
  public async pullCentralState(@Body() body: SyncPullRequestDto): Promise<SyncPullResponseDto> {
    logInfo('SyncController.pullCentralState', 'Received sync pull request', {
      tenantId: body.tenantId,
      facilityId: body.facilityId,
      deviceId: body.deviceId,
      since: body.since ?? null,
    });
    const result = await syncService.pullCentralState(body);
    this.setStatus(200);
    return result;
  }
}
