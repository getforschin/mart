import { getDataSource } from '../database/data-source';
import { logError, logInfo } from '../logging/logger';
import { ExpiryAlertDto, ExpiryDashboardDto } from '../../dtos';
import { ProductLot, LotInventoryStock, Facility, Product } from '../../models';

const CRITICAL_WINDOW_DAYS = 30;
const WARNING_WINDOW_DAYS = 60;

export class ExpiryAnalyticsService {
  async generateExpiryDashboard(tenantId: string): Promise<ExpiryDashboardDto> {
    logInfo('ExpiryAnalyticsService.generateExpiryDashboard', 'Sweeping product lots for expiry analytics', {
      tenantId,
      criticalWindowDays: CRITICAL_WINDOW_DAYS,
    });

    try {
      const dataSource = getDataSource();
      const now = new Date();
      const criticalThreshold = new Date(now);
      criticalThreshold.setDate(criticalThreshold.getDate() + CRITICAL_WINDOW_DAYS);

      const warningThreshold = new Date(now);
      warningThreshold.setDate(warningThreshold.getDate() + WARNING_WINDOW_DAYS);

      const lots = await dataSource
        .getRepository(ProductLot)
        .createQueryBuilder('lot')
        .innerJoinAndSelect('lot.product', 'product')
        .innerJoin(LotInventoryStock, 'stock', 'stock.lotId = lot.id AND stock.quantityOnHand > 0')
        .innerJoin(Facility, 'facility', 'facility.id = stock.facilityId')
        .where('product.tenantId = :tenantId', { tenantId })
        .andWhere('lot.isActive = true')
        .andWhere('lot.expiryDate <= :warningThreshold', { warningThreshold })
        .orderBy('lot.expiryDate', 'ASC')
        .getMany();

      const criticalAlerts: ExpiryAlertDto[] = [];
      const warningAlerts: ExpiryAlertDto[] = [];

      for (const lot of lots) {
        const stocks = await dataSource.getRepository(LotInventoryStock).find({
          where: { lotId: lot.id },
          relations: ['facility'],
        });

        for (const stock of stocks) {
          if (stock.quantityOnHand <= 0) {
            continue;
          }

          const alert = await this.buildExpiryAlert(lot, stock, now);
          if (alert.priority === 'CRITICAL') {
            criticalAlerts.push(alert);
          } else if (alert.priority === 'WARNING') {
            warningAlerts.push(alert);
          }
        }
      }

      logInfo('ExpiryAnalyticsService.generateExpiryDashboard', 'Expiry sweep completed', {
        tenantId,
        totalLotsScanned: lots.length,
        criticalCount: criticalAlerts.length,
        warningCount: warningAlerts.length,
      });

      return {
        tenantId,
        criticalWindowDays: CRITICAL_WINDOW_DAYS,
        totalLotsScanned: lots.length,
        criticalAlerts,
        warningAlerts,
        generatedAt: now.toISOString(),
      };
    } catch (error) {
      logError('ExpiryAnalyticsService.generateExpiryDashboard', error, { tenantId });
      throw error;
    }
  }

  private async buildExpiryAlert(
    lot: ProductLot,
    stock: LotInventoryStock,
    referenceDate: Date,
  ): Promise<ExpiryAlertDto> {
    const dataSource = getDataSource();
    const product = lot.product ?? (await dataSource.getRepository(Product).findOne({ where: { id: lot.productId } }));
    const facility =
      stock.facility ?? (await dataSource.getRepository(Facility).findOne({ where: { id: stock.facilityId } }));

    const expiryDate = new Date(lot.expiryDate);
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - referenceDate.getTime()) / millisecondsPerDay);

    let priority: ExpiryAlertDto['priority'];
    let recommendedAction: string;

    if (daysUntilExpiry <= CRITICAL_WINDOW_DAYS) {
      priority = 'CRITICAL';
      recommendedAction =
        daysUntilExpiry <= 7
          ? 'Immediate markdown or disposal required — expiry within 7 days'
          : 'Priority markdown strategy — within 30-day critical window';
    } else if (daysUntilExpiry <= WARNING_WINDOW_DAYS) {
      priority = 'WARNING';
      recommendedAction = 'Plan promotional pricing or inter-facility transfer before critical window';
    } else {
      priority = 'NORMAL';
      recommendedAction = 'Monitor inventory turnover';
    }

    return {
      lotId: lot.id,
      productId: lot.productId,
      productName: product?.name ?? 'Unknown Product',
      productSku: product?.sku ?? 'UNKNOWN',
      batchNumber: lot.batchNumber,
      expiryDate: expiryDate.toISOString(),
      daysUntilExpiry,
      quantityOnHand: stock.quantityOnHand,
      facilityId: stock.facilityId,
      facilityName: facility?.name ?? 'Unknown Facility',
      priority,
      recommendedAction,
    };
  }
}

export const expiryAnalyticsService = new ExpiryAnalyticsService();
