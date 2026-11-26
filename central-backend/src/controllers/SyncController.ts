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
import { SyncPushRequestDto, SyncPushResponseDto, ApiErrorResponse } from '../dtos';
import { logInfo } from '../core/logging/logger';

@Route('api/v1/sync')
@Tags('Sync')
export class SyncController extends Controller {
  /**
   * Push offline-generated invoices and attendance records from POS terminals.
   * Uses client-generated UUIDs for idempotent append-only event processing.
   * Stock reductions apply relative delta decrements within transactional blocks.
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

    if (body.invoices.length === 0 && body.attendanceRecords.length === 0) {
      this.setStatus(400);
      throw new Error('Sync payload must contain at least one invoice or attendance record');
    }

    const result = await syncService.pushOfflineEvents(body);
    this.setStatus(200);
    return result;
  }
}
