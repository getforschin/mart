import { Controller, Get, Query, Route, Security, Tags } from 'tsoa';
import { erpService } from '../core/services/erp.service';

@Route('api/v1/reports')
@Tags('Reports')
export class ReportController extends Controller {
  @Get()
  @Security('tenantHeader')
  public async getReports(@Query() tenantId: string): Promise<Record<string, unknown>> {
    return erpService.getReports(tenantId);
  }
}
