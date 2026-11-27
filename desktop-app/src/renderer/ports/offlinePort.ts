import type { DataPort } from '@mart/app';
import { EMPTY_PENDING, type SyncStatusSnapshot } from '@mart/app';

function api(): NonNullable<Window['posApi']> {
  if (!window.posApi) throw new Error('posApi is not available');
  return window.posApi;
}

export function createOfflinePort(): DataPort {
  return {
    mode: 'offline',

    async getSessionInfo() {
      const session = await api().getSession();
      if (!session) return null;
      return {
        displayName: session.user.displayName,
        facilityName: session.facility.name,
        role: session.user.role,
      };
    },

    async getSyncStatus(): Promise<SyncStatusSnapshot> {
      // Local only — never wait on API for status reads
      const [pending, meta] = await Promise.all([
        api().getPendingSyncCounts(),
        api().getSyncMeta(),
      ]);
      return {
        online: Boolean(meta.lastApiContactAt),
        timestamp: new Date().toISOString(),
        lastApiContactAt: meta.lastApiContactAt,
        lastSyncAt: meta.lastSyncAt,
        pending,
        lastSynced: EMPTY_PENDING,
        errors: [],
        syncing: false,
      };
    },

    subscribeSyncStatus(callback) {
      return api().onSyncStatus((event) => {
        callback({
          online: event.online,
          timestamp: event.timestamp,
          lastApiContactAt: event.lastApiContactAt,
          lastSyncAt: event.lastSyncAt,
          pending: event.pending ?? EMPTY_PENDING,
          lastSynced: event.lastSynced ?? EMPTY_PENDING,
          errors: event.errors,
          syncing: event.syncing,
        });
      });
    },

    async requestManualSync() {
      return api().requestManualSync();
    },

    async getDashboard() {
      const [inventory, customers, sales, summary] = await Promise.all([
        api().listInventory('', { inStockOnly: false }),
        api().listAllCustomers(),
        api().listInvoices(500),
        api().getSalesReportSummary(),
      ]);
      return {
        totalProducts: new Set(inventory.map((i) => i.productId)).size,
        totalCustomers: customers.length,
        totalSales: summary.salesTotal,
        lowStockCount: inventory.filter((i) => i.quantityOnHand > 0 && i.quantityOnHand < 5).length,
        invoiceCount: sales.length,
      };
    },

    async getExpiry() {
      const rows = await api().listInventory('', { inStockOnly: true });
      const now = Date.now();
      const alerts = rows
        .map((row) => {
          const expiry = new Date(row.expiryDate).getTime();
          const daysUntilExpiry = Math.ceil((expiry - now) / (24 * 3600 * 1000));
          return {
            lotId: row.id,
            productName: row.productName,
            batchNumber: row.batchNumber,
            expiryDate: row.expiryDate,
            daysUntilExpiry,
            quantityOnHand: row.quantityOnHand,
            priority: daysUntilExpiry <= 7 ? 'CRITICAL' : daysUntilExpiry <= 30 ? 'WARNING' : 'NORMAL',
            recommendedAction: daysUntilExpiry <= 7 ? 'Clearance / dump' : 'Promote',
          };
        })
        .filter((a) => a.daysUntilExpiry <= 60);
      return {
        criticalAlerts: alerts.filter((a) => a.priority === 'CRITICAL'),
        warningAlerts: alerts.filter((a) => a.priority === 'WARNING'),
        totalLotsScanned: rows.length,
        generatedAt: new Date().toISOString(),
      };
    },

    async listCustomers(query) {
      const rows = await api().listAllCustomers(query);
      return rows.map((r) => ({
        ...r,
        isSynced: r.isSynced ?? 1,
      }));
    },

    async saveCustomer(input) {
      const row = await api().upsertCustomer(input);
      return { ...row, isSynced: row.isSynced ?? 0 };
    },

    async listSuppliers() {
      return api().listSuppliers();
    },

    async saveSupplier(input) {
      return api().upsertSupplier(input);
    },

    async listProducts(query) {
      const rows = await api().listInventory(query ?? '', { inStockOnly: false });
      const byProduct = new Map<string, (typeof rows)[number]>();
      for (const row of rows) {
        if (!byProduct.has(row.productId)) byProduct.set(row.productId, row);
      }
      return [...byProduct.values()].map((r) => ({
        id: r.productId,
        name: r.productName,
        sku: r.productSku,
        baseBarcode: r.baseBarcode,
        brand: r.company || null,
        category: null,
        hsnCode: r.hsnCode || null,
      }));
    },

    async saveProduct() {
      throw new Error('Create products on Admin (online) or via purchase inbound lots on POS');
    },

    async listStock(query) {
      const rows = await api().listInventory(query ?? '', { inStockOnly: false });
      return rows.map((r) => ({
        lotId: r.id,
        productId: r.productId,
        productName: r.productName,
        sku: r.productSku,
        batchNumber: r.batchNumber,
        mrp: r.mrp,
        costPrice: r.costPrice,
        quantityOnHand: r.quantityOnHand,
        lotBarcode: r.lotBarcode,
        facilityId: r.facilityId,
        expiryDate: r.expiryDate,
        aisleShelfLocation: r.aisleShelfLocation,
      }));
    },

    async dumpStock(input) {
      await api().dumpStock(input);
    },

    async correctStock(input) {
      await api().correctStock(input);
    },

    async listPurchases() {
      const rows = await api().listPurchases();
      return rows.map((r) => ({
        id: String(r.id),
        facilityId: String(r.facility_id ?? r.facilityId ?? ''),
        supplierId: String(r.supplier_id ?? r.supplierId ?? ''),
        invoiceNumber: (r.invoice_number as string | null) ?? (r.invoiceNumber as string | null) ?? null,
        invoiceDate: String(r.invoice_date ?? r.invoiceDate ?? ''),
        grandTotal: Number(r.grand_total ?? r.grandTotal ?? 0),
        status: String(r.status ?? 'COMPLETED'),
        isSynced: Number(r.is_synced ?? r.isSynced ?? 0),
      }));
    },

    async createPurchase(input) {
      const row = await api().createPurchase(input);
      return {
        id: String(row.id),
        facilityId: String(row.facilityId ?? ''),
        supplierId: String(row.supplierId ?? input.supplierId),
        invoiceNumber: (row.invoiceNumber as string | null) ?? null,
        invoiceDate: String(row.invoiceDate ?? input.invoiceDate),
        grandTotal: Number(row.grandTotal ?? 0),
        status: String(row.status ?? 'COMPLETED'),
        isSynced: Number(row.isSynced ?? 0),
      };
    },

    async listSales(limit = 100) {
      const rows = await api().listInvoices(limit);
      return rows.map((r) => ({
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        finalPayable: r.finalPayable,
        paymentChannel: r.paymentChannel,
        createdAt: r.createdAt,
        isSynced: r.isSynced,
        customerName: r.customerPayload?.name,
      }));
    },

    async getReports() {
      const summary = await api().getSalesReportSummary();
      return { ...summary };
    },
  };
}
