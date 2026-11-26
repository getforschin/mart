import bcrypt from 'bcryptjs';
import { v5 as uuidv5 } from 'uuid';
import { getDataSource } from '../database/data-source';
import { createAppError } from '../interceptors/error-handler.middleware';
import { logInfo } from '../logging/logger';
import {
  Tenant,
  User,
  Facility,
  Product,
  ProductLot,
  LotInventoryStock,
  TenantStatus,
  UserRole,
  FacilityType,
} from '../../models';

export const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const DEMO_FACILITY_ID = '00000000-0000-0000-0000-000000000002';
export const DEMO_WAREHOUSE_ID = '00000000-0000-0000-0000-000000000004';
export const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000005';
export const DEMO_CASHIER_ID = '00000000-0000-0000-0000-000000000003';

// Must be RFC-compliant UUIDs (uuid@9 rejects nil-variant namespaces).
const PRODUCT_NS = '00000000-0000-4000-8000-00000000c001';
const LOT_NS = '00000000-0000-4000-8000-00000000c002';
const STOCK_NS = '00000000-0000-4000-8000-00000000c003';

export interface StockImportItem {
  itemId: number;
  name: string;
  barcode: string;
  brand?: string | null;
  size?: string | null;
  color?: string | null;
  mrp: number;
  saleRate: number;
  costPrice: number;
  quantityOnHand: number;
}

export class StockImportService {
  assertImportSecret(headerValue: string | undefined): void {
    const expected = process.env.IMPORT_SECRET?.trim();
    if (!expected) {
      throw createAppError(
        'IMPORT_SECRET is not configured on the server',
        503,
        'IMPORT_NOT_CONFIGURED',
      );
    }
    if (!headerValue || headerValue.trim() !== expected) {
      throw createAppError('Invalid import secret', 401, 'UNAUTHORIZED');
    }
  }

  async bootstrapTenant(): Promise<{ tenantId: string; facilityId: string }> {
    const ds = getDataSource();
    const passwordHash = await bcrypt.hash('admin123', 10);

    await ds.transaction(async (manager) => {
      const tenantRepo = manager.getRepository(Tenant);
      let tenant = await tenantRepo.findOne({ where: { id: DEMO_TENANT_ID } });
      if (!tenant) {
        tenant = tenantRepo.create({
          id: DEMO_TENANT_ID,
          name: 'CNP Mart',
          subdomain: 'demo-mart',
          status: TenantStatus.ACTIVE,
          metadata: {
            theme: {
              primaryColor: '#0f766e',
              secondaryColor: '#134e4a',
              accentColor: '#f59e0b',
              logoUrl: '/assets/logo.svg',
              fontFamily: '"DM Sans", sans-serif',
            },
            taxParameters: {
              regionCode: 'IN-UK',
              standardVatRate: 18,
              reducedVatRate: 5,
              gstRate: 18,
              pricesIncludeTax: false,
              currencyCode: 'INR',
            },
            featureFlags: {
              enableLotTracking: true,
              enableOfflinePos: true,
              enableWebStorefront: true,
              enableExpiryAlerts: true,
              enableBiometricAttendance: true,
              enableMultiMrpSelection: true,
            },
            supportEmail: 'support@cnpmart.local',
          },
        });
      } else {
        tenant.name = 'CNP Mart';
        tenant.status = TenantStatus.ACTIVE;
      }
      await tenantRepo.save(tenant);

      const facilityRepo = manager.getRepository(Facility);
      const facilities = [
        {
          id: DEMO_FACILITY_ID,
          tenantId: DEMO_TENANT_ID,
          type: FacilityType.RETAIL_STORE,
          name: 'CNP Mart — Main',
          shortcut: 'CNP',
          state: 'Uttarakhand',
          gstin: '05AAAAA0000A1Z5',
          mobile: '8393926666',
          registerType: 'Registered-Regular',
          geoCoordinates: { latitude: 30.3165, longitude: 78.0322, accuracyMeters: 10 },
          isActive: true,
        },
        {
          id: DEMO_WAREHOUSE_ID,
          tenantId: DEMO_TENANT_ID,
          type: FacilityType.WAREHOUSE,
          name: 'CNP Warehouse',
          shortcut: 'WH1',
          state: 'Uttarakhand',
          gstin: '05AAAAA0000A1Z5',
          mobile: '8393926667',
          registerType: 'Registered-Regular',
          geoCoordinates: { latitude: 30.32, longitude: 78.04, accuracyMeters: 10 },
          isActive: true,
        },
      ] as const;

      for (const row of facilities) {
        const existing = await facilityRepo.findOne({ where: { id: row.id } });
        await facilityRepo.save(existing ? Object.assign(existing, row) : facilityRepo.create({ ...row }));
      }

      const userRepo = manager.getRepository(User);
      const users = [
        {
          id: DEMO_ADMIN_ID,
          tenantId: DEMO_TENANT_ID,
          email: 'admin@demo-mart.local',
          username: 'admin',
          fullName: 'Store Admin',
          mobile: '8393926666',
          passwordHash,
          role: UserRole.MART_ADMIN,
          isActive: true,
        },
        {
          id: DEMO_CASHIER_ID,
          tenantId: DEMO_TENANT_ID,
          email: 'cashier@demo-mart.local',
          username: 'cashier',
          fullName: 'Demo Cashier',
          mobile: '9876543210',
          passwordHash,
          role: UserRole.CASHIER,
          isActive: true,
        },
      ] as const;

      for (const row of users) {
        const existing = await userRepo.findOne({ where: { id: row.id } });
        await userRepo.save(existing ? Object.assign(existing, row) : userRepo.create({ ...row }));
      }
    });

    logInfo('StockImportService.bootstrapTenant', 'Tenant bootstrap complete', {
      tenantId: DEMO_TENANT_ID,
      facilityId: DEMO_FACILITY_ID,
    });

    return { tenantId: DEMO_TENANT_ID, facilityId: DEMO_FACILITY_ID };
  }

