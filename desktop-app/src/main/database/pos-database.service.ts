import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './sqlite-manager';
import { AuthService } from './auth.service';
import { computeChangeDue, computeInvoiceTotals as computeTotals } from '../../shared/billing-math';
import {
  BarcodeResolutionResult,
  CartLineItem,
  CreateInvoicePayload,
  InventoryRow,
  InvoiceStatus,
  LocalAttendanceRecord,
  LocalOrderInvoice,
  LocalProductLot,
  LocalStocktakeSession,
  OrderOriginSource,
  PaymentChannel,
  PosConfig,
  PosCustomer,
  ProductSearchHit,
  SaleType,
  SalesReportSummary,
} from '../../shared/types';

const COMPOSITE_LOT_PREFIX = 'LOT-';
const EAN13_LENGTH = 13;

interface LotRow {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  base_barcode: string;
  company: string;
  size: string;
  color: string;
  hsn_code: string;
  batch_number: string;
  cost_price: number;
  mrp: number;
  sale_rate: number;
  manufacture_date: string;
  expiry_date: string;
  lot_barcode: string;
  quantity_on_hand: number;
  aisle_shelf_location: string | null;
  facility_id: string;
}

export class PosDatabaseService {
  private authService: AuthService | null = null;

  get auth(): AuthService {
    if (this.authService === null) {
      this.authService = new AuthService(getDatabase());
    }
    return this.authService;
  }

  getConfig(): PosConfig {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM pos_config').all() as Array<{
      key: string;
      value: string;
    }>;
    const configMap = Object.fromEntries(rows.map((row) => [row.key, row.value]));

