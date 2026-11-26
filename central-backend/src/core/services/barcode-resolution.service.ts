import { getDataSource } from '../database/data-source';
import { logInfo } from '../logging/logger';
import { createAppError } from '../interceptors/error-handler.middleware';
import { BarcodeResolutionResultDto, ProductLotResponseDto } from '../../dtos';
import { Product, ProductLot, LotInventoryStock } from '../../models';

const COMPOSITE_LOT_BARCODE_PREFIX = 'LOT-';
const EAN13_LENGTH = 13;

export class BarcodeResolutionService {
  async resolveBarcode(
    tenantId: string,
    facilityId: string,
    scannedBarcode: string,
  ): Promise<BarcodeResolutionResultDto> {
    const normalizedBarcode = scannedBarcode.trim();

    if (normalizedBarcode.length === 0) {
      throw createAppError('Barcode cannot be empty', 400, 'INVALID_BARCODE');
    }

    logInfo('BarcodeResolutionService.resolveBarcode', 'Processing barcode scan', {
      tenantId,
      facilityId,
      barcodeLength: normalizedBarcode.length,
    });

    if (normalizedBarcode.startsWith(COMPOSITE_LOT_BARCODE_PREFIX)) {
      return this.resolveCompositeLotBarcode(tenantId, facilityId, normalizedBarcode);
    }

    if (this.isEan13Barcode(normalizedBarcode)) {
      return this.resolveEan13Barcode(tenantId, facilityId, normalizedBarcode);
    }

    return this.resolveGenericBarcode(tenantId, facilityId, normalizedBarcode);
  }

  private isEan13Barcode(barcode: string): boolean {
    if (barcode.length !== EAN13_LENGTH || !/^\d{13}$/.test(barcode)) {
      return false;
    }
    return this.validateEan13CheckDigit(barcode);
  }

