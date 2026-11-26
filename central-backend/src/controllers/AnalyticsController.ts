import {
  Controller,
  Get,
  Path,
  Route,
  Tags,
  Security,
  SuccessResponse,
  Response,
} from 'tsoa';
import { expiryAnalyticsService } from '../core/services/expiry-analytics.service';
import { ExpiryDashboardDto, ApiErrorResponse } from '../dtos';
import { logInfo } from '../core/logging/logger';

@Route('api/v1/analytics')
@Tags('Analytics')
export class AnalyticsController extends Controller {
  /**
   * Automated expiry monitoring dashboard sweep.
   * Highlights product lots within the 30-day critical window for markdown strategies.
   */
  @Get('expiry/{tenantId}')
  @Security('tenantHeader')
  @SuccessResponse(200, 'Expiry dashboard generated')
  @Response<ApiErrorResponse>(500, 'Analytics generation failure')
  public async getExpiryDashboard(@Path() tenantId: string): Promise<ExpiryDashboardDto> {
    logInfo('AnalyticsController.getExpiryDashboard', 'Generating expiry dashboard', { tenantId });
    const dashboard = await expiryAnalyticsService.generateExpiryDashboard(tenantId);
    this.setStatus(200);
    return dashboard;
  }
}