  async clearCnpCatalog(): Promise<void> {
    const ds = getDataSource();
    await ds.query(`
      DELETE FROM lot_inventory_stock
      WHERE "lotId" IN (
        SELECT id FROM product_lots WHERE "lotBarcode" LIKE 'LOT-CNP-%'
      );
      DELETE FROM product_lots WHERE "lotBarcode" LIKE 'LOT-CNP-%';
      DELETE FROM products WHERE sku LIKE 'CNP-%';
    `);
  }

  async importBatch(items: StockImportItem[]): Promise<{ imported: number; totalQty: number }> {
    if (items.length === 0) {
      return { imported: 0, totalQty: 0 };
    }

    const ds = getDataSource();
    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + 730);

    let totalQty = 0;

    await ds.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const lotRepo = manager.getRepository(ProductLot);
      const stockRepo = manager.getRepository(LotInventoryStock);

      const products: Product[] = [];
      const lots: ProductLot[] = [];
      const stocks: LotInventoryStock[] = [];

      for (const item of items) {
        const sku = `CNP-${item.itemId}`;
        const productId = uuidv5(sku, PRODUCT_NS);
        const lotId = uuidv5(sku, LOT_NS);
        const stockId = uuidv5(sku, STOCK_NS);
        const qty = Math.max(0, Math.round(item.quantityOnHand || 0));
        totalQty += qty;

        const barcode = (item.barcode || `CNP-${item.itemId}`).slice(0, 32);
        const name = (item.name || sku).slice(0, 512);
        const brand = item.brand ? String(item.brand).slice(0, 128) : null;
        const size = item.size ? String(item.size).slice(0, 32) : null;
        const color = item.color ? String(item.color).slice(0, 32) : null;

        products.push(
          productRepo.create({
            id: productId,
            tenantId: DEMO_TENANT_ID,
            sku,
            baseBarcode: barcode,
            name,
            company: brand,
            brand,
            size,
            color,
            unit: 'PCS',
            gstPercent: 0,
            saleRate: item.saleRate || item.mrp || 0,
            mrp: item.mrp || 0,
            purchaseRate: item.costPrice || 0,
            description: `Legacy Item_ID=${item.itemId}`,
            showOnEcommerce: false,
            isActive: true,
          }),
        );

        lots.push(
          lotRepo.create({
            id: lotId,
            productId,
            batchNumber: `OPENING-${item.itemId}`,
            costPrice: item.costPrice || 0,
            mrp: item.mrp || 0,
            manufactureDate: now,
            expiryDate: expiry,
            lotBarcode: `LOT-CNP-${item.itemId}`,
            isActive: true,
          }),
        );

        stocks.push(
          stockRepo.create({
            id: stockId,
            lotId,
            facilityId: DEMO_FACILITY_ID,
            quantityOnHand: qty,
            aisleShelfLocation: null,
          }),
        );
      }

      await productRepo.save(products, { chunk: 200 });
      await lotRepo.save(lots, { chunk: 200 });
      await stockRepo.save(stocks, { chunk: 200 });
    });

    return { imported: items.length, totalQty };
  }

  async stats(): Promise<{ products: number; lots: number; qty: number }> {
    const ds = getDataSource();
    const rows = (await ds.query(`
      SELECT
        (SELECT COUNT(*)::int FROM products WHERE sku LIKE 'CNP-%') AS products,
        (SELECT COUNT(*)::int FROM product_lots WHERE "lotBarcode" LIKE 'LOT-CNP-%') AS lots,
        (SELECT COALESCE(SUM(s."quantityOnHand"),0)::int
           FROM lot_inventory_stock s
           JOIN product_lots l ON l.id = s."lotId"
          WHERE l."lotBarcode" LIKE 'LOT-CNP-%') AS qty
    `)) as Array<{ products: number; lots: number; qty: number }>;
    return rows[0] ?? { products: 0, lots: 0, qty: 0 };
  }
}

export const stockImportService = new StockImportService();
