import { createHash } from 'crypto';
import { v5 as uuidv5 } from 'uuid';
import { getDataSource } from '../database/data-source';
import { logInfo } from '../logging/logger';
import {
  OrderInvoice,
  OrderItem,
  Product,
  ProductLot,
  LotInventoryStock,
  OrderOriginSource,
  PaymentChannel,
} from '../../models';
import {
  DEMO_CASHIER_ID,
  DEMO_FACILITY_ID,
  DEMO_TENANT_ID,
  stockImportService,
} from './stock-import.service';

// Same namespaces as stock / Python import scripts (RFC-compliant for uuid@9).
const PRODUCT_NS = '00000000-0000-4000-8000-00000000c001';
const LOT_NS = '00000000-0000-4000-8000-00000000c002';
const STOCK_NS = '00000000-0000-4000-8000-00000000c003';
const ORDER_NS = '00000000-0000-4000-8000-00000000c010';
const ORDER_ITEM_NS = '00000000-0000-4000-8000-00000000c011';

export interface HistoricalSaleLine {
  /** Legacy POS line id when available (used for stable UUID). */
  externalLineId?: string | number | null;
  itemName: string;
  barcode?: string | null;
  quantity: number;
  unitPrice: number;
  mrp?: number;
  netAmount?: number;
}

export interface HistoricalSaleInvoice {
  invoiceNumber: string;
  /** ISO date or datetime */
  billDate: string;
  customerName?: string | null;
  customerMobile?: string | null;
  lines: HistoricalSaleLine[];
}

