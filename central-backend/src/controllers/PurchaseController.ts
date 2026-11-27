import { Body, Controller, Get, Post, Query, Route, Security, SuccessResponse, Tags } from 'tsoa';
import { erpService } from '../core/services/erp.service';
import { GstMode, Purchase, PurchaseStatus } from '../models';

interface PurchaseBody {
  facilityId: string;
  supplierId: string;
  invoiceNumber?: string;
  invoiceDate: string;
  gstMode?: GstMode;
  remark?: string;
  status?: PurchaseStatus;
  otherCharges?: number;
  paidAmount?: number;
  paymentMode?: string;
  items: Array<{
    productId?: string;
    productName: string;
    barcode?: string;
    sku?: string;
    brand?: string;
    category?: string;
    hsnCode?: string;
    quantity: number;
    purchaseRate: number;
    mrp: number;
    saleRate: number;
    gstPercent?: number;
    isNewProduct?: boolean;
  }>;
}

@Route('api/v1/purchases')
@Tags('Purchases')
export class PurchaseController extends Controller {
  @Get()
  @Security('tenantHeader')
  public async list(@Query() tenantId: string): Promise<Purchase[]> {
    return erpService.listPurchases(tenantId);
  }

  @Post()
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async create(@Query() tenantId: string, @Body() body: PurchaseBody): Promise<Purchase> {
    this.setStatus(201);
    return erpService.createPurchase(tenantId, body);
  }
}
