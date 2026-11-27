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
      return api().getDashboardSnapshot();
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

    async paySupplier(input) {
      return api().paySupplier(input);
    },

    async createExpense(input) {
      const row = await api().createExpense(input);
      return {
        id: String(row.id),
        expenseDate: String(row.expenseDate ?? input.expenseDate),
        amount: Number(row.amount ?? input.amount),
        purpose: String(row.purpose ?? input.purpose),
        category: String(row.category ?? input.category ?? 'MISC'),
        paymentMode: (row.paymentMode as string | null) ?? input.paymentMode ?? null,
        payee: (row.payee as string | null) ?? input.payee ?? null,
        notes: (row.notes as string | null) ?? input.notes ?? null,
      };
    },

    async listExpenses(from, to) {
      const rows = await api().listExpenses(from, to);
      return rows.map((r) => ({
        id: String(r.id),
        expenseDate: String(r.expense_date ?? r.expenseDate),
        amount: Number(r.amount),
        purpose: String(r.purpose),
        category: String(r.category ?? 'MISC'),
        paymentMode: r.payment_mode ? String(r.payment_mode) : (r.paymentMode as string | null) ?? null,
        payee: r.payee ? String(r.payee) : null,
        notes: r.notes ? String(r.notes) : null,
        isRecurringGenerated: Boolean(r.is_recurring_generated ?? r.isRecurringGenerated),
      }));
    },

    async listExpenseSchedules() {
      const rows = await api().listExpenseSchedules();
      return rows.map((r) => ({
        id: String(r.id),
        purpose: String(r.purpose),
        category: String(r.category ?? 'MISC'),
        amount: Number(r.amount),
        dayOfMonth: Number(r.day_of_month ?? r.dayOfMonth),
        paymentMode: r.payment_mode ? String(r.payment_mode) : null,
        payee: r.payee ? String(r.payee) : null,
        notes: r.notes ? String(r.notes) : null,
        isActive: Number(r.is_active ?? r.isActive ?? 1) === 1,
      }));
    },

    async upsertExpenseSchedule(input) {
      const row = await api().upsertExpenseSchedule(input);
      return {
        id: String(row.id),
        purpose: String(row.purpose ?? input.purpose),
        category: String(row.category ?? input.category ?? 'MISC'),
        amount: Number(row.amount ?? input.amount),
        dayOfMonth: Number(row.dayOfMonth ?? row.day_of_month ?? input.dayOfMonth),
        paymentMode: (row.paymentMode as string | null) ?? input.paymentMode ?? null,
        payee: (row.payee as string | null) ?? input.payee ?? null,
        notes: (row.notes as string | null) ?? input.notes ?? null,
        isActive: input.isActive !== false,
      };
    },

    async runExpenseSchedules(asOf) {
      return api().runExpenseSchedules(asOf);
    },

    async getProfitLoss(from, to) {
      return api().getProfitLoss(from, to);
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

    async startStocktake(remark) {
      return api().startStocktake(remark);
    },
    async listStocktakes() {
      return api().listStocktakeSessions();
    },
    async getStocktake(sessionId) {
      return api().getStocktakeSession(sessionId);
    },
    async updateStocktakeCount(input) {
      return api().updateStocktakeCount(input);
    },
    async commitStocktake(sessionId) {
      return api().commitStocktake(sessionId);
    },
    async cancelStocktake(sessionId) {
      return api().cancelStocktake(sessionId);
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
        paidAmount: Number(r.paid_amount ?? r.paidAmount ?? 0),
        dueAmount: Number(r.due_amount ?? r.dueAmount ?? 0),
        paymentStatus: String(r.payment_status ?? r.paymentStatus ?? ''),
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
        paidAmount: Number(row.paidAmount ?? input.paidAmount ?? 0),
        dueAmount: Number(row.dueAmount ?? 0),
        paymentStatus: String(row.paymentStatus ?? ''),
        status: String(row.status ?? 'COMPLETED'),
        isSynced: Number(row.isSynced ?? 0),
      };
    },

    async getReports() {
      const monthStart = new Date().toISOString().slice(0, 8) + '01';
      const today = new Date().toISOString().slice(0, 10);
      const pnl = await api().getProfitLoss(monthStart, today);
      return {
        summary: {
          saleTotal: pnl.income,
          purchaseTotal: pnl.costs,
          expenseTotal: pnl.expenses,
          profitEstimate: pnl.result,
          supplierDue: (await api().listSuppliers()).reduce((s, x) => s + Number(x.outstandingDue ?? 0), 0),
        },
        profitLoss: pnl,
      };
    },

    async listSales(limit = 3000) {
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
  };
}
