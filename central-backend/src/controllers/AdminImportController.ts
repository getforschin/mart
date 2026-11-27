import { Body, Controller, Get, Header, Post, Route, SuccessResponse, Tags } from 'tsoa';
import {
  stockImportService,
  StockImportItem,
  DEMO_TENANT_ID,
  DEMO_FACILITY_ID,
} from '../core/services/stock-import.service';
import {
  salesImportService,
  HistoricalSaleInvoice,
  HistoricalSalesImportResult,
} from '../core/services/sales-import.service';

interface BootstrapResponse {
  tenantId: string;
  facilityId: string;
  message: string;
}

interface ImportBatchBody {
  clearExisting?: boolean;
  items: StockImportItem[];
}

interface ImportBatchResponse {
  imported: number;
  totalQty: number;
  stats: { products: number; lots: number; qty: number };
}

interface ImportHistoricalSalesBody {
  /** When true (default), replace invoices that already exist with the same invoiceNumber. */
  replaceExisting?: boolean;
  invoices: HistoricalSaleInvoice[];
}

@Route('api/v1/admin')
@Tags('AdminImport')
export class AdminImportController extends Controller {
  /**
   * One-time bootstrap for Railway: creates CNP Mart tenant, store, admin/cashier.
   * Auth: header x-import-secret must match IMPORT_SECRET env var.
   */
  @Post('bootstrap')
  @SuccessResponse(200, 'Bootstrapped')
  public async bootstrap(
    @Header('x-import-secret') importSecret?: string,
  ): Promise<BootstrapResponse> {
    stockImportService.assertImportSecret(importSecret);
    const result = await stockImportService.bootstrapTenant();
    this.setStatus(200);
    return {
      ...result,
      message: 'CNP Mart tenant ready. Login admin / admin123',
    };
  }

  /**
   * Import a batch of opening-stock products (idempotent per Item_ID / CNP-SKU).
   * Send clearExisting=true on the first batch only.
   */
  @Post('import-stock')
  @SuccessResponse(200, 'Imported')
  public async importStock(
    @Body() body: ImportBatchBody,
    @Header('x-import-secret') importSecret?: string,
  ): Promise<ImportBatchResponse> {
    stockImportService.assertImportSecret(importSecret);
    await stockImportService.bootstrapTenant();

    if (body.clearExisting === true) {
      await stockImportService.clearCnpCatalog();
    }

    const result = await stockImportService.importBatch(body.items ?? []);
    const stats = await stockImportService.stats();
    this.setStatus(200);
    return { ...result, stats };
  }

  @Get('import-stats')
  public async importStats(
    @Header('x-import-secret') importSecret?: string,
  ): Promise<{ tenantId: string; facilityId: string; products: number; lots: number; qty: number }> {
    stockImportService.assertImportSecret(importSecret);
    const stats = await stockImportService.stats();
    return {
      tenantId: DEMO_TENANT_ID,
      facilityId: DEMO_FACILITY_ID,
      ...stats,
    };
  }

  /**
   * Import historical POS sale bills (itemwise backfill).
   * Does NOT adjust stock — use when opening stock already reflects closing inventory.
   * Auth: x-import-secret must match IMPORT_SECRET.
   */
  @Post('import-historical-sales')
  @SuccessResponse(200, 'Imported')
  public async importHistoricalSales(
    @Body() body: ImportHistoricalSalesBody,
    @Header('x-import-secret') importSecret?: string,
  ): Promise<HistoricalSalesImportResult & { stats: { invoices: number; lines: number; netTotal: number } }> {
    salesImportService.assertImportSecret(importSecret);
    await stockImportService.bootstrapTenant();
    const result = await salesImportService.importBatch(body.invoices ?? [], {
      replaceExisting: body.replaceExisting !== false,
    });
    const stats = await salesImportService.salesStats();
    this.setStatus(200);
    return { ...result, stats };
  }

  @Get('sales-import-stats')
  public async salesImportStats(
    @Header('x-import-secret') importSecret?: string,
  ): Promise<{ tenantId: string; facilityId: string; invoices: number; lines: number; netTotal: number }> {
    salesImportService.assertImportSecret(importSecret);
    const stats = await salesImportService.salesStats();
    return {
      tenantId: DEMO_TENANT_ID,
      facilityId: DEMO_FACILITY_ID,
      ...stats,
    };
  }
}
