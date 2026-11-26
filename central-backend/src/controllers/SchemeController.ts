import { Body, Controller, Get, Post, Query, Route, Security, SuccessResponse, Tags } from 'tsoa';
import { erpService } from '../core/services/erp.service';
import { Scheme, SchemeType } from '../models';

interface SchemeBody {
  id?: string;
  name: string;
  schemeType: SchemeType;
  description?: string;
  buyQuantity?: number;
  getQuantity?: number;
  discountPercent?: number;
  minBillAmount?: number;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

@Route('api/v1/schemes')
@Tags('Schemes')
export class SchemeController extends Controller {
  @Get()
  @Security('tenantHeader')
  public async list(@Query() tenantId: string): Promise<Scheme[]> {
    return erpService.listSchemes(tenantId);
  }

  @Post()
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async upsert(@Query() tenantId: string, @Body() body: SchemeBody): Promise<Scheme> {
    this.setStatus(201);
    return erpService.upsertScheme(tenantId, body);
  }
}
