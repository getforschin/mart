import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './sqlite-manager';
import { AuthService } from './auth.service';
import {
  BarcodeResolutionResult,
  CartLineItem,
  CreateInvoicePayload,
  InventoryRow,
  InvoiceStatus,
  LocalAttendanceRecord,
  LocalOrderInvoice,
  LocalProductLot,
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
      `INSERT INTO pos_customers (id, name, mobile, email, previous_due, membership_card, loyalty_points, is_synced, updated_at)
       VALUES (@id, @name, @mobile, @email, 0, NULL, 0, 0, datetime('now'))`,
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
          origin_source, is_synced, created_at
        ) VALUES (
          @id, @invoice_number, @tenant_id, @facility_id, @cashier_id, @cashier_name,
          @sale_type, @status, @customer_payload, @customer_mobile,
          @subtotal, @taxable_value, @tax_total, @discount_total, @redeem_amount,
          @gross_sale, @round_off, @final_payable, @payment_channel, @coupon_code,
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
        redeem_amount: payload.redeemAmount,
        gross_sale: totals.grossSale,
        round_off: payload.roundOff,
        final_payable: totals.finalPayable,
        payment_channel: paymentChannel,
        coupon_code: payload.couponCode || null,
        origin_source: OrderOriginSource.OFFLINE_POS,
        created_at: createdAt,
      });

      this.replaceInvoiceItems(invoiceId, payload.items);

      if (payload.status === InvoiceStatus.COMPLETED) {
        this.applyCompletedInvoiceEffects(payload, totals.finalPayable);
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
          redeem_amount = @redeem_amount,
          gross_sale = @gross_sale,
          round_off = @round_off,
          final_payable = @final_payable,
          payment_channel = @payment_channel,
          coupon_code = @coupon_code,
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
        redeem_amount: payload.redeemAmount,
        gross_sale: totals.grossSale,
        round_off: payload.roundOff,
        final_payable: totals.finalPayable,
        payment_channel: paymentChannel,
        coupon_code: payload.couponCode || null,
        cashier_id: session.user.id,
        cashier_name: session.user.displayName,
      });

      this.replaceInvoiceItems(draftId, payload.items);

      if (payload.status === InvoiceStatus.COMPLETED) {
        this.applyCompletedInvoiceEffects(payload, totals.finalPayable);
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
    const lineDiscount = payload.items.reduce((sum, item) => sum + item.discountAmount, 0);
    const subtotal = payload.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const billDiscount =
      payload.billDiscountAmount > 0
        ? payload.billDiscountAmount
        : (subtotal * payload.billDiscountPercent) / 100;
    const discountTotal = lineDiscount + billDiscount;
    const taxTotal = 0;
    const taxableValue = Math.max(subtotal - discountTotal, 0);
    const grossSale = taxableValue;
    const finalBeforeRound = Math.max(grossSale - payload.redeemAmount, 0);
    const finalPayable = Math.round((finalBeforeRound + payload.roundOff) * 100) / 100;
    return { subtotal, discountTotal, taxTotal, taxableValue, grossSale, finalPayable };
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
  ): void {
    const db = getDatabase();
    const decrementStock = db.prepare(`
      UPDATE product_lots_local
      SET quantity_on_hand = quantity_on_hand - @delta, updated_at = datetime('now')
      WHERE id = @lot_id AND quantity_on_hand >= @delta
    `);

    for (const item of payload.items) {
      const result = decrementStock.run({ lot_id: item.lotId, delta: item.quantity });
      if (result.changes === 0) {
        throw new Error(`Insufficient stock for ${item.productName} (lot ${item.batchNumber})`);
      }
    }

    if (payload.saleType === SaleType.CREDIT_SALE && payload.customer) {
      db.prepare(
        'UPDATE pos_customers SET previous_due = previous_due + @amount WHERE id = @id',
      ).run({ amount: finalPayable, id: payload.customer.id });
    }
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
      customers: count(`SELECT COUNT(*) AS c FROM pos_customers WHERE is_synced = 0`),
      purchases: count(`SELECT COUNT(*) AS c FROM purchases_local WHERE is_synced = 0`),
      stock: count(`SELECT COUNT(*) AS c FROM stock_events_local WHERE is_synced = 0`),
      attendance: count(`SELECT COUNT(*) AS c FROM workforce_attendance_local WHERE is_synced = 0`),
    };
  }

  getUnsyncedCustomers(): Array<Record<string, unknown>> {
    return getDatabase()
      .prepare(`SELECT * FROM pos_customers WHERE is_synced = 0 ORDER BY updated_at ASC`)
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
    }));
  }

  upsertSupplierLocal(input: {
    name: string;
    mobile?: string;
    email?: string;
    gstin?: string;
  }): { id: string; name: string; mobile: string | null; email: string | null; gstin: string | null } {
    const name = input.name.trim();
    if (!name) throw new Error('Supplier name required');
    const id = uuidv4();
    getDatabase()
      .prepare(
        `INSERT INTO pos_suppliers (id, name, mobile, email, gstin, is_synced, updated_at)
         VALUES (@id, @name, @mobile, @email, @gstin, 0, datetime('now'))`,
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
    items: Array<{
      productId: string;
      productName: string;
      barcode?: string;
      quantity: number;
      purchaseRate: number;
      mrp: number;
      saleRate: number;
      gstPercent?: number;
    }>;
  }): Record<string, unknown> {
    if (!input.items.length) throw new Error('Purchase needs items');
    const config = this.getConfig();
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const subtotal = input.items.reduce((s, i) => s + i.quantity * i.purchaseRate, 0);
    const taxTotal = input.items.reduce(
      (s, i) => s + i.quantity * i.purchaseRate * ((i.gstPercent ?? 0) / 100),
      0,
    );
    const grandTotal = subtotal + taxTotal;

    const tx = getDatabase().transaction(() => {
      getDatabase()
        .prepare(
          `INSERT INTO purchases_local (
            id, tenant_id, facility_id, supplier_id, invoice_number, invoice_date,
            gst_mode, status, remark, other_charges, subtotal, tax_total, grand_total, is_synced, created_at
          ) VALUES (
            @id, @tenant_id, @facility_id, @supplier_id, @invoice_number, @invoice_date,
            'NON_GST', 'COMPLETED', @remark, 0, @subtotal, @tax_total, @grand_total, 0, @created_at
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
          created_at: createdAt,
        });

      const insertItem = getDatabase().prepare(
        `INSERT INTO purchase_items_local (
          id, purchase_id, product_id, product_name, barcode, quantity,
          purchase_rate, mrp, sale_rate, gst_percent, lot_id
        ) VALUES (
          @id, @purchase_id, @product_id, @product_name, @barcode, @quantity,
          @purchase_rate, @mrp, @sale_rate, @gst_percent, @lot_id
        )`,
      );

      for (const item of input.items) {
        const lotId = uuidv4();
        const existingLot = getDatabase()
          .prepare(
            `SELECT id FROM product_lots_local
             WHERE product_id = @product_id AND facility_id = @facility_id
             ORDER BY updated_at DESC LIMIT 1`,
          )
          .get({ product_id: item.productId, facility_id: config.facilityId }) as
          | { id: string }
          | undefined;

        const useLotId = existingLot?.id ?? lotId;
        if (!existingLot) {
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
              product_id: item.productId,
              product_name: item.productName,
              sku: item.productName.slice(0, 24),
              barcode: item.barcode ?? item.productId.slice(0, 13),
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
          product_id: item.productId,
          product_name: item.productName,
          barcode: item.barcode ?? null,
          quantity: item.quantity,
          purchase_rate: item.purchaseRate,
          mrp: item.mrp,
          sale_rate: item.saleRate,
          gst_percent: item.gstPercent ?? 0,
          lot_id: useLotId,
        });
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
      status: 'COMPLETED',
      isSynced: 0,
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
      `INSERT INTO pos_customers (id, name, mobile, email, previous_due, membership_card, loyalty_points, is_synced, updated_at)
       VALUES (@id, @name, @mobile, @email, @previous_due, @membership_card, @loyalty_points, 1, datetime('now'))
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

    const tx = db.transaction(() => {
      for (const c of payload.customers) {
        upsertCustomer.run({
          id: c.id,
          name: c.name,
          mobile: c.mobile,
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

  listInvoices(limit = 100): LocalOrderInvoice[] {
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
      isSynced: Number(row.is_synced),
      createdAt: String(row.created_at),
      items,
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