    return {
      tenantId: configMap.tenantId,
      facilityId: configMap.facilityId,
      facilityName: configMap.facilityName ?? 'Main Store',
      cashierId: configMap.cashierId,
      deviceId: configMap.deviceId,
      apiBaseUrl: configMap.apiBaseUrl,
      taxRate: parseFloat(configMap.taxRate ?? '18'),
      shopName: configMap.shopName ?? 'Mart POS',
    };
  }

  lookupCustomerByMobile(mobile: string): PosCustomer | null {
    const normalized = mobile.trim();
    if (normalized.length < 10) return null;

    const row = getDatabase()
      .prepare('SELECT * FROM pos_customers WHERE mobile = @mobile')
      .get({ mobile: normalized }) as Record<string, unknown> | undefined;

    if (!row) return null;

    return this.mapCustomer(row);
  }

  upsertCustomer(input: { name: string; mobile: string; email?: string | null }): PosCustomer {
    const name = input.name.trim();
    const mobile = input.mobile.trim().replace(/\s+/g, '');
    if (!name) throw new Error('Customer name is required');
    if (!/^\d{10}$/.test(mobile)) throw new Error('Enter a valid 10-digit mobile number');

    const db = getDatabase();
    const existing = db
      .prepare('SELECT * FROM pos_customers WHERE mobile = @mobile')
      .get({ mobile }) as Record<string, unknown> | undefined;

    if (existing) {
      db.prepare(
        `UPDATE pos_customers
         SET name = @name, email = @email, is_synced = 0, updated_at = datetime('now')
         WHERE mobile = @mobile`,
      ).run({
        name,
        mobile,
        email: input.email?.trim() || null,
      });
      return this.mapCustomer(
        db.prepare('SELECT * FROM pos_customers WHERE mobile = @mobile').get({ mobile }) as Record<
          string,
          unknown
        >,
      );
    }

    const id = uuidv4();
    db.prepare(
      `INSERT INTO pos_customers (id, name, mobile, email, previous_due, membership_card, loyalty_points, is_synced, updated_at, created_at)
       VALUES (@id, @name, @mobile, @email, 0, NULL, 0, 0, datetime('now'), datetime('now'))`,
    ).run({
      id,
      name,
      mobile,
      email: input.email?.trim() || null,
    });

    return this.mapCustomer(
      db.prepare('SELECT * FROM pos_customers WHERE id = @id').get({ id }) as Record<string, unknown>,
    );
  }

  deleteDraftInvoice(invoiceId: string): void {
    const db = getDatabase();
    const row = db
      .prepare('SELECT id, status FROM order_invoices_local WHERE id = @id')
      .get({ id: invoiceId }) as { id: string; status: string } | undefined;

    if (!row) throw new Error('Draft not found');
    if (row.status !== InvoiceStatus.DRAFT) {
      throw new Error('Only draft invoices can be deleted');
    }

    const wipe = db.transaction(() => {
      db.prepare('DELETE FROM order_items_local WHERE order_id = @id').run({ id: invoiceId });
      db.prepare('DELETE FROM order_invoices_local WHERE id = @id AND status = \'DRAFT\'').run({
        id: invoiceId,
      });
    });
    wipe();
  }

  resolveBarcode(barcode: string): BarcodeResolutionResult {
    const normalized = barcode.trim();
    if (normalized.length === 0) throw new Error('Barcode cannot be empty');

    if (normalized.startsWith(COMPOSITE_LOT_PREFIX)) {
      return this.resolveCompositeLot(normalized);
    }
    if (this.isValidEan13(normalized)) {
      return this.resolveEan13(normalized);
    }
    return this.resolveEan13(normalized);
  }

  createInvoice(payload: CreateInvoicePayload): LocalOrderInvoice {
    if (payload.items.length === 0 && payload.status !== InvoiceStatus.DRAFT) {
      throw new Error('Invoice must contain at least one line item');
    }

    if (payload.draftId) {
      return this.saveDraftInvoice(payload.draftId, payload);
    }

    const session = this.auth.getSession();
    if (!session) {
      throw new Error('You must be logged in to create an invoice');
    }

    const config = this.getConfig();
    const db = getDatabase();
    const invoiceId = uuidv4();
    const createdAt = new Date().toISOString();
    const invoiceNumber = this.nextInvoiceNumber(config.facilityId);
    const totals = this.computeInvoiceTotals(payload);
    const amountTendered = payload.amountTendered ?? 0;
    const changeDue = computeChangeDue(totals.finalPayable, amountTendered);
    const customerPayload = this.buildCustomerPayload(payload);
    const paymentChannel =
      payload.saleType === SaleType.CREDIT_SALE ? PaymentChannel.CREDIT : payload.paymentChannel;

    const createTransaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO order_invoices_local (
          id, invoice_number, tenant_id, facility_id, cashier_id, cashier_name,
          sale_type, status, customer_payload, customer_mobile,
          subtotal, taxable_value, tax_total, discount_total, redeem_amount,
          gross_sale, round_off, final_payable, payment_channel, coupon_code,
          bill_discount_percent, amount_tendered, change_due, return_of_invoice_id,
          origin_source, is_synced, created_at
        ) VALUES (
          @id, @invoice_number, @tenant_id, @facility_id, @cashier_id, @cashier_name,
          @sale_type, @status, @customer_payload, @customer_mobile,
          @subtotal, @taxable_value, @tax_total, @discount_total, @redeem_amount,
          @gross_sale, @round_off, @final_payable, @payment_channel, @coupon_code,
          @bill_discount_percent, @amount_tendered, @change_due, @return_of_invoice_id,
          @origin_source, 0, @created_at
        )
      `).run({
        id: invoiceId,
        invoice_number: invoiceNumber,
        tenant_id: config.tenantId,
        facility_id: session.facility.id,
        cashier_id: session.user.id,
        cashier_name: session.user.displayName,
        sale_type: payload.saleType,
        status: payload.status,
        customer_payload: JSON.stringify(customerPayload),
        customer_mobile: payload.customerMobile,
        subtotal: totals.subtotal,
        taxable_value: totals.taxableValue,
        tax_total: totals.taxTotal,
        discount_total: totals.discountTotal,
        redeem_amount: 0,
        gross_sale: totals.grossSale,
        round_off: payload.roundOff,
        final_payable: totals.finalPayable,
        payment_channel: paymentChannel,
        coupon_code: null,
        bill_discount_percent: payload.billDiscountPercent ?? 0,
        amount_tendered: amountTendered,
        change_due: changeDue,
        return_of_invoice_id: payload.returnOfInvoiceId ?? null,
        origin_source: OrderOriginSource.OFFLINE_POS,
        created_at: createdAt,
      });

      this.replaceInvoiceItems(invoiceId, payload.items);

      if (payload.status === InvoiceStatus.COMPLETED) {
        this.applyCompletedInvoiceEffects(payload, totals.finalPayable, invoiceId);
      }
    });

    createTransaction();
    return this.getInvoiceById(invoiceId);
  }

  private saveDraftInvoice(draftId: string, payload: CreateInvoicePayload): LocalOrderInvoice {
    const session = this.auth.getSession();
    if (!session) {
      throw new Error('You must be logged in to update an invoice');
    }

    const existing = this.getInvoiceById(draftId);
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new Error('Only draft invoices can be edited');
    }

    const db = getDatabase();
    const totals = this.computeInvoiceTotals(payload);
    const amountTendered = payload.amountTendered ?? 0;
    const changeDue = computeChangeDue(totals.finalPayable, amountTendered);
    const customerPayload = this.buildCustomerPayload(payload);
    const paymentChannel =
      payload.saleType === SaleType.CREDIT_SALE ? PaymentChannel.CREDIT : payload.paymentChannel;

    const updateTransaction = db.transaction(() => {
      db.prepare(`
        UPDATE order_invoices_local SET
          sale_type = @sale_type,
          status = @status,
          customer_payload = @customer_payload,
          customer_mobile = @customer_mobile,
          subtotal = @subtotal,
          taxable_value = @taxable_value,
          tax_total = @tax_total,
          discount_total = @discount_total,
          redeem_amount = 0,
          gross_sale = @gross_sale,
          round_off = @round_off,
          final_payable = @final_payable,
          payment_channel = @payment_channel,
          coupon_code = NULL,
          bill_discount_percent = @bill_discount_percent,
          amount_tendered = @amount_tendered,
          change_due = @change_due,
          return_of_invoice_id = @return_of_invoice_id,
          cashier_id = @cashier_id,
          cashier_name = @cashier_name
        WHERE id = @id AND status = 'DRAFT'
      `).run({
        id: draftId,
        sale_type: payload.saleType,
        status: payload.status,
        customer_payload: JSON.stringify(customerPayload),
        customer_mobile: payload.customerMobile,
        subtotal: totals.subtotal,
        taxable_value: totals.taxableValue,
        tax_total: totals.taxTotal,
        discount_total: totals.discountTotal,
        gross_sale: totals.grossSale,
        round_off: payload.roundOff,
        final_payable: totals.finalPayable,
        payment_channel: paymentChannel,
        bill_discount_percent: payload.billDiscountPercent ?? 0,
        amount_tendered: amountTendered,
        change_due: changeDue,
        return_of_invoice_id: payload.returnOfInvoiceId ?? null,
        cashier_id: session.user.id,
        cashier_name: session.user.displayName,
      });

      this.replaceInvoiceItems(draftId, payload.items);

      if (payload.status === InvoiceStatus.COMPLETED) {
        this.applyCompletedInvoiceEffects(payload, totals.finalPayable, draftId);
      }
    });

    updateTransaction();
    return this.getInvoiceById(draftId);
  }

  private computeInvoiceTotals(payload: CreateInvoicePayload): {
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    taxableValue: number;
    grossSale: number;
    finalPayable: number;
  } {
    return computeTotals({
      items: payload.items,
      billDiscountPercent: payload.billDiscountPercent,
      billDiscountAmount: payload.billDiscountAmount,
      roundOff: payload.roundOff,
    });
  }

  private buildCustomerPayload(payload: CreateInvoicePayload): Record<string, string> {
    return payload.customer
      ? {
          name: payload.customer.name,
          phone: payload.customer.mobile,
          email: payload.customer.email ?? '',
          loyaltyId: '',
        }
      : { name: 'Walk-in Customer', phone: payload.customerMobile };
  }

  private replaceInvoiceItems(invoiceId: string, items: CartLineItem[]): void {
    const db = getDatabase();
    db.prepare('DELETE FROM order_items_local WHERE order_id = @order_id').run({
      order_id: invoiceId,
    });

    const insert = db.prepare(`
      INSERT INTO order_items_local (
        id, order_id, product_id, lot_id, barcode, company, size, color, hsn_code,
        batch_number, serial_number, price_type, box_qty, packet_qty, piece_qty,
        quantity, purchase_rate, mrp, unit_price, discount_percent, discount_amount,
        calculated_tax, net_amount
      ) VALUES (
        @id, @order_id, @product_id, @lot_id, @barcode, @company, @size, @color, @hsn_code,
        @batch_number, @serial_number, @price_type, @box_qty, @packet_qty, @piece_qty,
        @quantity, @purchase_rate, @mrp, @unit_price, @discount_percent, @discount_amount,
        @calculated_tax, @net_amount
      )
    `);

    for (const item of items) {
      insert.run({
        id: item.lineId || uuidv4(),
        order_id: invoiceId,
        product_id: item.productId,
        lot_id: item.lotId,
        barcode: item.barcode,
        company: item.company,
        size: item.size,
        color: item.color,
        hsn_code: item.hsnCode,
        batch_number: item.batchNumber,
        serial_number: item.serialNumber,
        price_type: item.priceType,
        box_qty: item.boxQty,
        packet_qty: item.packetQty,
        piece_qty: item.pieceQty,
        quantity: item.quantity,
        purchase_rate: item.purchaseRate,
        mrp: item.mrp,
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent,
        discount_amount: item.discountAmount,
        calculated_tax: 0,
        net_amount: item.netAmount,
      });
    }
  }

  private applyCompletedInvoiceEffects(
    payload: CreateInvoicePayload,
    finalPayable: number,
    invoiceId: string,
  ): void {
    const db = getDatabase();
    const config = this.getConfig();
    const isReturn = payload.saleType === SaleType.RETURN;

    const decrementStock = db.prepare(`
      UPDATE product_lots_local
      SET quantity_on_hand = quantity_on_hand - @delta, updated_at = datetime('now')
      WHERE id = @lot_id AND quantity_on_hand >= @delta
    `);
    const incrementStock = db.prepare(`
      UPDATE product_lots_local
      SET quantity_on_hand = quantity_on_hand + @delta, updated_at = datetime('now')
      WHERE id = @lot_id
    `);
    for (const item of payload.items) {
      if (isReturn) {
        const result = incrementStock.run({ lot_id: item.lotId, delta: item.quantity });
        if (result.changes === 0) {
          throw new Error(`Lot not found for return: ${item.productName}`);
        }
      } else {
        const result = decrementStock.run({ lot_id: item.lotId, delta: item.quantity });
        if (result.changes === 0) {
          throw new Error(`Insufficient stock for ${item.productName} (lot ${item.batchNumber})`);
        }
      }
    }

    if (isReturn && payload.returnOfInvoiceId) {
      db.prepare(
        `UPDATE order_invoices_local SET status = 'RETURNED' WHERE id = @id AND status = 'COMPLETED'`,
      ).run({ id: payload.returnOfInvoiceId });
    }

    if (payload.saleType === SaleType.CREDIT_SALE && payload.customer) {
      db.prepare(
        'UPDATE pos_customers SET previous_due = previous_due + @amount WHERE id = @id',
      ).run({ amount: finalPayable, id: payload.customer.id });
    }

    if (
      isReturn &&
      payload.customer &&
      payload.customer.id &&
      !payload.customer.id.startsWith('walkin-') &&
      !payload.customer.id.startsWith('draft-cust-')
    ) {
      db.prepare(
        `UPDATE pos_customers
         SET previous_due = CASE
           WHEN previous_due > @amount THEN previous_due - @amount
           ELSE 0
         END
         WHERE id = @id`,
      ).run({ amount: finalPayable, id: payload.customer.id });
    }

    void config;
    void invoiceId;
  }

  getUnsyncedInvoices(): LocalOrderInvoice[] {
    const rows = getDatabase()
      .prepare(
        `SELECT * FROM order_invoices_local WHERE is_synced = 0 AND status = 'COMPLETED' ORDER BY created_at ASC`,
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map((row) => this.hydrateInvoice(row));
  }

  getUnsyncedAttendance(): LocalAttendanceRecord[] {
    return getDatabase()
      .prepare('SELECT * FROM workforce_attendance_local WHERE is_synced = 0 ORDER BY clock_in ASC')
      .all()
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id),
          tenantId: String(r.tenant_id),
          userId: String(r.user_id),
          facilityId: String(r.facility_id),
          clockIn: String(r.clock_in),
          clockOut: r.clock_out ? String(r.clock_out) : null,
          biometricSignatureHash: String(r.biometric_signature_hash),
          isSynced: Number(r.is_synced),
        };
      });
  }

  markInvoicesSynced(invoiceIds: string[]): void {
    if (invoiceIds.length === 0) return;
    const placeholders = invoiceIds.map(() => '?').join(',');
    getDatabase()
      .prepare(`UPDATE order_invoices_local SET is_synced = 1 WHERE id IN (${placeholders})`)
      .run(...invoiceIds);
  }

  markAttendanceSynced(attendanceIds: string[]): void {
    if (attendanceIds.length === 0) return;
    const placeholders = attendanceIds.map(() => '?').join(',');
    getDatabase()
      .prepare(`UPDATE workforce_attendance_local SET is_synced = 1 WHERE id IN (${placeholders})`)
      .run(...attendanceIds);
  }

  markCustomersSynced(ids: string[]): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    getDatabase()
      .prepare(`UPDATE pos_customers SET is_synced = 1 WHERE id IN (${placeholders})`)
      .run(...ids);
  }

  markPurchasesSynced(ids: string[]): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    getDatabase()
      .prepare(`UPDATE purchases_local SET is_synced = 1 WHERE id IN (${placeholders})`)
      .run(...ids);
  }

  markSupplierPaymentsSynced(ids: string[]): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    getDatabase()
      .prepare(`UPDATE supplier_payments_local SET is_synced = 1 WHERE id IN (${placeholders})`)
      .run(...ids);
  }

  markExpensesSynced(ids: string[]): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    getDatabase()
      .prepare(`UPDATE expenses_local SET is_synced = 1 WHERE id IN (${placeholders})`)
      .run(...ids);
  }

  markStockEventsSynced(ids: string[]): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    getDatabase()
      .prepare(`UPDATE stock_events_local SET is_synced = 1 WHERE id IN (${placeholders})`)
      .run(...ids);
  }

  setConfigValue(key: string, value: string): void {
    getDatabase()
      .prepare(
        `INSERT INTO pos_config (key, value) VALUES (@key, @value)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run({ key, value });
  }

  getConfigValue(key: string): string | null {
    const row = getDatabase()
      .prepare('SELECT value FROM pos_config WHERE key = @key')
      .get({ key }) as { value: string } | undefined;
    return row?.value ?? null;
  }

  getPendingSyncCounts(): {
    bills: number;
    customers: number;
    purchases: number;
    stock: number;
    attendance: number;
  } {
    const db = getDatabase();
    const count = (sql: string): number =>
      Number((db.prepare(sql).get() as { c: number }).c ?? 0);
    return {
      bills: count(
        `SELECT COUNT(*) AS c FROM order_invoices_local WHERE is_synced = 0 AND status = 'COMPLETED'`,
      ),
      customers: count(
        `SELECT COUNT(*) AS c FROM pos_customers WHERE is_synced = 0 AND length(id) = 36 AND id LIKE '________-____-____-____-____________'`,
      ),
      purchases: count(`SELECT COUNT(*) AS c FROM purchases_local WHERE is_synced = 0`),
      stock: count(`SELECT COUNT(*) AS c FROM stock_events_local WHERE is_synced = 0`),
      attendance: count(`SELECT COUNT(*) AS c FROM workforce_attendance_local WHERE is_synced = 0`),
    };
  }

  getUnsyncedCustomers(): Array<Record<string, unknown>> {
    return getDatabase()
      .prepare(
        `SELECT * FROM pos_customers WHERE is_synced = 0 AND length(id) = 36 AND id LIKE '________-____-____-____-____________' ORDER BY updated_at ASC`,
      )
      .all() as Array<Record<string, unknown>>;
  }

  getUnsyncedPurchases(): Array<Record<string, unknown>> {
    const purchases = getDatabase()
      .prepare(`SELECT * FROM purchases_local WHERE is_synced = 0 ORDER BY created_at ASC`)
      .all() as Array<Record<string, unknown>>;
    return purchases.map((purchase) => {
      const items = getDatabase()
        .prepare(`SELECT * FROM purchase_items_local WHERE purchase_id = @id`)
        .all({ id: purchase.id }) as Array<Record<string, unknown>>;
      return { ...purchase, items };
    });
  }

  getUnsyncedSupplierPayments(): Array<Record<string, unknown>> {
    return getDatabase()
      .prepare(`SELECT * FROM supplier_payments_local WHERE is_synced = 0 ORDER BY created_at ASC`)
      .all() as Array<Record<string, unknown>>;
  }

  getUnsyncedExpenses(): Array<Record<string, unknown>> {
    return getDatabase()
      .prepare(`SELECT * FROM expenses_local WHERE is_synced = 0 ORDER BY created_at ASC`)
      .all() as Array<Record<string, unknown>>;
  }

  getUnsyncedStockEvents(): Array<Record<string, unknown>> {
    return getDatabase()
      .prepare(`SELECT * FROM stock_events_local WHERE is_synced = 0 ORDER BY created_at ASC`)
      .all() as Array<Record<string, unknown>>;
  }

  listAllCustomers(query = ''): PosCustomer[] {
    const like = `%${query.trim().replace(/%/g, '')}%`;
    const rows = getDatabase()
      .prepare(
        query.trim()
          ? `SELECT * FROM pos_customers
             WHERE name LIKE @like COLLATE NOCASE OR mobile LIKE @like
             ORDER BY name ASC LIMIT 500`
          : `SELECT * FROM pos_customers ORDER BY name ASC LIMIT 500`,
      )
      .all(query.trim() ? { like } : {}) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapCustomer(row));
  }

  listSuppliersLocal(): Array<{
    id: string;
    name: string;
    mobile: string | null;
    email: string | null;
    gstin: string | null;
    outstandingDue: number;
  }> {
    const rows = getDatabase()
      .prepare(`SELECT * FROM pos_suppliers ORDER BY name ASC`)
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      mobile: r.mobile ? String(r.mobile) : null,
      email: r.email ? String(r.email) : null,
      gstin: r.gstin ? String(r.gstin) : null,
      outstandingDue: Number(r.outstanding_due ?? 0),
    }));
  }

  upsertSupplierLocal(input: {
    name: string;
    mobile?: string;
    email?: string;
    gstin?: string;
  }): {
    id: string;
    name: string;
    mobile: string | null;
    email: string | null;
    gstin: string | null;
    outstandingDue: number;
  } {
    const name = input.name.trim();
    if (!name) throw new Error('Supplier name required');
    const id = uuidv4();
    getDatabase()
      .prepare(
        `INSERT INTO pos_suppliers (id, name, mobile, email, gstin, outstanding_due, is_synced, updated_at)
         VALUES (@id, @name, @mobile, @email, @gstin, 0, 0, datetime('now'))`,
      )
      .run({
        id,
        name,
        mobile: input.mobile?.trim() || null,
        email: input.email?.trim() || null,
        gstin: input.gstin?.trim() || null,
      });
    return {
      id,
      name,
      mobile: input.mobile?.trim() || null,
      email: input.email?.trim() || null,
      gstin: input.gstin?.trim() || null,
      outstandingDue: 0,
    };
  }

  listPurchasesLocal(): Array<Record<string, unknown>> {
    return getDatabase()
      .prepare(`SELECT * FROM purchases_local ORDER BY created_at DESC LIMIT 200`)
      .all() as Array<Record<string, unknown>>;
  }

  createPurchaseLocal(input: {
    supplierId: string;
    invoiceNumber?: string;
    invoiceDate: string;
    remark?: string;
    paidAmount?: number;
    paymentMode?: string;
    items: Array<{
      productId?: string;
      productName: string;
      barcode?: string;
      sku?: string;
      quantity: number;
      purchaseRate: number;
      mrp: number;
      saleRate: number;
      gstPercent?: number;
      isNewProduct?: boolean;
    }>;
  }): Record<string, unknown> {
    if (!input.items.length) throw new Error('Purchase needs items');
    const config = this.getConfig();
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const subtotal = input.items.reduce((s, i) => s + i.quantity * i.purchaseRate, 0);
    const taxTotal = 0;
    const grandTotal = subtotal + taxTotal;
    const paidAmount = Math.min(Math.max(0, input.paidAmount ?? 0), grandTotal);
    const dueAmount = Math.round((grandTotal - paidAmount) * 100) / 100;
    const paymentStatus =
      dueAmount <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';

    const tx = getDatabase().transaction(() => {
      getDatabase()
        .prepare(
          `INSERT INTO purchases_local (
            id, tenant_id, facility_id, supplier_id, invoice_number, invoice_date,
            gst_mode, status, remark, other_charges, subtotal, tax_total, grand_total,
            paid_amount, due_amount, payment_status, payment_mode, is_synced, created_at
          ) VALUES (
            @id, @tenant_id, @facility_id, @supplier_id, @invoice_number, @invoice_date,
            'NON_GST', 'COMPLETED', @remark, 0, @subtotal, @tax_total, @grand_total,
            @paid_amount, @due_amount, @payment_status, @payment_mode, 0, @created_at
          )`,
        )
        .run({
          id,
          tenant_id: config.tenantId,
          facility_id: config.facilityId,
          supplier_id: input.supplierId,
          invoice_number: input.invoiceNumber ?? null,
          invoice_date: input.invoiceDate,
          remark: input.remark ?? null,
          subtotal,
          tax_total: taxTotal,
          grand_total: grandTotal,
          paid_amount: paidAmount,
          due_amount: dueAmount,
          payment_status: paymentStatus,
          payment_mode: paidAmount > 0 ? (input.paymentMode ?? 'CASH') : null,
          created_at: createdAt,
        });

      const insertItem = getDatabase().prepare(
        `INSERT INTO purchase_items_local (
          id, purchase_id, product_id, product_name, barcode, sku, quantity,
          purchase_rate, mrp, sale_rate, gst_percent, lot_id, is_new_product
        ) VALUES (
          @id, @purchase_id, @product_id, @product_name, @barcode, @sku, @quantity,
          @purchase_rate, @mrp, @sale_rate, @gst_percent, @lot_id, @is_new_product
        )`,
      );

      for (const item of input.items) {
        let productId = item.productId;
        const isNewProduct = !productId || Boolean(item.isNewProduct);
        if (isNewProduct) {
          productId = productId || uuidv4();
        }

        const existingLot = productId
          ? (getDatabase()
              .prepare(
                `SELECT id FROM product_lots_local
                 WHERE product_id = @product_id AND facility_id = @facility_id
                 ORDER BY updated_at DESC LIMIT 1`,
              )
              .get({ product_id: productId, facility_id: config.facilityId }) as
              | { id: string }
              | undefined)
          : undefined;

        const useLotId = existingLot?.id ?? uuidv4();
        if (!existingLot) {
          const sku = (item.sku || item.barcode || item.productName).slice(0, 24);
          const barcode = (item.barcode || sku).slice(0, 32);
          getDatabase()
            .prepare(
              `INSERT INTO product_lots_local (
                id, product_id, product_name, product_sku, base_barcode, company, size, color, hsn_code,
                batch_number, cost_price, mrp, sale_rate, manufacture_date, expiry_date, lot_barcode,
                quantity_on_hand, aisle_shelf_location, facility_id, updated_at
              ) VALUES (
                @id, @product_id, @product_name, @sku, @barcode, '', '', '', '',
                @batch, @cost, @mrp, @sale, datetime('now'), datetime('now', '+365 days'), @lot_barcode,
                @qty, NULL, @facility_id, datetime('now')
              )`,
            )
            .run({
              id: useLotId,
              product_id: productId,
              product_name: item.productName,
              sku,
              barcode,
              batch: `PUR-${(input.invoiceNumber ?? id).slice(0, 8)}`,
              cost: item.purchaseRate,
              mrp: item.mrp,
              sale: item.saleRate,
              lot_barcode: `LOT-${useLotId.slice(0, 8)}`,
              qty: item.quantity,
              facility_id: config.facilityId,
            });
        } else {
          getDatabase()
            .prepare(
              `UPDATE product_lots_local
               SET quantity_on_hand = quantity_on_hand + @qty, updated_at = datetime('now')
               WHERE id = @id`,
            )
            .run({ id: useLotId, qty: item.quantity });
        }

        insertItem.run({
          id: uuidv4(),
          purchase_id: id,
          product_id: productId,
          product_name: item.productName,
          barcode: item.barcode ?? null,
          sku: item.sku ?? item.barcode ?? null,
          quantity: item.quantity,
          purchase_rate: item.purchaseRate,
          mrp: item.mrp,
          sale_rate: item.saleRate,
          gst_percent: 0,
          lot_id: useLotId,
          is_new_product: isNewProduct ? 1 : 0,
        });
      }

      if (dueAmount > 0) {
        getDatabase()
          .prepare(
            `UPDATE pos_suppliers
             SET outstanding_due = outstanding_due + @due, is_synced = 0, updated_at = datetime('now')
             WHERE id = @id`,
          )
          .run({ due: dueAmount, id: input.supplierId });
      }
    });
    tx();

    return {
      id,
      facilityId: config.facilityId,
      supplierId: input.supplierId,
      invoiceNumber: input.invoiceNumber ?? null,
      invoiceDate: input.invoiceDate,
      grandTotal,
      paidAmount,
      dueAmount,
      paymentStatus,
      status: 'COMPLETED',
      isSynced: 0,
    };
  }

  paySupplierLocal(input: {
    supplierId: string;
    amount: number;
    paymentMode: string;
    entryDate: string;
    remark?: string;
  }): { outstandingDue: number; paymentId: string } {
    const config = this.getConfig();
    const supplier = getDatabase()
      .prepare(`SELECT * FROM pos_suppliers WHERE id = @id`)
      .get({ id: input.supplierId }) as Record<string, unknown> | undefined;
    if (!supplier) throw new Error('Supplier not found');
    const due = Number(supplier.outstanding_due ?? 0);
    const applied = Math.min(Math.max(0, input.amount), due);
    if (applied <= 0) throw new Error('Nothing to pay');
    const paymentId = uuidv4();
    const tx = getDatabase().transaction(() => {
      getDatabase()
        .prepare(
          `UPDATE pos_suppliers
           SET outstanding_due = outstanding_due - @amt, is_synced = 0, updated_at = datetime('now')
           WHERE id = @id`,
        )
        .run({ amt: applied, id: input.supplierId });
      getDatabase()
        .prepare(
          `INSERT INTO supplier_payments_local (
            id, tenant_id, supplier_id, amount, payment_mode, entry_date, remark, reference_no, is_synced, created_at
          ) VALUES (
            @id, @tenant_id, @supplier_id, @amount, @payment_mode, @entry_date, @remark, NULL, 0, @created_at
          )`,
        )
        .run({
          id: paymentId,
          tenant_id: config.tenantId,
          supplier_id: input.supplierId,
          amount: applied,
          payment_mode: input.paymentMode,
          entry_date: input.entryDate,
          remark: input.remark ?? 'Supplier payment',
          created_at: new Date().toISOString(),
        });
    });
    tx();
    const updated = getDatabase()
      .prepare(`SELECT outstanding_due FROM pos_suppliers WHERE id = @id`)
      .get({ id: input.supplierId }) as { outstanding_due: number };
    return { outstandingDue: Number(updated.outstanding_due), paymentId };
  }

  createExpenseLocal(input: {
    expenseDate: string;
    amount: number;
    purpose: string;
    category?: string;
    paymentMode?: string;
    payee?: string;
    notes?: string;
  }): Record<string, unknown> {
    if (input.amount <= 0) throw new Error('Amount must be positive');
    const config = this.getConfig();
    const id = uuidv4();
    getDatabase()
      .prepare(
        `INSERT INTO expenses_local (
          id, tenant_id, facility_id, expense_date, amount, purpose, category, payment_mode,
          payee, notes, is_recurring_generated, schedule_id, period_key, created_by, is_synced, created_at
        ) VALUES (
          @id, @tenant_id, @facility_id, @expense_date, @amount, @purpose, @category, @payment_mode,
          @payee, @notes, 0, NULL, NULL, @created_by, 0, @created_at
        )`,
      )
      .run({
        id,
        tenant_id: config.tenantId,
        facility_id: config.facilityId,
        expense_date: input.expenseDate,
        amount: input.amount,
        purpose: input.purpose.trim(),
        category: input.category ?? 'MISC',
        payment_mode: input.paymentMode ?? 'CASH',
        payee: input.payee ?? null,
        notes: input.notes ?? null,
        created_by: this.auth.getSession()?.user.displayName ?? 'POS',
        created_at: new Date().toISOString(),
      });
    return { id, ...input, isSynced: 0 };
  }

  listExpensesLocal(from?: string, to?: string): Array<Record<string, unknown>> {
    const params: Record<string, string> = {};
    let sql = `SELECT * FROM expenses_local WHERE 1=1`;
    if (from) {
      sql += ` AND expense_date >= @from`;
      params.from = from;
    }
    if (to) {
      sql += ` AND expense_date <= @to`;
      params.to = to;
    }
    sql += ` ORDER BY expense_date DESC, created_at DESC LIMIT 500`;
    return getDatabase().prepare(sql).all(params) as Array<Record<string, unknown>>;
  }

  upsertExpenseScheduleLocal(input: {
    id?: string;
    purpose: string;
    amount: number;
    dayOfMonth: number;
    category?: string;
    paymentMode?: string;
    payee?: string;
    notes?: string;
    isActive?: boolean;
  }): Record<string, unknown> {
    if (input.dayOfMonth < 1 || input.dayOfMonth > 28) throw new Error('dayOfMonth must be 1–28');
    const config = this.getConfig();
    const id = input.id ?? uuidv4();
    const now = new Date().toISOString();
    getDatabase()
      .prepare(
        `INSERT INTO expense_schedules_local (
          id, tenant_id, facility_id, purpose, category, amount, day_of_month, payment_mode,
          payee, notes, is_active, start_month, end_month, is_synced, created_at, updated_at
        ) VALUES (
          @id, @tenant_id, @facility_id, @purpose, @category, @amount, @day_of_month, @payment_mode,
          @payee, @notes, @is_active, NULL, NULL, 0, @now, @now
        )
        ON CONFLICT(id) DO UPDATE SET
          purpose = excluded.purpose,
          category = excluded.category,
          amount = excluded.amount,
          day_of_month = excluded.day_of_month,
          payment_mode = excluded.payment_mode,
          payee = excluded.payee,
          notes = excluded.notes,
          is_active = excluded.is_active,
          is_synced = 0,
          updated_at = excluded.updated_at`,
      )
      .run({
        id,
        tenant_id: config.tenantId,
        facility_id: config.facilityId,
        purpose: input.purpose,
        category: input.category ?? 'MISC',
        amount: input.amount,
        day_of_month: input.dayOfMonth,
        payment_mode: input.paymentMode ?? 'BANK',
        payee: input.payee ?? null,
        notes: input.notes ?? null,
        is_active: input.isActive === false ? 0 : 1,
        now,
      });
    return { id, ...input };
  }

  listExpenseSchedulesLocal(): Array<Record<string, unknown>> {
    return getDatabase()
      .prepare(`SELECT * FROM expense_schedules_local ORDER BY purpose ASC`)
      .all() as Array<Record<string, unknown>>;
  }

  runExpenseSchedulesLocal(asOf?: string): { posted: number } {
    const asOfDate = asOf ?? new Date().toISOString().slice(0, 10);
    const periodKey = asOfDate.slice(0, 7);
    const asOfDay = Number(asOfDate.slice(8, 10));
    const schedules = this.listExpenseSchedulesLocal().filter((s) => Number(s.is_active) === 1);
    let posted = 0;
    for (const schedule of schedules) {
      const day = Number(schedule.day_of_month);
      if (day < 1 || day > 28 || asOfDay < day) continue;
      const exists = getDatabase()
        .prepare(
          `SELECT 1 AS ok FROM expenses_local
           WHERE schedule_id = @schedule_id AND period_key = @period_key`,
        )
        .get({ schedule_id: String(schedule.id), period_key: periodKey });
      if (exists) continue;
      const config = this.getConfig();
      getDatabase()
        .prepare(
          `INSERT INTO expenses_local (
            id, tenant_id, facility_id, expense_date, amount, purpose, category, payment_mode,
            payee, notes, is_recurring_generated, schedule_id, period_key, created_by, is_synced, created_at
          ) VALUES (
            @id, @tenant_id, @facility_id, @expense_date, @amount, @purpose, @category, @payment_mode,
            @payee, @notes, 1, @schedule_id, @period_key, 'schedule-runner', 0, @created_at
          )`,
        )
        .run({
          id: uuidv4(),
          tenant_id: config.tenantId,
          facility_id: config.facilityId,
          expense_date: asOfDate,
          amount: Number(schedule.amount),
          purpose: `${String(schedule.purpose)} (${periodKey})`,
          category: String(schedule.category ?? 'MISC'),
          payment_mode: schedule.payment_mode ? String(schedule.payment_mode) : 'BANK',
          payee: schedule.payee ? String(schedule.payee) : null,
          notes: schedule.notes ? String(schedule.notes) : null,
          schedule_id: String(schedule.id),
          period_key: periodKey,
          created_at: new Date().toISOString(),
        });
      posted += 1;
    }
    return { posted };
  }

  getLocalProfitLoss(from: string, to: string): Record<string, unknown> {
    const sales = getDatabase()
      .prepare(
        `SELECT sale_type, final_payable FROM order_invoices_local
         WHERE status = 'COMPLETED' AND substr(created_at, 1, 10) >= @from AND substr(created_at, 1, 10) <= @to`,
      )
      .all({ from, to }) as Array<{ sale_type: string; final_payable: number }>;
    const netSales = sales.reduce((sum, s) => {
      const amt = Number(s.final_payable);
      return sum + (s.sale_type === 'RETURN' ? -amt : amt);
    }, 0);
    const purchaseSpend = Number(
      (
        getDatabase()
          .prepare(
            `SELECT COALESCE(SUM(grand_total), 0) AS v FROM purchases_local
             WHERE status = 'COMPLETED' AND invoice_date >= @from AND invoice_date <= @to`,
          )
          .get({ from, to }) as { v: number }
      ).v,
    );
    const expenses = Number(
      (
        getDatabase()
          .prepare(
            `SELECT COALESCE(SUM(amount), 0) AS v FROM expenses_local
             WHERE expense_date >= @from AND expense_date <= @to`,
          )
          .get({ from, to }) as { v: number }
      ).v,
    );
    return {
      from,
      to,
      income: Math.round(netSales * 100) / 100,
      costs: Math.round(purchaseSpend * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      result: Math.round((netSales - purchaseSpend - expenses) * 100) / 100,
    };
  }

  dumpStockLocal(input: {
    productId: string;
    lotId: string;
    quantity: number;
    remark?: string;
  }): void {
    if (input.quantity <= 0) throw new Error('Quantity must be positive');
    const config = this.getConfig();
    const id = uuidv4();
    const tx = getDatabase().transaction(() => {
      const result = getDatabase()
        .prepare(
          `UPDATE product_lots_local
           SET quantity_on_hand = quantity_on_hand - @qty, updated_at = datetime('now')
           WHERE id = @lot_id AND facility_id = @facility_id AND quantity_on_hand >= @qty`,
        )
        .run({
          qty: input.quantity,
          lot_id: input.lotId,
          facility_id: config.facilityId,
        });
      if (result.changes === 0) throw new Error('Insufficient stock to dump');
      getDatabase()
        .prepare(
          `INSERT INTO stock_events_local (
            id, tenant_id, facility_id, event_type, product_id, lot_id, quantity,
            new_quantity, to_facility_id, remark, is_synced, created_at
          ) VALUES (
            @id, @tenant_id, @facility_id, 'DUMP', @product_id, @lot_id, @quantity,
            NULL, NULL, @remark, 0, @created_at
          )`,
        )
        .run({
          id,
          tenant_id: config.tenantId,
          facility_id: config.facilityId,
          product_id: input.productId,
          lot_id: input.lotId,
          quantity: input.quantity,
          remark: input.remark ?? 'Stock dump',
          created_at: new Date().toISOString(),
        });
    });
    tx();
  }

  correctStockLocal(input: {
    productId: string;
    lotId: string;
    newQuantity: number;
    remark?: string;
  }): void {
    if (input.newQuantity < 0) throw new Error('Quantity cannot be negative');
    const config = this.getConfig();
    const id = uuidv4();
    const tx = getDatabase().transaction(() => {
      const result = getDatabase()
        .prepare(
          `UPDATE product_lots_local
           SET quantity_on_hand = @qty, updated_at = datetime('now')
           WHERE id = @lot_id AND facility_id = @facility_id`,
        )
        .run({
          qty: input.newQuantity,
          lot_id: input.lotId,
          facility_id: config.facilityId,
        });
      if (result.changes === 0) throw new Error('Lot not found');
      getDatabase()
        .prepare(
          `INSERT INTO stock_events_local (
            id, tenant_id, facility_id, event_type, product_id, lot_id, quantity,
            new_quantity, to_facility_id, remark, is_synced, created_at
          ) VALUES (
            @id, @tenant_id, @facility_id, 'CORRECTION', @product_id, @lot_id, 0,
            @new_quantity, NULL, @remark, 0, @created_at
          )`,
        )
        .run({
          id,
          tenant_id: config.tenantId,
          facility_id: config.facilityId,
          product_id: input.productId,
          lot_id: input.lotId,
          new_quantity: input.newQuantity,
          remark: input.remark ?? 'Stock correction',
          created_at: new Date().toISOString(),
        });
    });
    tx();
  }

  applyPulledState(payload: {
    customers: Array<{
      id: string;
      name: string;
      mobile: string;
      email: string | null;
      previousDue: number;
      membershipCard: string | null;
      loyaltyPoints: number;
    }>;
    lots: Array<{
      id: string;
      productId: string;
      productName: string;
      productSku: string;
      baseBarcode: string;
      company: string;
      size: string;
      color: string;
      hsnCode: string;
      batchNumber: string;
      costPrice: number;
      mrp: number;
      saleRate: number;
      manufactureDate: string;
      expiryDate: string;
      lotBarcode: string;
      quantityOnHand: number;
      aisleShelfLocation: string | null;
      facilityId: string;
    }>;
  }): void {
    const db = getDatabase();
    const upsertCustomer = db.prepare(
      `INSERT INTO pos_customers (id, name, mobile, email, previous_due, membership_card, loyalty_points, is_synced, updated_at, created_at)
       VALUES (@id, @name, @mobile, @email, @previous_due, @membership_card, @loyalty_points, 1, datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         mobile = excluded.mobile,
         email = excluded.email,
         previous_due = excluded.previous_due,
         membership_card = excluded.membership_card,
         loyalty_points = excluded.loyalty_points,
         is_synced = 1,
         updated_at = datetime('now')`,
    );
    const upsertLot = db.prepare(
      `INSERT INTO product_lots_local (
        id, product_id, product_name, product_sku, base_barcode, company, size, color, hsn_code,
        batch_number, cost_price, mrp, sale_rate, manufacture_date, expiry_date, lot_barcode,
        quantity_on_hand, aisle_shelf_location, facility_id, updated_at
      ) VALUES (
        @id, @product_id, @product_name, @product_sku, @base_barcode, @company, @size, @color, @hsn_code,
        @batch_number, @cost_price, @mrp, @sale_rate, @manufacture_date, @expiry_date, @lot_barcode,
        @quantity_on_hand, @aisle_shelf_location, @facility_id, datetime('now')
      )
      ON CONFLICT(id) DO UPDATE SET
        product_name = excluded.product_name,
        quantity_on_hand = excluded.quantity_on_hand,
        mrp = excluded.mrp,
        sale_rate = excluded.sale_rate,
        cost_price = excluded.cost_price,
        expiry_date = excluded.expiry_date,
        aisle_shelf_location = excluded.aisle_shelf_location,
        updated_at = datetime('now')`,
    );

    const findMobileConflict = db.prepare(
      `SELECT id FROM pos_customers WHERE mobile = @mobile AND id != @id`,
    );
    const deleteById = db.prepare(`DELETE FROM pos_customers WHERE id = @id`);

    const tx = db.transaction(() => {
      for (const c of payload.customers) {
        const mobile = String(c.mobile ?? '').trim().replace(/\s+/g, '');
        if (!mobile) continue;

        // Prefer central id when a local seed/demo row already owns this mobile.
        const conflict = findMobileConflict.get({ mobile, id: c.id }) as
          | { id: string }
          | undefined;
        if (conflict) {
          deleteById.run({ id: conflict.id });
        }

        upsertCustomer.run({
          id: c.id,
          name: c.name,
          mobile,
          email: c.email,
          previous_due: c.previousDue,
          membership_card: c.membershipCard,
          loyalty_points: c.loyaltyPoints,
        });
      }
      for (const lot of payload.lots) {
        upsertLot.run({
          id: lot.id,
          product_id: lot.productId,
          product_name: lot.productName,
          product_sku: lot.productSku,
          base_barcode: lot.baseBarcode,
          company: lot.company,
          size: lot.size,
          color: lot.color,
          hsn_code: lot.hsnCode,
          batch_number: lot.batchNumber,
          cost_price: lot.costPrice,
          mrp: lot.mrp,
          sale_rate: lot.saleRate,
          manufacture_date: lot.manufactureDate,
          expiry_date: lot.expiryDate,
          lot_barcode: lot.lotBarcode,
          quantity_on_hand: lot.quantityOnHand,
          aisle_shelf_location: lot.aisleShelfLocation,
          facility_id: lot.facilityId,
        });
      }
    });
    tx();
  }

  clockIn(biometricHash: string): LocalAttendanceRecord {
    const session = this.auth.getSession();
    if (!session) throw new Error('Login required');

    const config = this.getConfig();
    const id = uuidv4();
    const clockIn = new Date().toISOString();

    getDatabase()
      .prepare(
        `INSERT INTO workforce_attendance_local (id, tenant_id, user_id, facility_id, clock_in, clock_out, biometric_signature_hash, is_synced)
         VALUES (@id, @tenant_id, @user_id, @facility_id, @clock_in, NULL, @hash, 0)`,
      )
      .run({
        id,
        tenant_id: config.tenantId,
        user_id: session.user.id,
        facility_id: session.facility.id,
        clock_in: clockIn,
        hash: biometricHash,
      });

    return {
      id,
      tenantId: config.tenantId,
      userId: session.user.id,
      facilityId: session.facility.id,
      clockIn,
      clockOut: null,
      biometricSignatureHash: biometricHash,
      isSynced: 0,
    };
  }

  clockOut(attendanceId: string): LocalAttendanceRecord {
    const clockOut = new Date().toISOString();
    const result = getDatabase()
      .prepare(
        'UPDATE workforce_attendance_local SET clock_out = @clock_out WHERE id = @id AND clock_out IS NULL',
      )
      .run({ id: attendanceId, clock_out: clockOut });

    if (result.changes === 0) throw new Error('Attendance record not found or already clocked out');

    const row = getDatabase()
      .prepare('SELECT * FROM workforce_attendance_local WHERE id = @id')
      .get({ id: attendanceId }) as Record<string, unknown>;

    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      userId: String(row.user_id),
      facilityId: String(row.facility_id),
      clockIn: String(row.clock_in),
      clockOut: row.clock_out ? String(row.clock_out) : null,
      biometricSignatureHash: String(row.biometric_signature_hash),
      isSynced: Number(row.is_synced),
    };
  }

  /** Invoice no = DDMMYYYY + daily sequence, e.g. 26112026-0001 */
  private todayInvoiceDateKey(now = new Date()): string {
    const pad = (value: number, size: number): string => String(value).padStart(size, '0');
    return `${pad(now.getDate(), 2)}${pad(now.getMonth() + 1, 2)}${now.getFullYear()}`;
  }

  private nextSequenceForDate(dateKey: string): number {
    const db = getDatabase();
    const prefix = `${dateKey}-`;
    const rows = db
      .prepare(
        `SELECT invoice_number FROM order_invoices_local
         WHERE invoice_number LIKE @like
         ORDER BY invoice_number DESC
         LIMIT 50`,
      )
      .all({ like: `${prefix}%` }) as Array<{ invoice_number: string }>;

    let maxSeq = 0;
    for (const row of rows) {
      const tail = String(row.invoice_number).slice(prefix.length);
      const seq = Number.parseInt(tail, 10);
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
    }
    return maxSeq + 1;
  }

  private formatInvoiceNumber(dateKey: string, sequence: number): string {
    return `${dateKey}-${String(sequence).padStart(4, '0')}`;
  }

  private nextInvoiceNumber(_facilityId: string): string {
    const db = getDatabase();
    const dateKey = this.todayInvoiceDateKey();
    let sequence = this.nextSequenceForDate(dateKey);
    let invoiceNumber = this.formatInvoiceNumber(dateKey, sequence);

    while (
      db
        .prepare('SELECT 1 AS ok FROM order_invoices_local WHERE invoice_number = @invoice_number')
        .get({ invoice_number: invoiceNumber })
    ) {
      sequence += 1;
      invoiceNumber = this.formatInvoiceNumber(dateKey, sequence);
    }
    return invoiceNumber;
  }

  previewNextInvoiceNumber(): string {
    const dateKey = this.todayInvoiceDateKey();
    const sequence = this.nextSequenceForDate(dateKey);
    return this.formatInvoiceNumber(dateKey, sequence);
  }

  searchProducts(query: string, limit = 25): ProductSearchHit[] {
    const normalized = query.trim();
    if (normalized.length < 1) return [];

    const config = this.getConfig();
    const like = `%${normalized.replace(/%/g, '')}%`;
    const rows = getDatabase()
      .prepare(
        `SELECT product_id, product_name, product_sku, base_barcode, company, size,
                SUM(quantity_on_hand) AS quantity_on_hand,
                MIN(mrp) AS mrp_min, MAX(mrp) AS mrp_max,
                MIN(sale_rate) AS sale_rate_min
         FROM product_lots_local
         WHERE facility_id = @facility_id
           AND quantity_on_hand > 0
           AND (
             product_name LIKE @like COLLATE NOCASE
             OR product_sku LIKE @like COLLATE NOCASE
             OR base_barcode LIKE @like COLLATE NOCASE
             OR company LIKE @like COLLATE NOCASE
           )
         GROUP BY product_id, product_name, product_sku, base_barcode, company, size
         ORDER BY product_name ASC
         LIMIT @limit`,
      )
      .all({ facility_id: config.facilityId, like, limit }) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      productId: String(row.product_id),
      productName: String(row.product_name),
      productSku: String(row.product_sku),
      baseBarcode: String(row.base_barcode),
      company: String(row.company ?? ''),
      size: String(row.size ?? ''),
      quantityOnHand: Number(row.quantity_on_hand ?? 0),
      mrpMin: Number(row.mrp_min ?? 0),
      mrpMax: Number(row.mrp_max ?? 0),
      saleRate: Number(row.sale_rate_min ?? 0),
    }));
  }

  listInventory(
    query = '',
    options: { inStockOnly?: boolean; sortBy?: 'name' | 'mrp' | 'qty'; limit?: number } = {},
  ): InventoryRow[] {
    const config = this.getConfig();
    const normalized = query.trim();
    const like = `%${normalized.replace(/%/g, '')}%`;
    const inStockOnly = options.inStockOnly !== false;
    const sortBy = options.sortBy ?? 'name';
    const limit = options.limit ?? 500;

    const orderSql =
      sortBy === 'mrp'
        ? 'mrp ASC, product_name ASC'
        : sortBy === 'qty'
          ? 'quantity_on_hand DESC, product_name ASC'
          : 'product_name ASC, mrp ASC';

    const stockSql = inStockOnly ? 'AND quantity_on_hand > 0' : '';
    const searchSql =
      normalized.length === 0
        ? ''
        : `AND (
             product_name LIKE @like COLLATE NOCASE
             OR product_sku LIKE @like COLLATE NOCASE
             OR base_barcode LIKE @like COLLATE NOCASE
             OR lot_barcode LIKE @like COLLATE NOCASE
           )`;

    const rows = getDatabase()
      .prepare(
        `SELECT * FROM product_lots_local
         WHERE facility_id = @facility_id
           ${stockSql}
           ${searchSql}
         ORDER BY ${orderSql}
         LIMIT @limit`,
      )
      .all(
        normalized.length === 0
          ? { facility_id: config.facilityId, limit }
          : { facility_id: config.facilityId, like, limit },
      ) as LotRow[];

    return rows.map((row) => ({
      ...this.mapLotRow(row),
      facilityId: row.facility_id,
    }));
  }

  searchCustomers(query: string, limit = 15): PosCustomer[] {
    const normalized = query.trim();
    if (normalized.length < 2) return [];
    const like = `%${normalized.replace(/%/g, '')}%`;
    const rows = getDatabase()
      .prepare(
        `SELECT * FROM pos_customers
         WHERE mobile LIKE @like OR name LIKE @like COLLATE NOCASE
         ORDER BY name ASC
         LIMIT @limit`,
      )
      .all({ like, limit }) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapCustomer(row));
  }

  listInvoices(limit = 3000): LocalOrderInvoice[] {
    const rows = getDatabase()
      .prepare(
        `SELECT * FROM order_invoices_local
         ORDER BY created_at DESC
         LIMIT @limit`,
      )
      .all({ limit }) as Array<Record<string, unknown>>;
    return rows.map((row) => this.hydrateInvoice(row));
  }

  listDraftInvoices(): LocalOrderInvoice[] {
    const rows = getDatabase()
      .prepare(
        `SELECT * FROM order_invoices_local
         WHERE status = 'DRAFT'
         ORDER BY created_at DESC
         LIMIT 100`,
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map((row) => this.hydrateInvoice(row));
  }

  getInvoice(invoiceId: string): LocalOrderInvoice {
    return this.getInvoiceById(invoiceId);
  }

  getSalesReportSummary(): SalesReportSummary {
    const db = getDatabase();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const totals = db
      .prepare(
        `SELECT
           COUNT(*) AS invoice_count,
           COALESCE(SUM(final_payable), 0) AS sales_total
         FROM order_invoices_local
         WHERE status = 'COMPLETED'`,
      )
      .get() as Record<string, number>;

    const lastHour = db
      .prepare(
        `SELECT
           COUNT(*) AS invoice_count,
           COALESCE(SUM(final_payable), 0) AS sales_total
         FROM order_invoices_local
         WHERE status = 'COMPLETED' AND created_at >= @since`,
      )
      .get({ since }) as Record<string, number>;

    return {
      invoiceCount: Number(totals.invoice_count ?? 0),
      salesTotal: Number(totals.sales_total ?? 0),
      lastHourInvoiceCount: Number(lastHour.invoice_count ?? 0),
      lastHourSalesTotal: Number(lastHour.sales_total ?? 0),
    };
  }

  private getInvoiceById(invoiceId: string): LocalOrderInvoice {
    const row = getDatabase()
      .prepare('SELECT * FROM order_invoices_local WHERE id = @id')
      .get({ id: invoiceId }) as Record<string, unknown>;

    if (!row) throw new Error(`Invoice ${invoiceId} not found`);
    return this.hydrateInvoice(row);
  }

  private hydrateInvoice(row: Record<string, unknown>): LocalOrderInvoice {
    const itemRows = getDatabase()
      .prepare(
        `SELECT i.*,
                COALESCE(l.product_name, '') AS product_name,
                COALESCE(l.product_sku, '') AS product_sku,
                COALESCE(l.expiry_date, '') AS expiry_date
         FROM order_items_local i
         LEFT JOIN product_lots_local l ON l.id = i.lot_id
         WHERE i.order_id = @order_id`,
      )
      .all({ order_id: String(row.id) }) as Array<Record<string, unknown>>;

    const items: CartLineItem[] = itemRows.map((item) => ({
      lineId: String(item.id),
      productId: String(item.product_id),
      lotId: String(item.lot_id),
      barcode: String(item.barcode ?? ''),
      productName: String(item.product_name ?? ''),
      productSku: String(item.product_sku ?? ''),
      company: String(item.company ?? ''),
      size: String(item.size ?? ''),
      color: String(item.color ?? ''),
      hsnCode: String(item.hsn_code ?? ''),
      batchNumber: String(item.batch_number ?? ''),
      serialNumber: String(item.serial_number ?? ''),
      priceType: String(item.price_type ?? 'MRP'),
      boxQty: Number(item.box_qty ?? 0),
      packetQty: Number(item.packet_qty ?? 0),
      pieceQty: Number(item.piece_qty ?? 0),
      quantity: Number(item.quantity),
      purchaseRate: Number(item.purchase_rate ?? 0),
      mrp: Number(item.mrp ?? 0),
      unitPrice: Number(item.unit_price),
      discountPercent: Number(item.discount_percent ?? 0),
      discountAmount: Number(item.discount_amount ?? 0),
      calculatedTax: Number(item.calculated_tax),
      netAmount: Number(item.net_amount),
      expiryDate: String(item.expiry_date ?? ''),
    }));

    return {
      id: String(row.id),
      invoiceNumber: String(row.invoice_number ?? ''),
      tenantId: String(row.tenant_id),
      facilityId: String(row.facility_id),
      cashierId: String(row.cashier_id),
      cashierName: String(row.cashier_name ?? ''),
      saleType: row.sale_type as SaleType,
      status: row.status as InvoiceStatus,
      customerPayload: JSON.parse(String(row.customer_payload)) as Record<string, string>,
      customerMobile: String(row.customer_mobile ?? ''),
      subtotal: Number(row.subtotal),
      taxableValue: Number(row.taxable_value ?? 0),
      taxTotal: Number(row.tax_total),
      discountTotal: Number(row.discount_total),
      redeemAmount: Number(row.redeem_amount ?? 0),
      grossSale: Number(row.gross_sale ?? 0),
      roundOff: Number(row.round_off ?? 0),
      finalPayable: Number(row.final_payable),
      paymentChannel: row.payment_channel as PaymentChannel,
      originSource: row.origin_source as OrderOriginSource,
      couponCode: row.coupon_code ? String(row.coupon_code) : null,
      billDiscountPercent: Number(row.bill_discount_percent ?? 0),
      amountTendered: Number(row.amount_tendered ?? 0),
      changeDue: Number(row.change_due ?? 0),
      returnOfInvoiceId: row.return_of_invoice_id ? String(row.return_of_invoice_id) : null,
      isSynced: Number(row.is_synced),
      createdAt: String(row.created_at),
      items,
    };
  }

  // ---------- Stocktake ----------
  startStocktake(remark?: string): LocalStocktakeSession {
    const session = this.auth.getSession();
    if (!session) throw new Error('Login required for stocktake');
    const config = this.getConfig();
    const id = uuidv4();
    const now = new Date().toISOString();
    const db = getDatabase();

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO stocktake_sessions_local (
          id, tenant_id, facility_id, started_by, status, remark, committed_at, is_synced, created_at, updated_at
        ) VALUES (
          @id, @tenant_id, @facility_id, @started_by, 'IN_PROGRESS', @remark, NULL, 0, @now, @now
        )`,
      ).run({
        id,
        tenant_id: config.tenantId,
        facility_id: session.facility.id,
        started_by: session.user.id,
        remark: remark ?? null,
        now,
      });

      const lots = db
        .prepare(
          `SELECT id, product_id, quantity_on_hand FROM product_lots_local WHERE facility_id = @facility_id`,
        )
        .all({ facility_id: session.facility.id }) as Array<{
        id: string;
        product_id: string;
        quantity_on_hand: number;
      }>;

      const insertLine = db.prepare(
        `INSERT INTO stocktake_lines_local (
          id, session_id, product_id, lot_id, expected_qty, counted_qty, remark
        ) VALUES (@id, @session_id, @product_id, @lot_id, @expected_qty, NULL, NULL)`,
      );
      for (const lot of lots) {
        insertLine.run({
          id: uuidv4(),
          session_id: id,
          product_id: lot.product_id,
          lot_id: lot.id,
          expected_qty: lot.quantity_on_hand,
        });
      }
    });
    tx();
    return this.getStocktakeSession(id);
  }

  listStocktakeSessions(): LocalStocktakeSession[] {
    const rows = getDatabase()
      .prepare(
        `SELECT id FROM stocktake_sessions_local ORDER BY created_at DESC LIMIT 50`,
      )
      .all() as Array<{ id: string }>;
    return rows.map((r) => this.getStocktakeSession(r.id));
  }

  getStocktakeSession(sessionId: string): LocalStocktakeSession {
    const row = getDatabase()
      .prepare(`SELECT * FROM stocktake_sessions_local WHERE id = @id`)
      .get({ id: sessionId }) as Record<string, unknown> | undefined;
    if (!row) throw new Error('Stocktake session not found');

    const lines = getDatabase()
      .prepare(
        `SELECT l.*, p.product_name, p.batch_number
         FROM stocktake_lines_local l
         LEFT JOIN product_lots_local p ON p.id = l.lot_id
         WHERE l.session_id = @session_id
         ORDER BY p.product_name ASC`,
      )
      .all({ session_id: sessionId }) as Array<Record<string, unknown>>;

    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      facilityId: String(row.facility_id),
      startedBy: String(row.started_by),
      status: row.status as LocalStocktakeSession['status'],
      remark: row.remark ? String(row.remark) : null,
      committedAt: row.committed_at ? String(row.committed_at) : null,
      isSynced: Number(row.is_synced ?? 0),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      lines: lines.map((l) => ({
        id: String(l.id),
        sessionId: String(l.session_id),
        productId: String(l.product_id),
        lotId: String(l.lot_id),
        productName: l.product_name ? String(l.product_name) : undefined,
        batchNumber: l.batch_number ? String(l.batch_number) : undefined,
        expectedQty: Number(l.expected_qty),
        countedQty: l.counted_qty == null ? null : Number(l.counted_qty),
        remark: l.remark ? String(l.remark) : null,
      })),
    };
  }

  updateStocktakeCount(input: {
    sessionId: string;
    lotId: string;
    countedQty: number;
    remark?: string;
  }): LocalStocktakeSession {
    if (input.countedQty < 0) throw new Error('Counted quantity cannot be negative');
    const session = this.getStocktakeSession(input.sessionId);
    if (session.status !== 'IN_PROGRESS') throw new Error('Stocktake is not in progress');

    getDatabase()
      .prepare(
        `UPDATE stocktake_lines_local
         SET counted_qty = @counted_qty, remark = @remark
         WHERE session_id = @session_id AND lot_id = @lot_id`,
      )
      .run({
        counted_qty: input.countedQty,
        remark: input.remark ?? null,
        session_id: input.sessionId,
        lot_id: input.lotId,
      });
    getDatabase()
      .prepare(
        `UPDATE stocktake_sessions_local SET updated_at = @now WHERE id = @id`,
      )
      .run({ now: new Date().toISOString(), id: input.sessionId });

    return this.getStocktakeSession(input.sessionId);
  }

  commitStocktake(sessionId: string): LocalStocktakeSession {
    const session = this.getStocktakeSession(sessionId);
    if (session.status !== 'IN_PROGRESS') throw new Error('Stocktake is not in progress');

    const config = this.getConfig();
    const now = new Date().toISOString();
    const db = getDatabase();

    const tx = db.transaction(() => {
      for (const line of session.lines) {
        if (line.countedQty == null) continue;
        const variance = line.countedQty - line.expectedQty;
        if (variance === 0) continue;

        db.prepare(
          `UPDATE product_lots_local
           SET quantity_on_hand = @qty, updated_at = datetime('now')
           WHERE id = @lot_id AND facility_id = @facility_id`,
        ).run({
          qty: line.countedQty,
          lot_id: line.lotId,
          facility_id: session.facilityId,
        });

        db.prepare(
          `INSERT INTO stock_events_local (
            id, tenant_id, facility_id, event_type, product_id, lot_id, quantity,
            new_quantity, to_facility_id, remark, is_synced, created_at
          ) VALUES (
            @id, @tenant_id, @facility_id, 'CORRECTION', @product_id, @lot_id, 0,
            @new_quantity, NULL, @remark, 0, @created_at
          )`,
        ).run({
          id: uuidv4(),
          tenant_id: config.tenantId,
          facility_id: session.facilityId,
          product_id: line.productId,
          lot_id: line.lotId,
          new_quantity: line.countedQty,
          remark: `Stocktake ${sessionId} variance ${variance}`,
          created_at: now,
        });
      }

      db.prepare(
        `UPDATE stocktake_sessions_local
         SET status = 'COMMITTED', committed_at = @now, updated_at = @now
         WHERE id = @id`,
      ).run({ id: sessionId, now });
    });
    tx();
    return this.getStocktakeSession(sessionId);
  }

  cancelStocktake(sessionId: string): LocalStocktakeSession {
    const session = this.getStocktakeSession(sessionId);
    if (session.status !== 'IN_PROGRESS') throw new Error('Only in-progress stocktakes can be cancelled');
    getDatabase()
      .prepare(
        `UPDATE stocktake_sessions_local
         SET status = 'CANCELLED', updated_at = @now WHERE id = @id`,
      )
      .run({ id: sessionId, now: new Date().toISOString() });
    return this.getStocktakeSession(sessionId);
  }

  getDashboardSnapshot(): Record<string, unknown> {
    const db = getDatabase();
    const config = this.getConfig();
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;

    const productCount = Number(
      (db.prepare(`SELECT COUNT(DISTINCT product_id) AS c FROM product_lots_local WHERE facility_id = @f`).get({
        f: config.facilityId,
      }) as { c: number }).c,
    );
    const customerCount = Number(
      (db.prepare(`SELECT COUNT(*) AS c FROM pos_customers`).get() as { c: number }).c,
    );
    const todaySales = db
      .prepare(
        `SELECT COUNT(*) AS invoice_count,
                COALESCE(SUM(CASE WHEN sale_type = 'RETURN' THEN -final_payable ELSE final_payable END), 0) AS sales_total,
                COALESCE(SUM(discount_total), 0) AS discount_total
         FROM order_invoices_local
         WHERE status = 'COMPLETED' AND created_at >= @today`,
      )
      .get({ today }) as Record<string, number>;

    const hourlyRows = db
      .prepare(
        `SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hour,
                COUNT(*) AS orders,
                COALESCE(SUM(CASE WHEN sale_type = 'RETURN' THEN -final_payable ELSE final_payable END), 0) AS sales
         FROM order_invoices_local
         WHERE status = 'COMPLETED' AND created_at >= @today
         GROUP BY hour
         ORDER BY hour`,
      )
      .all({ today }) as Array<{ hour: number; orders: number; sales: number }>;
    const hourlyMap = new Map(hourlyRows.map((r) => [Number(r.hour), r]));
    const todayHourlyOrders = Array.from({ length: 24 }, (_, hour) => {
      const row = hourlyMap.get(hour);
      return {
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        orders: Number(row?.orders ?? 0),
        sales: Number(row?.sales ?? 0),
      };
    });

    const paymentMixToday = (
      db
        .prepare(
          `SELECT payment_channel AS channel,
                  COALESCE(SUM(final_payable), 0) AS amount
           FROM order_invoices_local
           WHERE status = 'COMPLETED' AND sale_type != 'RETURN' AND created_at >= @today
           GROUP BY payment_channel`,
        )
        .all({ today }) as Array<{ channel: string; amount: number }>
    ).map((r) => ({ channel: String(r.channel ?? 'OTHER'), amount: Number(r.amount ?? 0) }));

    const newCustomersThisMonth = Number(
      (db
        .prepare(
          `SELECT COUNT(*) AS c FROM pos_customers
           WHERE COALESCE(NULLIF(created_at, ''), updated_at, '1970-01-01') >= @monthStart`,
        )
        .get({ monthStart }) as { c: number }).c,
    );

    const lowStockItems = (
      db
        .prepare(
          `SELECT product_id AS productId, product_name AS productName, product_sku AS sku,
                  quantity_on_hand AS quantityOnHand, 5 AS minStock
           FROM product_lots_local
           WHERE facility_id = @f AND quantity_on_hand <= 5
           ORDER BY quantity_on_hand ASC
           LIMIT 8`,
        )
        .all({ f: config.facilityId }) as Array<Record<string, unknown>>
    ).map((r) => ({
      productId: String(r.productId),
      productName: String(r.productName),
      sku: String(r.sku ?? ''),
      quantityOnHand: Number(r.quantityOnHand ?? 0),
      minStock: Number(r.minStock ?? 5),
    }));

    const outOfStock = Number(
      (db
        .prepare(
          `SELECT COUNT(*) AS c FROM product_lots_local
           WHERE facility_id = @f AND quantity_on_hand <= 0`,
        )
        .get({ f: config.facilityId }) as { c: number }).c,
    );
    const stockValue = Number(
      (db
        .prepare(
          `SELECT COALESCE(SUM(quantity_on_hand * cost_price), 0) AS v
           FROM product_lots_local WHERE facility_id = @f`,
        )
        .get({ f: config.facilityId }) as { v: number }).v,
    );

    const recentSales = (
      db
        .prepare(
          `SELECT id, invoice_number AS invoiceNumber, final_payable AS finalPayable,
                  payment_channel AS paymentChannel, created_at AS createdAt,
                  customer_mobile AS customerMobile
           FROM order_invoices_local
           WHERE status = 'COMPLETED'
           ORDER BY created_at DESC
           LIMIT 8`,
        )
        .all() as Array<Record<string, unknown>>
    ).map((r) => ({
      id: String(r.id),
      invoiceNumber: r.invoiceNumber ? String(r.invoiceNumber) : null,
      finalPayable: Number(r.finalPayable ?? 0),
      paymentChannel: String(r.paymentChannel ?? ''),
      createdAt: String(r.createdAt ?? ''),
      customerMobile: r.customerMobile ? String(r.customerMobile) : null,
    }));

    const todayNet = Number(todaySales.sales_total ?? 0);
    const todayOrderCount = Number(todaySales.invoice_count ?? 0);

    return {
      totalProducts: productCount,
      productCount,
      totalCustomers: customerCount,
      customerCount,
      totalSales: todayNet,
      salesTotal: todayNet,
      todayNetSales: todayNet,
      todayInvoiceCount: todayOrderCount,
      todayOrderCount,
      todayHourlyOrders,
      paymentMixToday,
      newCustomersThisMonth,
      discountTotalToday: Number(todaySales.discount_total ?? 0),
      lowStockCount: lowStockItems.length,
      lowStockItems,
      outOfStockCount: outOfStock,
      stockValueAtCost: stockValue,
      recentSales,
    };
  }

  private resolveCompositeLot(lotBarcode: string): BarcodeResolutionResult {
    const config = this.getConfig();
    const row = getDatabase()
      .prepare(
        `SELECT * FROM product_lots_local
         WHERE lot_barcode = @lot_barcode AND facility_id = @facility_id AND quantity_on_hand > 0`,
      )
      .get({ lot_barcode: lotBarcode, facility_id: config.facilityId }) as LotRow | undefined;

    if (!row) throw new Error(`Lot barcode ${lotBarcode} not found or out of stock`);

    const lot = this.mapLotRow(row);
    return {
      resolutionType: 'COMPOSITE_LOT_DIRECT',
      productId: lot.productId,
      productName: lot.productName,
      productSku: lot.productSku,
      suggestedLot: lot,
      candidateLots: [lot],
      fifoRecommendation: lot,
    };
  }

  private resolveEan13(ean13: string): BarcodeResolutionResult {
    const config = this.getConfig();
    const rows = getDatabase()
      .prepare(
        `SELECT * FROM product_lots_local
         WHERE base_barcode = @barcode AND facility_id = @facility_id AND quantity_on_hand > 0
         ORDER BY expiry_date ASC`,
      )
      .all({ barcode: ean13, facility_id: config.facilityId }) as LotRow[];

    if (rows.length === 0) throw new Error(`No inventory found for barcode ${ean13}`);

    const lots = rows.map((row) => this.mapLotRow(row));
    const fifoRecommendation = lots[0];
    const distinctMrp = new Set(lots.map((lot) => lot.mrp));

    return {
      resolutionType: distinctMrp.size > 1 ? 'MULTI_MRP_SELECTION' : 'SINGLE_LOT',
      productId: rows[0].product_id,
      productName: rows[0].product_name,
      productSku: rows[0].product_sku,
      suggestedLot: fifoRecommendation,
      candidateLots: lots,
      fifoRecommendation,
    };
  }

  private mapLotRow(row: LotRow): LocalProductLot {
    return {
      id: row.id,
      productId: row.product_id,
      productName: row.product_name,
      productSku: row.product_sku,
      baseBarcode: row.base_barcode,
      company: row.company ?? '',
      size: row.size ?? '',
      color: row.color ?? '',
      hsnCode: row.hsn_code ?? '',
      batchNumber: row.batch_number,
      costPrice: row.cost_price,
      mrp: row.mrp,
      saleRate: row.sale_rate || row.mrp,
      manufactureDate: row.manufacture_date,
      expiryDate: row.expiry_date,
      lotBarcode: row.lot_barcode,
      quantityOnHand: row.quantity_on_hand,
      aisleShelfLocation: row.aisle_shelf_location,
    };
  }

  private mapCustomer(row: Record<string, unknown>): PosCustomer {
    return {
      id: String(row.id),
      name: String(row.name),
      mobile: String(row.mobile),
      email: row.email ? String(row.email) : null,
      previousDue: Number(row.previous_due ?? 0),
      membershipCard: row.membership_card ? String(row.membership_card) : null,
      loyaltyPoints: Number(row.loyalty_points ?? 0),
      isSynced: Number(row.is_synced ?? 1),
    };
  }

  private isValidEan13(barcode: string): boolean {
    if (barcode.length !== EAN13_LENGTH || !/^\d{13}$/.test(barcode)) return false;
    const digits = barcode.split('').map((char) => parseInt(char, 10));
    let sum = 0;
    for (let index = 0; index < 12; index += 1) {
      sum += digits[index] * (index % 2 === 0 ? 1 : 3);
    }
    return (10 - (sum % 10)) % 10 === digits[12];
  }
}

export const posDatabaseService = new PosDatabaseService();
