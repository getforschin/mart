import type { DataPort } from '../DataPort';
import { EMPTY_PENDING, type SyncStatusSnapshot } from '../types';

export interface OnlinePortOptions {
  apiBaseUrl: string;
  tenantId: string;
  getToken: () => string;
  facilityId?: string;
  session?: { displayName: string; facilityName: string; role?: string } | null;
}

async function api<T>(
  opts: OnlinePortOptions,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const tenantId = opts.tenantId;
  const joiner = path.includes('?') ? '&' : '?';
  const url = `${opts.apiBaseUrl}${path}${joiner}tenantId=${tenantId}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
      Authorization: `Bearer ${opts.getToken()}`,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error((await response.text()) || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function createOnlinePort(opts: OnlinePortOptions): DataPort {
  const facilityId = opts.facilityId ?? '00000000-0000-0000-0000-000000000002';

  return {
    mode: 'online',

    async getSessionInfo() {
      return opts.session ?? { displayName: 'Admin', facilityName: 'Central', role: 'MART_ADMIN' };
    },

    async getSyncStatus(): Promise<SyncStatusSnapshot> {
      try {
        await fetch(`${opts.apiBaseUrl}/api/v1/health`, { signal: AbortSignal.timeout(5000) });
        const now = new Date().toISOString();
        return {
          online: true,
          timestamp: now,
          lastApiContactAt: now,
          lastSyncAt: now,
          pending: EMPTY_PENDING,
          lastSynced: EMPTY_PENDING,
          errors: [],
        };
      } catch {
        return {
          online: false,
          timestamp: new Date().toISOString(),
          lastApiContactAt: null,
          lastSyncAt: null,
          pending: EMPTY_PENDING,
          lastSynced: EMPTY_PENDING,
          errors: ['API unreachable'],
        };
      }
    },

    async getDashboard() {
      return api(opts, '/api/v1/dashboard');
    },

    async getExpiry() {
      return api(opts, `/api/v1/analytics/expiry/${opts.tenantId}`);
    },

    async listCustomers(query?: string) {
      const rows = await api<Array<Record<string, unknown>>>(opts, '/api/v1/parties/customers');
      const filtered = query
        ? rows.filter((r) =>
            String(r.name ?? '')
              .toLowerCase()
              .includes(query.toLowerCase()) ||
            String(r.mobile ?? '').includes(query),
          )
        : rows;
      return filtered.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        mobile: String(r.mobile),
        email: (r.email as string | null) ?? null,
        previousDue: Number(r.outstandingDue ?? 0),
        membershipCard: (r.membershipCard as string | null) ?? null,
        loyaltyPoints: 0,
        isSynced: 1,
      }));
    },

    async saveCustomer(input) {
      const row = await api<Record<string, unknown>>(opts, '/api/v1/parties/customers', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return {
        id: String(row.id),
        name: String(row.name),
        mobile: String(row.mobile),
        email: (row.email as string | null) ?? null,
        previousDue: Number(row.outstandingDue ?? 0),
        membershipCard: (row.membershipCard as string | null) ?? null,
        loyaltyPoints: 0,
        isSynced: 1,
      };
    },

    async listSuppliers() {
      const rows = await api<Array<Record<string, unknown>>>(opts, '/api/v1/parties/suppliers');
      return rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        mobile: (r.mobile as string | null) ?? null,
        email: (r.email as string | null) ?? null,
        gstin: (r.gstin as string | null) ?? null,
        outstandingDue: Number(r.outstandingDue ?? 0),
      }));
    },

    async saveSupplier(input) {
      const row = await api<Record<string, unknown>>(opts, '/api/v1/parties/suppliers', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return {
        id: String(row.id),
        name: String(row.name),
        mobile: (row.mobile as string | null) ?? null,
        email: (row.email as string | null) ?? null,
        gstin: (row.gstin as string | null) ?? null,
        outstandingDue: Number(row.outstandingDue ?? 0),
      };
    },

    async paySupplier(input) {
      const row = await api<{ supplier: { outstandingDue: number } }>(
        opts,
        `/api/v1/parties/suppliers/${input.supplierId}/payments`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return { outstandingDue: Number(row.supplier?.outstandingDue ?? 0) };
    },

    async getSupplierLedger(supplierId) {
      return api(opts, `/api/v1/parties/suppliers/${supplierId}/ledger`);
    },

    async listExpenses(from, to) {
      const q = [
        from ? `from=${encodeURIComponent(from)}` : '',
        to ? `to=${encodeURIComponent(to)}` : '',
      ]
        .filter(Boolean)
        .join('&');
      const rows = await api<Array<Record<string, unknown>>>(
        opts,
        `/api/v1/expenses${q ? `?${q}` : ''}`,
      );
      return rows.map((r) => ({
        id: String(r.id),
        expenseDate: String(r.expenseDate),
        amount: Number(r.amount),
        purpose: String(r.purpose),
        category: String(r.category ?? 'MISC'),
        paymentMode: (r.paymentMode as string | null) ?? null,
        payee: (r.payee as string | null) ?? null,
        notes: (r.notes as string | null) ?? null,
        isRecurringGenerated: Boolean(r.isRecurringGenerated),
      }));
    },

    async createExpense(input) {
      const row = await api<Record<string, unknown>>(opts, '/api/v1/expenses', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return {
        id: String(row.id),
        expenseDate: String(row.expenseDate ?? input.expenseDate),
        amount: Number(row.amount ?? input.amount),
        purpose: String(row.purpose ?? input.purpose),
        category: String(row.category ?? input.category ?? 'MISC'),
        paymentMode: (row.paymentMode as string | null) ?? null,
        payee: (row.payee as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
      };
    },

    async listExpenseSchedules() {
      const rows = await api<Array<Record<string, unknown>>>(opts, '/api/v1/expenses/schedules');
      return rows.map((r) => ({
        id: String(r.id),
        purpose: String(r.purpose),
        category: String(r.category ?? 'MISC'),
        amount: Number(r.amount),
        dayOfMonth: Number(r.dayOfMonth),
        paymentMode: (r.paymentMode as string | null) ?? null,
        payee: (r.payee as string | null) ?? null,
        notes: (r.notes as string | null) ?? null,
        isActive: Boolean(r.isActive),
      }));
    },

    async upsertExpenseSchedule(input) {
      const row = await api<Record<string, unknown>>(opts, '/api/v1/expenses/schedules', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return {
        id: String(row.id),
        purpose: String(row.purpose ?? input.purpose),
        category: String(row.category ?? input.category ?? 'MISC'),
        amount: Number(row.amount ?? input.amount),
        dayOfMonth: Number(row.dayOfMonth ?? input.dayOfMonth),
        paymentMode: (row.paymentMode as string | null) ?? null,
        payee: (row.payee as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
        isActive: Boolean(row.isActive ?? true),
      };
    },

    async runExpenseSchedules(asOf) {
      const q = asOf ? `?asOf=${encodeURIComponent(asOf)}` : '';
      const row = await api<{ posted: Array<Record<string, unknown>> }>(
        opts,
        `/api/v1/expenses/run-schedules${q}`,
        {
          method: 'POST',
          body: '{}',
        },
      );
      return {
        posted: (row.posted ?? []).map((e) => ({
          id: String(e.id),
          expenseDate: String(e.expenseDate ?? ''),
          amount: Number(e.amount ?? 0),
          purpose: String(e.purpose ?? ''),
          category: String(e.category ?? 'MISC'),
          paymentMode: (e.paymentMode as string | null) ?? null,
          payee: (e.payee as string | null) ?? null,
          notes: (e.notes as string | null) ?? null,
          isRecurringGenerated: Boolean(e.isRecurringGenerated),
        })),
      };
    },

    async getProfitLoss(from, to) {
      return api(
        opts,
        `/api/v1/expenses/profit-loss?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
    },

    async listProducts(query?: string) {
      const rows = await api<Array<Record<string, unknown>>>(opts, '/api/v1/catalog/products');
      const filtered = query
        ? rows.filter((r) =>
            String(r.name ?? '')
              .toLowerCase()
              .includes(query.toLowerCase()) ||
            String(r.sku ?? '')
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
        : rows;
      return filtered.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        sku: String(r.sku),
        baseBarcode: String(r.baseBarcode),
        brand: (r.brand as string | null) ?? null,
        category: (r.category as string | null) ?? null,
        hsnCode: (r.hsnCode as string | null) ?? null,
      }));
    },

    async saveProduct(input) {
      const row = await api<Record<string, unknown>>(opts, '/api/v1/catalog/products', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return {
        id: String(row.id),
        name: String(row.name),
        sku: String(row.sku),
        baseBarcode: String(row.baseBarcode),
        brand: (row.brand as string | null) ?? null,
        category: (row.category as string | null) ?? null,
        hsnCode: (row.hsnCode as string | null) ?? null,
      };
    },

    async listStock(query?: string) {
      const rows = await api<Array<Record<string, unknown>>>(
        opts,
        `/api/v1/stock?facilityId=${facilityId}`,
      );
      const mapped = rows.map((r) => ({
        lotId: String(r.lotId),
        productId: String(r.productId),
        productName: String(r.productName),
        sku: String(r.sku ?? ''),
        batchNumber: String(r.batchNumber ?? ''),
        mrp: Number(r.mrp ?? 0),
        costPrice: Number(r.costPrice ?? 0),
        quantityOnHand: Number(r.quantityOnHand ?? 0),
        lotBarcode: String(r.lotBarcode ?? ''),
        facilityId: String(r.facilityId),
        expiryDate: String(r.expiryDate ?? ''),
        aisleShelfLocation: (r.aisleShelfLocation as string | null) ?? null,
      }));
      if (!query) return mapped;
      const q = query.toLowerCase();
      return mapped.filter(
        (r) =>
          r.productName.toLowerCase().includes(q) ||
          r.lotBarcode.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q),
      );
    },

    async dumpStock(input) {
      await api(opts, '/api/v1/stock/dump', {
        method: 'POST',
        body: JSON.stringify({ ...input, facilityId }),
      });
    },

    async correctStock(input) {
      await api(opts, '/api/v1/stock/correct', {
        method: 'POST',
        body: JSON.stringify({ ...input, facilityId }),
      });
    },

    async startStocktake(remark) {
      const startedBy = '00000000-0000-0000-0000-000000000003';
      return api(opts, '/api/v1/stock/stocktakes', {
        method: 'POST',
        body: JSON.stringify({ facilityId, startedBy, remark }),
      });
    },
    async listStocktakes() {
      return api(opts, `/api/v1/stock/stocktakes?facilityId=${encodeURIComponent(facilityId)}`);
    },
    async getStocktake(sessionId) {
      return api(opts, `/api/v1/stock/stocktakes/${sessionId}`);
    },
    async updateStocktakeCount(input) {
      return api(opts, '/api/v1/stock/stocktakes/count', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    async commitStocktake(sessionId) {
      return api(opts, `/api/v1/stock/stocktakes/${sessionId}/commit`, { method: 'POST', body: '{}' });
    },
    async cancelStocktake(sessionId) {
      return api(opts, `/api/v1/stock/stocktakes/${sessionId}/cancel`, { method: 'POST', body: '{}' });
    },

    async listPurchases() {
      const rows = await api<Array<Record<string, unknown>>>(opts, '/api/v1/purchases');
      return rows.map((r) => ({
        id: String(r.id),
        facilityId: String(r.facilityId),
        supplierId: String(r.supplierId),
        invoiceNumber: (r.invoiceNumber as string | null) ?? null,
        invoiceDate: String(r.invoiceDate),
        grandTotal: Number(r.grandTotal ?? 0),
        status: String(r.status ?? ''),
        isSynced: 1,
      }));
    },

    async createPurchase(input) {
      const row = await api<Record<string, unknown>>(opts, '/api/v1/purchases', {
        method: 'POST',
        body: JSON.stringify({ ...input, facilityId, status: 'COMPLETED' }),
      });
      return {
        id: String(row.id),
        facilityId: String(row.facilityId ?? facilityId),
        supplierId: String(row.supplierId ?? input.supplierId),
        invoiceNumber: (row.invoiceNumber as string | null) ?? null,
        invoiceDate: String(row.invoiceDate ?? input.invoiceDate),
        grandTotal: Number(row.grandTotal ?? 0),
        paidAmount: Number(row.paidAmount ?? input.paidAmount ?? 0),
        dueAmount: Number(row.dueAmount ?? 0),
        paymentStatus: String(row.paymentStatus ?? ''),
        status: String(row.status ?? 'COMPLETED'),
        isSynced: 1,
      };
    },

    async listSales(limit = 3000) {
      const rows = await api<Array<Record<string, unknown>>>(
        opts,
        `/api/v1/sales?limit=${encodeURIComponent(String(limit))}`,
      );
      return rows.slice(0, limit).map((r) => {
        const payload = (r.customerPayload ?? {}) as Record<string, unknown>;
        return {
          id: String(r.id),
          invoiceNumber: r.invoiceNumber != null ? String(r.invoiceNumber) : undefined,
          finalPayable: Number(r.finalPayable ?? 0),
          paymentChannel: String(r.paymentChannel ?? ''),
          createdAt: String(r.createdAt ?? ''),
          isSynced: 1,
          customerName: payload.name ? String(payload.name) : undefined,
        };
      });
    },

    async createSale(input) {
      const subtotal = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const cashierId = '00000000-0000-0000-0000-000000000003';
      const paymentChannel =
        input.saleType === 'CREDIT_SALE' ? 'CREDIT' : input.paymentChannel;
      const row = await api<Record<string, unknown>>(opts, '/api/v1/sales', {
        method: 'POST',
        body: JSON.stringify({
          facilityId,
          cashierId,
          customerName: input.customerName ?? 'Walk-in',
          customerMobile: input.customerMobile,
          paymentChannel,
          originSource: 'WEB_STOREFRONT',
          discountTotal: input.discountTotal ?? 0,
          items: input.items.map((i) => ({
            productId: i.productId,
            lotId: i.lotId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        }),
      });
      return {
        id: String(row.id),
        invoiceNumber: row.invoiceNumber ? String(row.invoiceNumber) : undefined,
        finalPayable: Number(row.finalPayable ?? Math.max(0, subtotal - (input.discountTotal ?? 0))),
        paymentChannel: String(row.paymentChannel ?? paymentChannel),
        createdAt: String(row.createdAt ?? new Date().toISOString()),
        isSynced: 1,
        customerName: input.customerName,
      };
    },

    async resolveBarcode(barcode) {
      const encoded = encodeURIComponent(barcode.trim());
      const result = await api<Record<string, unknown>>(
        opts,
        `/api/v1/barcode/resolve/${encoded}?facilityId=${facilityId}`,
      );
      const mapLot = (lot: Record<string, unknown> | null | undefined) => {
        if (!lot) return null;
        return {
          id: String(lot.id),
          productId: String(lot.productId ?? result.productId),
          batchNumber: String(lot.batchNumber ?? ''),
          costPrice: Number(lot.costPrice ?? 0),
          mrp: Number(lot.mrp ?? 0),
          saleRate: Number(lot.mrp ?? 0),
          manufactureDate: String(lot.manufactureDate ?? ''),
          expiryDate: String(lot.expiryDate ?? ''),
          lotBarcode: String(lot.lotBarcode ?? ''),
          quantityOnHand: Number(lot.quantityOnHand ?? 0),
          aisleShelfLocation: (lot.aisleShelfLocation as string | null) ?? null,
        };
      };
      const candidates = Array.isArray(result.candidateLots)
        ? (result.candidateLots as Array<Record<string, unknown>>).map((l) => mapLot(l)!)
        : [];
      return {
        resolutionType: String(result.resolutionType) as
          | 'SINGLE_LOT'
          | 'MULTI_MRP_SELECTION'
          | 'COMPOSITE_LOT_DIRECT',
        productId: String(result.productId),
        productName: String(result.productName),
        productSku: String(result.productSku),
        suggestedLot: mapLot(result.suggestedLot as Record<string, unknown> | null),
        candidateLots: candidates,
        fifoRecommendation: mapLot(result.fifoRecommendation as Record<string, unknown> | null),
      };
    },

    async searchProductsForBilling(query) {
      const rows = await this.listStock(query);
      const byProduct = new Map<
        string,
        {
          productId: string;
          productName: string;
          productSku: string;
          baseBarcode: string;
          quantityOnHand: number;
          mrpMin: number;
          mrpMax: number;
          company?: string;
        }
      >();
      for (const row of rows) {
        if (row.quantityOnHand <= 0) continue;
        const existing = byProduct.get(row.productId);
        if (!existing) {
          byProduct.set(row.productId, {
            productId: row.productId,
            productName: row.productName,
            productSku: row.sku,
            baseBarcode: row.lotBarcode,
            quantityOnHand: row.quantityOnHand,
            mrpMin: row.mrp,
            mrpMax: row.mrp,
          });
        } else {
          existing.quantityOnHand += row.quantityOnHand;
          existing.mrpMin = Math.min(existing.mrpMin, row.mrp);
          existing.mrpMax = Math.max(existing.mrpMax, row.mrp);
        }
      }
      return [...byProduct.values()].slice(0, 40);
    },

    async getReports() {
      return api(opts, '/api/v1/reports');
    },
  };
}
