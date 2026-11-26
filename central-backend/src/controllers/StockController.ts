import { Body, Controller, Get, Post, Query, Route, Security, SuccessResponse, Tags } from 'tsoa';
import { erpService } from '../core/services/erp.service';
import { StockMovement, StockTransfer } from '../models';

@Route('api/v1/stock')
@Tags('Stock')
export class StockController extends Controller {
  @Get()
  @Security('tenantHeader')
  public async list(@Query() tenantId: string, @Query() facilityId?: string): Promise<Array<Record<string, unknown>>> {
    return erpService.listStock(tenantId, facilityId);
  }

  @Get('movements')
  @Security('tenantHeader')
  public async movements(@Query() tenantId: string): Promise<StockMovement[]> {
    return erpService.listMovements(tenantId);
  }

  @Post('dump')
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async dump(
    @Query() tenantId: string,
    @Body() body: { facilityId: string; productId: string; lotId: string; quantity: number; remark?: string },
  ): Promise<StockMovement> {
    this.setStatus(201);
    return erpService.dumpStock(tenantId, body);
  }

  @Post('correct')
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async correct(
    @Query() tenantId: string,
    @Body() body: { facilityId: string; productId: string; lotId: string; newQuantity: number; remark?: string },
  ): Promise<StockMovement> {
    this.setStatus(201);
    return erpService.correctStock(tenantId, body);
  }

  @Get('transfers')
  @Security('tenantHeader')
  public async transfers(@Query() tenantId: string): Promise<StockTransfer[]> {
    return erpService.listTransfers(tenantId);
  }

  @Post('transfers')
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async createTransfer(
    @Query() tenantId: string,
    @Body()
    body: {
      fromFacilityId: string;
      toFacilityId: string;
      productId: string;
      lotId: string;
      quantity: number;
      transportDetail?: string;
      remark?: string;
    },
  ): Promise<StockTransfer> {
    this.setStatus(201);
    return erpService.createTransfer(tenantId, body);
  }
}
