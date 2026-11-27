import { Body, Controller, Get, Post, Query, Route, Security, SuccessResponse, Tags } from 'tsoa';
import { erpService } from '../core/services/erp.service';
import { OrderInvoice, OrderOriginSource, PaymentChannel } from '../models';

interface SaleBody {
  facilityId: string;
  cashierId: string;
  customerMobile?: string;
  customerName?: string;
  paymentChannel: PaymentChannel;
  originSource: OrderOriginSource;
  discountTotal?: number;
  items: Array<{ productId: string; lotId: string; quantity: number; unitPrice: number }>;
}

@Route('api/v1/sales')
@Tags('Sales')
export class SalesController extends Controller {
  @Get()
  @Security('tenantHeader')
  public async list(
    @Query() tenantId: string,
    @Query() limit?: number,
  ): Promise<OrderInvoice[]> {
    return erpService.listSales(tenantId, limit);
  }

  @Post()
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async create(@Query() tenantId: string, @Body() body: SaleBody): Promise<OrderInvoice> {
    this.setStatus(201);
    return erpService.createSale(tenantId, body);
  }
}