  private validateEan13CheckDigit(barcode: string): boolean {
    const digits = barcode.split('').map((char) => parseInt(char, 10));
    let sum = 0;
    for (let index = 0; index < 12; index += 1) {
      sum += digits[index] * (index % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === digits[12];
  }

  private async resolveCompositeLotBarcode(
    tenantId: string,
    facilityId: string,
    lotBarcode: string,
  ): Promise<BarcodeResolutionResultDto> {
    const dataSource = getDataSource();
    const lotRepository = dataSource.getRepository(ProductLot);

    const lot = await lotRepository
      .createQueryBuilder('lot')
      .innerJoinAndSelect('lot.product', 'product')
      .innerJoin(
        LotInventoryStock,
        'stock',
        'stock.lotId = lot.id AND stock.facilityId = :facilityId AND stock.quantityOnHand > 0',
        { facilityId },
      )
      .where('lot.lotBarcode = :lotBarcode', { lotBarcode })
      .andWhere('product.tenantId = :tenantId', { tenantId })
      .andWhere('lot.isActive = true')
      .getOne();

    if (lot === null) {
      throw createAppError(
        `Composite lot barcode ${lotBarcode} not found or out of stock at facility`,
        404,
        'LOT_NOT_FOUND',
        { lotBarcode, facilityId },
      );
    }

    const stockRecord = await dataSource.getRepository(LotInventoryStock).findOne({
      where: { lotId: lot.id, facilityId },
    });

    const lotDto = this.mapLotToDto(lot, stockRecord?.quantityOnHand ?? 0, stockRecord?.aisleShelfLocation ?? null);

    logInfo('BarcodeResolutionService.resolveCompositeLotBarcode', 'Direct composite lot resolved', {
      lotId: lot.id,
      lotBarcode,
    });

    return {
      resolutionType: 'COMPOSITE_LOT_DIRECT',
      productId: lot.productId,
      productName: lot.product.name,
      productSku: lot.product.sku,
      suggestedLot: lotDto,
      candidateLots: [lotDto],
      fifoRecommendation: lotDto,
    };
  }

  private async resolveEan13Barcode(
    tenantId: string,
    facilityId: string,
    ean13Barcode: string,
  ): Promise<BarcodeResolutionResultDto> {
    const dataSource = getDataSource();
    const productRepository = dataSource.getRepository(Product);

    const product = await productRepository.findOne({
      where: { tenantId, baseBarcode: ean13Barcode, isActive: true },
    });

    if (product === null) {
      throw createAppError(
        `No product found for EAN-13 barcode ${ean13Barcode}`,
        404,
        'PRODUCT_NOT_FOUND',
        { barcode: ean13Barcode },
      );
    }

    const candidateLots = await this.fetchActiveLotsForProduct(product.id, facilityId);

    if (candidateLots.length === 0) {
      throw createAppError(
        `No active lot inventory for product ${product.sku} at facility`,
        404,
        'NO_LOT_INVENTORY',
        { productId: product.id, facilityId },
      );
    }

    const sortedByFifo = [...candidateLots].sort(
      (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
    );

    const fifoRecommendation = sortedByFifo[0];
    const distinctMrpValues = new Set(candidateLots.map((lot) => lot.mrp));

    if (distinctMrpValues.size === 1) {
      return {
        resolutionType: 'SINGLE_LOT',
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        suggestedLot: fifoRecommendation,
        candidateLots,
        fifoRecommendation,
      };
    }

    logInfo('BarcodeResolutionService.resolveEan13Barcode', 'Multiple MRP lots detected', {
      productId: product.id,
      lotCount: candidateLots.length,
      distinctMrpCount: distinctMrpValues.size,
    });

    return {
      resolutionType: 'MULTI_MRP_SELECTION',
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      suggestedLot: fifoRecommendation,
      candidateLots: sortedByFifo,
      fifoRecommendation,
    };
  }

  private async resolveGenericBarcode(
    tenantId: string,
    facilityId: string,
    barcode: string,
  ): Promise<BarcodeResolutionResultDto> {
    const dataSource = getDataSource();
    const productRepository = dataSource.getRepository(Product);

    const product = await productRepository.findOne({
      where: { tenantId, baseBarcode: barcode, isActive: true },
    });

    if (product === null) {
      throw createAppError(`No product found for barcode ${barcode}`, 404, 'PRODUCT_NOT_FOUND', { barcode });
    }

    const candidateLots = await this.fetchActiveLotsForProduct(product.id, facilityId);
    const sortedByFifo = [...candidateLots].sort(
      (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
    );

    return {
      resolutionType: candidateLots.length > 1 ? 'MULTI_MRP_SELECTION' : 'SINGLE_LOT',
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      suggestedLot: sortedByFifo[0] ?? null,
      candidateLots: sortedByFifo,
      fifoRecommendation: sortedByFifo[0] ?? null,
    };
  }

  private async fetchActiveLotsForProduct(
    productId: string,
    facilityId: string,
  ): Promise<ProductLotResponseDto[]> {
    const dataSource = getDataSource();

    const lots = await dataSource
      .getRepository(ProductLot)
      .createQueryBuilder('lot')
      .innerJoin(
        LotInventoryStock,
        'stock',
        'stock.lotId = lot.id AND stock.facilityId = :facilityId AND stock.quantityOnHand > 0',
        { facilityId },
      )
      .where('lot.productId = :productId', { productId })
      .andWhere('lot.isActive = true')
      .getMany();

    const result: ProductLotResponseDto[] = [];

    for (const lot of lots) {
      const stock = await dataSource.getRepository(LotInventoryStock).findOne({
        where: { lotId: lot.id, facilityId },
      });
      result.push(this.mapLotToDto(lot, stock?.quantityOnHand ?? 0, stock?.aisleShelfLocation ?? null));
    }

    return result;
  }

  private mapLotToDto(
    lot: ProductLot,
    quantityOnHand: number,
    aisleShelfLocation: string | null,
  ): ProductLotResponseDto {
    return {
      id: lot.id,
      productId: lot.productId,
      batchNumber: lot.batchNumber,
      costPrice: Number(lot.costPrice),
      mrp: Number(lot.mrp),
      manufactureDate: lot.manufactureDate.toISOString(),
      expiryDate: lot.expiryDate.toISOString(),
      lotBarcode: lot.lotBarcode,
      quantityOnHand,
      aisleShelfLocation,
    };
  }
}

export const barcodeResolutionService = new BarcodeResolutionService();