export interface HistoricalSalesImportResult {
  importedInvoices: number;
  importedLines: number;
  skippedExisting: number;
  replaced: number;
  stubsCreated: number;
  matchedBarcode: number;
  matchedName: number;
  netTotal: number;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanBarcode(value: unknown): string {
  if (value == null) return '';
  let text = String(value).trim();
  if (text.endsWith('.0') && /^\d+\.0$/.test(text)) text = text.slice(0, -2);
  return text;
}

function normName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function stableHistKey(barcode: string, name: string): string {
  const raw = barcode || normName(name);
  return createHash('sha1').update(raw).digest('hex').slice(0, 12);
}

function parseBillDate(value: string): Date {
  const text = String(value || '').trim();
  const d = new Date(text.includes('T') ? text : `${text.slice(0, 10)}T06:30:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return new Date();
  }
  return d;
}

type CatalogEntry = { productId: string; lotId: string; name: string; barcode: string };

export class SalesImportService {
  assertImportSecret(headerValue: string | undefined): void {
    stockImportService.assertImportSecret(headerValue);
  }

  async salesStats(): Promise<{ invoices: number; lines: number; netTotal: number }> {
    const ds = getDataSource();
    const rows = (await ds.query(
      `
      SELECT
        COUNT(*)::int AS invoices,
        COALESCE((
          SELECT COUNT(*)::int FROM order_items oi
          JOIN order_invoices o ON o.id = oi."orderId"
          WHERE o."tenantId" = $1
        ), 0) AS lines,
        COALESCE(SUM(o."finalPayable"), 0)::float AS "netTotal"
      FROM order_invoices o
      WHERE o."tenantId" = $1
      `,
      [DEMO_TENANT_ID],
    )) as Array<{ invoices: number; lines: number; netTotal: number }>;
    return rows[0] ?? { invoices: 0, lines: 0, netTotal: 0 };
  }

  private async loadCatalog(): Promise<{
    byBarcode: Map<string, CatalogEntry>;
    byName: Map<string, CatalogEntry>;
  }> {
    const ds = getDataSource();
    const rows = (await ds.query(
      `
      SELECT
        p.id::text AS "productId",
        p."baseBarcode" AS barcode,
        p.name AS name,
        (
          SELECT l.id::text FROM product_lots l
          WHERE l."productId" = p.id AND l."isActive" = true
          ORDER BY
            CASE WHEN l."lotBarcode" LIKE 'LOT-CNP-%' THEN 0 ELSE 1 END,
            l."createdAt" ASC
          LIMIT 1
        ) AS "lotId"
      FROM products p
      WHERE p."tenantId" = $1 AND p."isActive" = true
      `,
      [DEMO_TENANT_ID],
    )) as Array<{ productId: string; barcode: string; name: string; lotId: string | null }>;

    const byBarcode = new Map<string, CatalogEntry>();
    const byName = new Map<string, CatalogEntry>();
    for (const row of rows) {
      if (!row.lotId) continue;
      const entry: CatalogEntry = {
        productId: row.productId,
        lotId: row.lotId,
        name: row.name,
        barcode: row.barcode,
      };
      const bc = cleanBarcode(row.barcode);
      if (bc && !byBarcode.has(bc)) byBarcode.set(bc, entry);
      const nk = normName(row.name);
      if (nk && !byName.has(nk)) byName.set(nk, entry);
    }
    return { byBarcode, byName };
  }

  async importBatch(
    invoices: HistoricalSaleInvoice[],
    options: { replaceExisting?: boolean } = {},
  ): Promise<HistoricalSalesImportResult> {
    const replaceExisting = options.replaceExisting !== false;
    const result: HistoricalSalesImportResult = {
      importedInvoices: 0,
      importedLines: 0,
      skippedExisting: 0,
      replaced: 0,
      stubsCreated: 0,
      matchedBarcode: 0,
      matchedName: 0,
      netTotal: 0,
    };

    if (!invoices.length) return result;

    const { byBarcode, byName } = await this.loadCatalog();
    const ds = getDataSource();

    await ds.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const lotRepo = manager.getRepository(ProductLot);
      const stockRepo = manager.getRepository(LotInventoryStock);
      const orderRepo = manager.getRepository(OrderInvoice);
      const itemRepo = manager.getRepository(OrderItem);

      const stubCache = new Map<string, CatalogEntry>();

      const ensureStub = async (barcode: string, name: string, mrp: number, saleRate: number): Promise<CatalogEntry> => {
        const hist = stableHistKey(barcode, name);
        const sku = `CNP-HIST-${hist}`;
        if (stubCache.has(sku)) return stubCache.get(sku)!;

        const productId = uuidv5(sku, PRODUCT_NS);
        const lotId = uuidv5(sku, LOT_NS);
        const stockId = uuidv5(sku, STOCK_NS);
        const baseBarcode = (barcode && barcode.length <= 32 ? barcode : `HIST-${hist}`).slice(0, 32);

        let product = await productRepo.findOne({ where: { id: productId } });
        if (!product) {
          const now = new Date();
          const expiry = new Date(now);
          expiry.setDate(expiry.getDate() + 730);
          product = productRepo.create({
            id: productId,
            tenantId: DEMO_TENANT_ID,
            sku,
            baseBarcode,
            name: (name || sku).slice(0, 512),
            description: `Historical sale stub; barcode=${barcode || '-'}`,
            mrp,
            saleRate: saleRate || mrp,
            purchaseRate: 0,
            unit: 'PCS',
            gstPercent: 0,
            isActive: true,
            showOnEcommerce: false,
          });
          await productRepo.save(product);
          await lotRepo.save(
            lotRepo.create({
              id: lotId,
              productId,
              batchNumber: `HIST-${hist}`,
              costPrice: 0,
              mrp,
              manufactureDate: now,
              expiryDate: expiry,
              lotBarcode: `LOT-HIST-${hist}`.slice(0, 64),
              isActive: true,
            }),
          );
          await stockRepo.save(
            stockRepo.create({
              id: stockId,
              lotId,
              facilityId: DEMO_FACILITY_ID,
              quantityOnHand: 0,
              aisleShelfLocation: null,
            }),
          );
          result.stubsCreated += 1;
        }

        const entry: CatalogEntry = { productId, lotId, name, barcode: baseBarcode };
        stubCache.set(sku, entry);
        if (baseBarcode) byBarcode.set(baseBarcode, entry);
        byName.set(normName(name), entry);
        return entry;
      };

      for (const inv of invoices) {
        const invoiceNumber = String(inv.invoiceNumber || '').trim().slice(0, 32);
        if (!invoiceNumber || !inv.lines?.length) continue;

        const existing = await orderRepo.findOne({
          where: { tenantId: DEMO_TENANT_ID, invoiceNumber },
        });
        if (existing) {
          if (!replaceExisting) {
            result.skippedExisting += 1;
            continue;
          }
          await itemRepo.delete({ orderId: existing.id });
          await orderRepo.delete({ id: existing.id });
          result.replaced += 1;
        }

        const createdAt = parseBillDate(inv.billDate);
        const orderId = uuidv5(`${DEMO_TENANT_ID}|${invoiceNumber}`, ORDER_NS);
        const customerName = (inv.customerName || 'Walk-in').toString().slice(0, 128);
        const customerMobile = cleanBarcode(inv.customerMobile).slice(0, 20);

        const orderItems: OrderItem[] = [];
        let subtotal = 0;

        for (const line of inv.lines) {
          const qty = Math.max(0, Math.round(num(line.quantity)));
          if (qty <= 0) continue;
          const name = String(line.itemName || '').trim().slice(0, 512);
          const barcode = cleanBarcode(line.barcode);
          const unitPrice = Math.round(num(line.unitPrice) * 100) / 100;
          const mrp = Math.round(num(line.mrp, unitPrice) * 100) / 100;
          const netAmount =
            line.netAmount != null
              ? Math.round(num(line.netAmount) * 100) / 100
              : Math.round(unitPrice * qty * 100) / 100;

          let match: CatalogEntry | undefined;
          if (barcode && byBarcode.has(barcode)) {
            match = byBarcode.get(barcode);
            result.matchedBarcode += 1;
          } else if (name && byName.has(normName(name))) {
            match = byName.get(normName(name));
            result.matchedName += 1;
          } else {
            match = await ensureStub(barcode, name, mrp, unitPrice);
          }

          const lineKey = `${invoiceNumber}|${line.externalLineId ?? ''}|${name}|${qty}|${netAmount}`;
          const itemId = uuidv5(lineKey, ORDER_ITEM_NS);
          orderItems.push(
            itemRepo.create({
              id: itemId,
              orderId,
              productId: match!.productId,
              lotId: match!.lotId,
              quantity: qty,
              unitPrice,
              barcode: barcode || null,
              batchNumber: null,
              mrp,
              discountPercent: 0,
              discountAmount: 0,
              calculatedTax: 0,
              netAmount,
              createdAt,
            }),
          );
          subtotal += netAmount;
        }

        if (!orderItems.length) continue;

        subtotal = Math.round(subtotal * 100) / 100;
        await orderRepo.save(
          orderRepo.create({
            id: orderId,
            tenantId: DEMO_TENANT_ID,
            facilityId: DEMO_FACILITY_ID,
            cashierId: DEMO_CASHIER_ID,
            cashierName: 'CNP MART',
            customerPayload: { name: customerName, phone: customerMobile },
            customerMobile: customerMobile || null,
            invoiceNumber,
            saleType: 'CASH_SALE',
            status: 'COMPLETED',
            subtotal,
            taxTotal: 0,
            discountTotal: 0,
            taxableValue: subtotal,
            redeemAmount: 0,
            grossSale: subtotal,
            roundOff: 0,
            billDiscountPercent: 0,
            amountTendered: subtotal,
            changeDue: 0,
            finalPayable: subtotal,
            paymentChannel: PaymentChannel.CASH,
            originSource: OrderOriginSource.OFFLINE_POS,
            isSynced: true,
            createdAt,
            updatedAt: createdAt,
          }),
        );
        await itemRepo.save(orderItems, { chunk: 200 });

        result.importedInvoices += 1;
        result.importedLines += orderItems.length;
        result.netTotal += subtotal;
      }
    });

    result.netTotal = Math.round(result.netTotal * 100) / 100;
    logInfo('SalesImportService.importBatch', 'Historical sales imported', result as unknown as Record<string, unknown>);
    return result;
  }
}

export const salesImportService = new SalesImportService();
