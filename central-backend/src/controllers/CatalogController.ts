import { Body, Controller, Get, Post, Query, Route, Security, SuccessResponse, Tags } from 'tsoa';
import { erpService } from '../core/services/erp.service';
import { Product, UserRole } from '../models';

interface ProductBody {
  id?: string;
  name: string;
  sku: string;
  baseBarcode: string;
  company?: string;
  category?: string;
  brand?: string;
  subCategory?: string;
  unit?: string;
  hsnCode?: string;
  gstPercent?: number;
  saleRate?: number;
  mrp?: number;
  purchaseRate?: number;
  minStock?: number;
  maxStock?: number;
  description?: string;
  imageUrl?: string;
  showOnEcommerce?: boolean;
  isActive?: boolean;
}

interface OperatorBody {
  id?: string;
  email: string;
  username?: string;
  fullName: string;
  mobile?: string;
  role: UserRole;
  password?: string;
  isActive?: boolean;
}

@Route('api/v1/catalog')
@Tags('Catalog')
export class CatalogController extends Controller {
  @Get('products')
  @Security('tenantHeader')
  public async listProducts(
    @Query() tenantId: string,
    @Query() ecommerceOnly?: boolean,
  ): Promise<Product[]> {
    return erpService.listProducts(tenantId, ecommerceOnly === true);
  }

  @Post('products')
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async upsertProduct(@Query() tenantId: string, @Body() body: ProductBody): Promise<Product> {
    this.setStatus(201);
    return erpService.upsertProduct(tenantId, body);
  }

  @Get('operators')
  @Security('tenantHeader')
  public async listOperators(@Query() tenantId: string) {
    return erpService.listOperators(tenantId);
  }

  @Post('operators')
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async upsertOperator(@Query() tenantId: string, @Body() body: OperatorBody) {
    this.setStatus(201);
    return erpService.upsertOperator(tenantId, body);
  }

  @Get('facilities')
  @Security('tenantHeader')
  public async listFacilities(@Query() tenantId: string) {
    return erpService.listFacilities(tenantId);
  }

  @Get('sessions')
  @Security('tenantHeader')
  public async listSessions(@Query() tenantId: string) {
    return erpService.listSessions(tenantId);
  }
}
