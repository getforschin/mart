import {
  Controller,
  Get,
  Path,
  Query,
  Route,
  Tags,
  Security,
  SuccessResponse,
  Response,
} from 'tsoa';
import { barcodeResolutionService } from '../core/services/barcode-resolution.service';
import { BarcodeResolutionResultDto, ApiErrorResponse } from '../dtos';
import { logInfo } from '../core/logging/logger';

@Route('api/v1/barcode')
@Tags('Barcode')
export class BarcodeController extends Controller {
  /**
   * Resolve a scanned barcode to lot inventory with FIFO multi-MRP selection support.
   * EAN-13 barcodes trigger product lookup with expiration-based FIFO recommendation.
   * Composite LOT-* tags bypass verification and resolve directly to lot configuration.
   */
  @Get('resolve/{barcode}')
  @Security('tenantHeader')
  @SuccessResponse(200, 'Barcode resolved')
  @Response<ApiErrorResponse>(404, 'Product or lot not found')
  public async resolveBarcode(
    @Query() tenantId: string,
    @Query() facilityId: string,
    @Path() barcode: string,
  ): Promise<BarcodeResolutionResultDto> {
    logInfo('BarcodeController.resolveBarcode', 'Barcode resolution request', {
      tenantId,
      facilityId,
      barcode,
    });

    const result = await barcodeResolutionService.resolveBarcode(tenantId, facilityId, barcode);
    this.setStatus(200);
    return result;
  }
}
