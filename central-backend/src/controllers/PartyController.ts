import { Body, Controller, Get, Path, Post, Query, Route, Security, SuccessResponse, Tags } from 'tsoa';
import { erpService } from '../core/services/erp.service';
import { AccountEntry, Customer, Supplier } from '../models';

interface CustomerBody {
  id?: string;
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  membershipCard?: string;
  discountPercent?: number;
  priceType?: string;
  creditLimit?: number;
  isActive?: boolean;
}

interface SupplierBody {
  id?: string;
  name: string;
  mobile?: string;
  email?: string;
  address?: string;
  state?: string;
  gstin?: string;
  isActive?: boolean;
}

@Route('api/v1/parties')
@Tags('Parties')
export class PartyController extends Controller {
  @Get('customers')
  @Security('tenantHeader')
  public async listCustomers(@Query() tenantId: string): Promise<Customer[]> {
    return erpService.listCustomers(tenantId);
  }

  @Post('customers')
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async upsertCustomer(@Query() tenantId: string, @Body() body: CustomerBody): Promise<Customer> {
    this.setStatus(201);
    return erpService.upsertCustomer(tenantId, body);
  }

  @Get('suppliers')
  @Security('tenantHeader')
  public async listSuppliers(@Query() tenantId: string): Promise<Supplier[]> {
    return erpService.listSuppliers(tenantId);
  }

  @Post('suppliers')
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async upsertSupplier(@Query() tenantId: string, @Body() body: SupplierBody): Promise<Supplier> {
    this.setStatus(201);
    return erpService.upsertSupplier(tenantId, body);
  }

  @Post('suppliers/{supplierId}/payments')
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async paySupplier(
    @Query() tenantId: string,
    @Path() supplierId: string,
    @Body()
    body: {
      amount: number;
      paymentMode: string;
      entryDate: string;
      remark?: string;
      referenceNo?: string;
    },
  ): Promise<{ supplier: Supplier; entry: AccountEntry }> {
    this.setStatus(201);
    return erpService.paySupplier(tenantId, { ...body, supplierId });
  }

  @Get('suppliers/{supplierId}/ledger')
  @Security('tenantHeader')
  public async supplierLedger(
    @Query() tenantId: string,
    @Path() supplierId: string,
  ): Promise<Record<string, unknown>> {
    return erpService.getSupplierLedger(tenantId, supplierId);
  }
}
