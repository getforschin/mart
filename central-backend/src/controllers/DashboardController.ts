import { Controller, Get, Query, Route, Security, SuccessResponse, Tags } from 'tsoa';
import { erpService } from '../core/services/erp.service';

@Route('api/v1/dashboard')
@Tags('Dashboard')
export class DashboardController extends Controller {
  @Get()
  @Security('tenantHeader')
  @SuccessResponse(200, 'OK')
  public async getDashboard(@Query() tenantId: string): Promise<Record<string, unknown>> {
    return erpService.getDashboard(tenantId);
  }
}
