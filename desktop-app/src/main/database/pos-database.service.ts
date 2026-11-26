import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './sqlite-manager';
import { AuthService } from './auth.service';
import {
  BarcodeResolutionResult,
  CartLineItem,
  CreateInvoicePayload,
  InvoiceStatus,
  LocalAttendanceRecord,
  LocalOrderInvoice,
  LocalProductLot,
  OrderOriginSource,
  PaymentChannel,
  PosConfig,
  PosCustomer,
  SaleType,
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

    const session = this.auth.getSession();
    if (!session) {
      throw new Error('You must be logged in to create an invoice');
    }

    const config = this.getConfig();
    const db = getDatabase();
    const invoiceId = uuidv4();
    const createdAt = new Date().toISOString();
    const invoiceNumber = this.nextInvoiceNumber(config.facilityId);

    const lineDiscount = payload.items.reduce((sum, item) => sum + item.discountAmount, 0);
    const subtotal = payload.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const taxTotal = payload.items.reduce((sum, item) => sum + item.calculatedTax, 0);
    const billDiscount =
      payload.billDiscountAmount > 0
        ? payload.billDiscountAmount
        : (subtotal * payload.billDiscountPercent) / 100;
    const discountTotal = lineDiscount + billDiscount;
    const taxableValue = Math.max(subtotal - billDiscount, 0);
    const grossSale = taxableValue + taxTotal;
    const finalBeforeRound = grossSale - payload.redeemAmount;
    const finalPayable = Math.round((finalBeforeRound + payload.roundOff) * 100) / 100;

    const customerPayload: Record<string, string> = payload.customer
      ? {
          name: payload.customer.name,
          phone: payload.customer.mobile,
          email: payload.customer.email ?? '',
          loyaltyId: payload.customer.membershipCard ?? '',
        }
      : { name: 'Walk-in Customer', phone: payload.customerMobile };

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
        subtotal,
        taxable_value: taxableValue,
        tax_total: taxTotal,
        discount_total: discountTotal,
        redeem_amount: payload.redeemAmount,
        gross_sale: grossSale,
        round_off: payload.roundOff,
        final_payable: finalPayable,
        payment_channel: paymentChannel,
        coupon_code: payload.couponCode || null,
        origin_source: OrderOriginSource.OFFLINE_POS,
        created_at: createdAt,
      });

      if (payload.status === InvoiceStatus.COMPLETED) {
        const decrementStock = db.prepare(`
          UPDATE product_lots_local
          SET quantity_on_hand = quantity_on_hand - @delta, updated_at = datetime('now')
          WHERE id = @lot_id AND quantity_on_hand >= @delta
        `);

        for (const item of payload.items) {
          db.prepare(`
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
          `).run({
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
            calculated_tax: item.calculatedTax,
            net_amount: item.netAmount,
          });

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
    });

    createTransaction();
    return this.getInvoiceById(invoiceId);
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

  private nextInvoiceNumber(facilityId: string): string {
    const db = getDatabase();
    db.prepare(
      'INSERT OR IGNORE INTO invoice_counter (facility_id, next_number) VALUES (@facility_id, 1)',
    ).run({ facility_id: facilityId });

    const row = db
      .prepare('SELECT next_number FROM invoice_counter WHERE facility_id = @facility_id')
      .get({ facility_id: facilityId }) as { next_number: number };

    const invoiceNumber = `INV-${String(row.next_number).padStart(6, '0')}`;
    db.prepare(
      'UPDATE invoice_counter SET next_number = next_number + 1 WHERE facility_id = @facility_id',
    ).run({ facility_id: facilityId });

    return invoiceNumber;
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
      .prepare('SELECT * FROM order_items_local WHERE order_id = @order_id')
      .all({ order_id: String(row.id) }) as Array<Record<string, unknown>>;

    const items: CartLineItem[] = itemRows.map((item) => ({
      lineId: String(item.id),
      productId: String(item.product_id),
      lotId: String(item.lot_id),
      barcode: String(item.barcode ?? ''),
      productName: '',
      productSku: '',
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
      expiryDate: '',
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
