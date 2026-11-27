import { Body, Controller, Get, Path, Post, Query, Route, Security, SuccessResponse, Tags } from 'tsoa';
import { erpService } from '../core/services/erp.service';
import { StockMovement, StockTransfer, StocktakeSession } from '../models';

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

  @Get('stocktakes')
  @Security('tenantHeader')
  public async listStocktakes(
    @Query() tenantId: string,
    @Query() facilityId?: string,
  ): Promise<StocktakeSession[]> {
    return erpService.listStocktakes(tenantId, facilityId);
  }

  @Get('stocktakes/{sessionId}')
  @Security('tenantHeader')
  public async getStocktake(
    @Query() tenantId: string,
    @Path() sessionId: string,
  ): Promise<StocktakeSession> {
    return erpService.getStocktake(tenantId, sessionId);
  }

  @Post('stocktakes')
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async startStocktake(
    @Query() tenantId: string,
    @Body() body: { facilityId: string; startedBy: string; remark?: string },
  ): Promise<StocktakeSession> {
    this.setStatus(201);
    return erpService.startStocktake(tenantId, body);
  }

  @Post('stocktakes/count')
  @Security('tenantHeader')
  public async updateStocktakeCount(
    @Query() tenantId: string,
    @Body() body: { sessionId: string; lotId: string; countedQty: number; remark?: string },
  ): Promise<StocktakeSession> {
    return erpService.updateStocktakeCount(tenantId, body);
  }

  @Post('stocktakes/{sessionId}/commit')
  @Security('tenantHeader')
  public async commitStocktake(
    @Query() tenantId: string,
    @Path() sessionId: string,
  ): Promise<StocktakeSession> {
    return erpService.commitStocktake(tenantId, sessionId);
  }

  @Post('stocktakes/{sessionId}/cancel')
  @Security('tenantHeader')
  public async cancelStocktake(
    @Query() tenantId: string,
    @Path() sessionId: string,
  ): Promise<StocktakeSession> {
    return erpService.cancelStocktake(tenantId, sessionId);
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
