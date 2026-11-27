import { In } from 'typeorm';
import { getDataSource } from '../database/data-source';
import {
  AccountEntry,
  AccountHead,
  Coupon,
  Customer,
  EcommerceOrder,
  Facility,
  FinancialSession,
  LotInventoryStock,
  OrderInvoice,
  OrderItem,
  Product,
  ProductLot,
  Purchase,
  PurchaseItem,
  Scheme,
  SmsMessage,
  StockMovement,
  StockTransfer,
  StocktakeLine,
  StocktakeSession,
  Supplier,
  User,
  AccountEntryType,
  EcommerceOrderStatus,
  Expense,
  ExpenseCategory,
  ExpenseSchedule,
  GstMode,
  PartyType,
  PurchasePaymentStatus,
  PurchaseStatus,
  SchemeType,
  SmsChannel,
  StockMovementType,
  StocktakeStatus,
  TransferStatus,
  UserRole,
  PaymentChannel,
  OrderOriginSource,
} from '../../models';
import bcrypt from 'bcryptjs';
import { createAccessToken } from '../security/jwt';
import { v4 as uuidv4 } from 'uuid';
import {
  applySupplierPayment,
  computeProfitLoss,
  computePurchasePayment,
  periodKeyFromDate,
  shouldPostSchedule,
} from './purchase-finance';

function num(value: unknown): number {
  return Number(value ?? 0);
}

export class ErpService {
  async login(usernameOrEmail: string, password: string): Promise<{
    token: string;
    user: { id: string; email: string; username: string | null; fullName: string; role: UserRole; tenantId: string };
  }> {
    const repo = getDataSource().getRepository(User);
    const user = await repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :id OR u.username = :id', { id: usernameOrEmail })
      .andWhere('u.isActive = true')
      .getOne();

    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }

    const token = createAccessToken({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async getDashboard(tenantId: string): Promise<Record<string, unknown>> {
    const ds = getDataSource();
    const [
      productCount,
      customerCount,
      supplierCount,
      purchaseCount,
      saleCount,
      openTransfers,
      activeSchemes,
      ecommerceOrders,
      criticalStock,
      recentSales,
    ] = await Promise.all([
      ds.getRepository(Product).count({ where: { tenantId, isActive: true } }),
      ds.getRepository(Customer).count({ where: { tenantId, isActive: true } }),
      ds.getRepository(Supplier).count({ where: { tenantId, isActive: true } }),
      ds.getRepository(Purchase).count({ where: { tenantId } }),
      ds.getRepository(OrderInvoice).count({ where: { tenantId } }),
      ds.getRepository(StockTransfer).count({ where: { tenantId, status: TransferStatus.PENDING } }),
      ds.getRepository(Scheme).count({ where: { tenantId, isActive: true } }),
      ds.getRepository(EcommerceOrder).count({ where: { tenantId } }),
      ds.getRepository(Product).count({ where: { tenantId, isActive: true } }),
      ds.getRepository(OrderInvoice).find({
        where: { tenantId },
        order: { createdAt: 'DESC' },
        take: 8,
      }),
    ]);

    const sales = await ds.getRepository(OrderInvoice).find({ where: { tenantId } });
    const purchases = await ds.getRepository(Purchase).find({ where: { tenantId, status: PurchaseStatus.COMPLETED } });
    const purchaseTotal = purchases.reduce((sum, p) => sum + num(p.grandTotal), 0);

    const completedSales = sales.filter((s) => s.status === 'COMPLETED' && s.saleType !== 'RETURN');
    const returnSales = sales.filter((s) => s.saleType === 'RETURN' && s.status === 'COMPLETED');
    const netSalesTotal =
      completedSales.reduce((sum, s) => sum + num(s.finalPayable), 0) -
      returnSales.reduce((sum, s) => sum + num(s.finalPayable), 0);
    const todayKey = new Date().toISOString().slice(0, 10);
    const monthKey = todayKey.slice(0, 7);
    const todaySales = completedSales.filter((s) => String(s.createdAt).slice(0, 10) === todayKey);
    const todayReturns = returnSales.filter((s) => String(s.createdAt).slice(0, 10) === todayKey);
    const todayOrders = [...todaySales, ...todayReturns].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const todayNet =
      todaySales.reduce((sum, s) => sum + num(s.finalPayable), 0) -
      todayReturns.reduce((sum, s) => sum + num(s.finalPayable), 0);
    const discountTotalToday = todaySales.reduce((sum, s) => sum + num(s.discountTotal), 0);

    const hourlyMap = new Map<number, { orders: number; sales: number }>();
    for (let h = 0; h < 24; h += 1) hourlyMap.set(h, { orders: 0, sales: 0 });
    for (const sale of todayOrders) {
      const hour = new Date(sale.createdAt).getHours();
      const bucket = hourlyMap.get(hour) ?? { orders: 0, sales: 0 };
      const signed = sale.saleType === 'RETURN' ? -num(sale.finalPayable) : num(sale.finalPayable);
      bucket.orders += 1;
      bucket.sales += signed;
      hourlyMap.set(hour, bucket);
    }
    const todayHourlyOrders = Array.from(hourlyMap.entries()).map(([hour, v]) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      orders: v.orders,
      sales: Math.round(v.sales * 100) / 100,
    }));

    const paymentMixMap = new Map<string, number>();
    for (const sale of todaySales) {
      const channel = String(sale.paymentChannel ?? 'OTHER');
      paymentMixMap.set(channel, (paymentMixMap.get(channel) ?? 0) + num(sale.finalPayable));
    }
    const paymentMixToday = Array.from(paymentMixMap.entries()).map(([channel, amount]) => ({
      channel,
      amount: Math.round(amount * 100) / 100,
    }));

    const newCustomersThisMonth = await ds
      .getRepository(Customer)
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.isActive = true')
      .andWhere(`to_char(c.createdAt, 'YYYY-MM') = :monthKey`, { monthKey })
      .getCount();

    const stockRows = await ds.getRepository(LotInventoryStock).find({ relations: ['lot', 'lot.product'] });
    const tenantStock = stockRows.filter((r) => r.lot?.product?.tenantId === tenantId);
    const outOfStockCount = tenantStock.filter((r) => num(r.quantityOnHand) <= 0).length;
    const stockValueAtCost = tenantStock.reduce(
      (sum, r) => sum + num(r.quantityOnHand) * num(r.lot?.costPrice ?? 0),
      0,
    );

    const qtyByProduct = new Map<
      string,
      { productId: string; productName: string; sku: string; qty: number; minStock: number }
    >();
    for (const row of tenantStock) {
      const product = row.lot?.product;
      if (!product) continue;
      const prev = qtyByProduct.get(product.id) ?? {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        qty: 0,
        minStock: num(product.minStock),
      };
      prev.qty += num(row.quantityOnHand);
      qtyByProduct.set(product.id, prev);
    }
    const lowStockItems = Array.from(qtyByProduct.values())
      .filter((p) => p.qty <= 0 || (p.minStock > 0 && p.qty <= p.minStock) || (p.minStock <= 0 && p.qty > 0 && p.qty <= 5))
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 8)
      .map((p) => ({
        productId: p.productId,
        productName: p.productName,
        sku: p.sku,
        quantityOnHand: p.qty,
        minStock: p.minStock,
      }));

    return {
      // Canonical + UI aliases
      productCount,
      totalProducts: productCount,
      customerCount,
      totalCustomers: customerCount,
      supplierCount,
      purchaseCount,
      saleCount,
      openTransfers,
      activeSchemes,
      ecommerceOrders,
      criticalStock,
      salesTotal: Math.round(netSalesTotal * 100) / 100,
      totalSales: Math.round(todayNet * 100) / 100,
      todayNetSales: Math.round(todayNet * 100) / 100,
      purchaseTotal: Math.round(purchaseTotal * 100) / 100,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      todayInvoiceCount: todayOrders.length,
      todayOrderCount: todayOrders.length,
      todayHourlyOrders,
      paymentMixToday,
      newCustomersThisMonth,
      discountTotalToday: Math.round(discountTotalToday * 100) / 100,
      outOfStockCount,
      stockValueAtCost: Math.round(stockValueAtCost * 100) / 100,
      recentSales: recentSales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        finalPayable: num(s.finalPayable),
        paymentChannel: s.paymentChannel,
        createdAt: s.createdAt,
        customerMobile: s.customerMobile,
      })),
    };
  }

  // ---------- Masters ----------
  async listProducts(tenantId: string, ecommerceOnly = false): Promise<Product[]> {
    const where: { tenantId: string; isActive: boolean; showOnEcommerce?: boolean } = {
      tenantId,
      isActive: true,
    };
    if (ecommerceOnly) where.showOnEcommerce = true;
    return getDataSource().getRepository(Product).find({ where, order: { name: 'ASC' } });
  }

  async upsertProduct(tenantId: string, payload: Partial<Product> & { name: string; sku: string; baseBarcode: string }): Promise<Product> {
    const repo = getDataSource().getRepository(Product);
    let product = payload.id ? await repo.findOne({ where: { id: payload.id, tenantId } }) : null;
    if (!product) {
      product = repo.create({ tenantId, isActive: true });
    }
    Object.assign(product, {
      name: payload.name,
      sku: payload.sku,
      baseBarcode: payload.baseBarcode,
      company: payload.company ?? product.company ?? null,
      size: payload.size ?? product.size ?? null,
      color: payload.color ?? product.color ?? null,
      hsnCode: payload.hsnCode ?? product.hsnCode ?? null,
      category: payload.category ?? product.category ?? null,
      brand: payload.brand ?? product.brand ?? null,
      subCategory: payload.subCategory ?? product.subCategory ?? null,
      unit: payload.unit ?? product.unit ?? 'PCS',
      gstPercent: payload.gstPercent ?? product.gstPercent ?? 0,
      saleRate: payload.saleRate ?? product.saleRate ?? 0,
      mrp: payload.mrp ?? product.mrp ?? 0,
      purchaseRate: payload.purchaseRate ?? product.purchaseRate ?? 0,
      minStock: payload.minStock ?? product.minStock ?? 0,
      maxStock: payload.maxStock ?? product.maxStock ?? 0,
      description: payload.description ?? product.description ?? null,
      imageUrl: payload.imageUrl ?? product.imageUrl ?? null,
      showOnEcommerce: payload.showOnEcommerce ?? product.showOnEcommerce ?? false,
      isActive: payload.isActive ?? true,
    });
    return repo.save(product);
  }

  async listCustomers(tenantId: string): Promise<Customer[]> {
    return getDataSource().getRepository(Customer).find({ where: { tenantId }, order: { name: 'ASC' } });
  }

  async upsertCustomer(tenantId: string, payload: Partial<Customer> & { name: string; mobile: string }): Promise<Customer> {
    const repo = getDataSource().getRepository(Customer);
    let row = payload.id ? await repo.findOne({ where: { id: payload.id, tenantId } }) : null;
    if (!row && payload.mobile) {
      row = await repo.findOne({ where: { tenantId, mobile: payload.mobile } });
    }
    if (!row) {
      row = repo.create({ tenantId, isActive: true, outstandingDue: 0, creditLimit: 0 });
      if (payload.id) row.id = payload.id;
    }
    Object.assign(row, {
      name: payload.name,
      mobile: payload.mobile,
      email: payload.email ?? row.email ?? null,
      address: payload.address ?? row.address ?? null,
      city: payload.city ?? row.city ?? null,
      state: payload.state ?? row.state ?? null,
      pincode: payload.pincode ?? row.pincode ?? null,
      gstin: payload.gstin ?? row.gstin ?? null,
      membershipCard: payload.membershipCard ?? row.membershipCard ?? null,
      discountPercent: payload.discountPercent ?? row.discountPercent ?? 0,
      priceType: payload.priceType ?? row.priceType ?? 'MRP',
      creditLimit: payload.creditLimit ?? row.creditLimit ?? 0,
      outstandingDue: payload.outstandingDue ?? row.outstandingDue ?? 0,
      isActive: payload.isActive ?? true,
    });
    if (payload.passwordHash) row.passwordHash = payload.passwordHash;
    return repo.save(row);
  }

  async listSuppliers(tenantId: string): Promise<Supplier[]> {
    return getDataSource().getRepository(Supplier).find({ where: { tenantId }, order: { name: 'ASC' } });
  }

  async upsertSupplier(tenantId: string, payload: Partial<Supplier> & { name: string }): Promise<Supplier> {
    const repo = getDataSource().getRepository(Supplier);
    let row = payload.id ? await repo.findOne({ where: { id: payload.id, tenantId } }) : null;
    if (!row) row = repo.create({ tenantId, isActive: true, outstandingDue: 0 });
    Object.assign(row, {
      name: payload.name,
      mobile: payload.mobile ?? row.mobile ?? null,
      email: payload.email ?? row.email ?? null,
      address: payload.address ?? row.address ?? null,
      state: payload.state ?? row.state ?? null,
      gstin: payload.gstin ?? row.gstin ?? null,
      isActive: payload.isActive ?? true,
    });
    return repo.save(row);
  }

  async listOperators(tenantId: string): Promise<User[]> {
    return getDataSource()
      .getRepository(User)
      .find({
        where: { tenantId, role: In([UserRole.MART_ADMIN, UserRole.STORE_MANAGER, UserRole.CASHIER, UserRole.SALESMAN]) },
        order: { fullName: 'ASC' },
      });
  }

  async upsertOperator(
    tenantId: string,
    payload: { id?: string; email: string; username?: string; fullName: string; mobile?: string; role: UserRole; password?: string; isActive?: boolean },
  ): Promise<User> {
    const repo = getDataSource().getRepository(User);
    let row = payload.id
      ? await repo.createQueryBuilder('u').addSelect('u.passwordHash').where('u.id = :id AND u.tenantId = :tenantId', { id: payload.id, tenantId }).getOne()
      : null;
    if (!row) {
      row = repo.create({ tenantId, isActive: true, passwordHash: await bcrypt.hash(payload.password ?? 'admin123', 10) });
    }
    Object.assign(row, {
      email: payload.email,
      username: payload.username ?? row.username ?? null,
      fullName: payload.fullName,
      mobile: payload.mobile ?? row.mobile ?? null,
      role: payload.role,
      isActive: payload.isActive ?? true,
    });
    if (payload.password) row.passwordHash = await bcrypt.hash(payload.password, 10);
    return repo.save(row);
  }

  async listFacilities(tenantId: string): Promise<Facility[]> {
    return getDataSource().getRepository(Facility).find({ where: { tenantId }, order: { name: 'ASC' } });
  }

  async listSessions(tenantId: string): Promise<FinancialSession[]> {
    return getDataSource().getRepository(FinancialSession).find({ where: { tenantId }, order: { startDate: 'DESC' } });
  }

  // ---------- Purchase ----------
  async listPurchases(tenantId: string): Promise<Purchase[]> {
    return getDataSource().getRepository(Purchase).find({
      where: { tenantId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async createPurchase(
    tenantId: string,
    payload: {
      id?: string;
      facilityId: string;
      supplierId: string;
      invoiceNumber?: string;
      invoiceDate: string;
      gstMode?: GstMode;
      remark?: string;
      status?: PurchaseStatus;
      otherCharges?: number;
      paidAmount?: number;
      paymentMode?: string;
      items: Array<{
        productId?: string;
        productName: string;
        barcode?: string;
        sku?: string;
        brand?: string;
        category?: string;
        hsnCode?: string;
        quantity: number;
        purchaseRate: number;
        mrp: number;
        saleRate: number;
        gstPercent?: number;
        isNewProduct?: boolean;
      }>;
    },
  ): Promise<Purchase> {
    const ds = getDataSource();
    return ds.transaction(async (manager) => {
      if (payload.id) {
        const existing = await manager.findOne(Purchase, { where: { id: payload.id }, relations: ['items'] });
        if (existing) return existing;
      }
      if (!payload.items?.length) {
        throw Object.assign(new Error('Purchase needs at least one line'), { status: 400 });
      }

      const resolvedItems: PurchaseItem[] = [];
      for (const item of payload.items) {
        let productId = item.productId;
        if (productId && !item.isNewProduct) {
          const product = await manager.findOne(Product, { where: { id: productId, tenantId } });
          if (!product) {
            throw Object.assign(new Error(`Product not found: ${item.productName}`), { status: 400 });
          }
        } else {
          const existingById =
            productId != null
              ? await manager.findOne(Product, { where: { id: productId, tenantId } })
              : null;
          if (existingById) {
            productId = existingById.id;
          } else {
            const sku =
              (item.sku || item.barcode || `SKU-${Date.now()}-${Math.floor(Math.random() * 999)}`).slice(
                0,
                64,
              );
            const barcode = (item.barcode || sku).slice(0, 64);
            const created = await manager.save(
              manager.create(Product, {
                ...(productId ? { id: productId } : {}),
                tenantId,
                name: item.productName,
                sku,
                baseBarcode: barcode,
                brand: item.brand ?? null,
                category: item.category ?? null,
                hsnCode: item.hsnCode ?? null,
                unit: 'PCS',
                gstPercent: item.gstPercent ?? 0,
                saleRate: item.saleRate,
                mrp: item.mrp,
                purchaseRate: item.purchaseRate,
                minStock: 0,
                maxStock: 0,
                isActive: true,
                showOnEcommerce: false,
              }),
            );
            productId = created.id;
          }
        }

        const lineTotal = item.quantity * item.purchaseRate;
        resolvedItems.push(
          manager.create(PurchaseItem, {
            productId,
            productName: item.productName,
            barcode: item.barcode ?? null,
            quantity: item.quantity,
            purchaseRate: item.purchaseRate,
            mrp: item.mrp,
            saleRate: item.saleRate,
            lotId: null,
            gstPercent: 0,
            lineTotal,
          }),
        );
      }

      const subtotal = resolvedItems.reduce((s, i) => s + num(i.lineTotal), 0);
      const taxTotal = 0;
      const otherCharges = payload.otherCharges ?? 0;
      const grandTotal = subtotal + taxTotal + otherCharges;
      const pay = computePurchasePayment(grandTotal, payload.paidAmount ?? 0);

      const purchase = manager.create(Purchase, {
        ...(payload.id ? { id: payload.id } : {}),
        tenantId,
        facilityId: payload.facilityId,
        supplierId: payload.supplierId,
        invoiceNumber: payload.invoiceNumber ?? null,
        invoiceDate: payload.invoiceDate,
        gstMode: payload.gstMode ?? GstMode.NON_GST,
        status: payload.status ?? PurchaseStatus.COMPLETED,
        remark: payload.remark ?? null,
        subtotal,
        taxTotal,
        otherCharges,
        grandTotal,
        paidAmount: pay.paidAmount,
        dueAmount: pay.dueAmount,
        paymentStatus: pay.paymentStatus as PurchasePaymentStatus,
        paymentMode: pay.paidAmount > 0 ? (payload.paymentMode ?? 'CASH') : null,
        items: resolvedItems,
      });
      const saved = await manager.save(purchase);

      if (saved.status === PurchaseStatus.COMPLETED) {
        for (const item of saved.items) {
          const product = await manager.findOneOrFail(Product, { where: { id: item.productId, tenantId } });
          let lot = await manager
            .getRepository(ProductLot)
            .createQueryBuilder('lot')
            .where('lot.productId = :productId', { productId: product.id })
            .orderBy('lot.createdAt', 'DESC')
            .getOne();
          if (!lot) {
            lot = await manager.save(
              manager.create(ProductLot, {
                productId: product.id,
                batchNumber: `PUR-${saved.invoiceNumber ?? saved.id.slice(0, 8)}`,
                costPrice: item.purchaseRate,
                mrp: item.mrp,
                manufactureDate: new Date(),
                expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
                lotBarcode: `LOT-${product.sku}-${Date.now()}`,
                isActive: true,
              }),
            );
          }
          let stock = await manager.findOne(LotInventoryStock, {
            where: { lotId: lot.id, facilityId: payload.facilityId },
          });
          if (!stock) {
            stock = manager.create(LotInventoryStock, {
              lotId: lot.id,
              facilityId: payload.facilityId,
              quantityOnHand: 0,
              aisleShelfLocation: null,
            });
          }
          stock.quantityOnHand = num(stock.quantityOnHand) + num(item.quantity);
          await manager.save(stock);
          item.lotId = lot.id;
          await manager.save(item);
          await manager.save(
            manager.create(StockMovement, {
              tenantId,
              facilityId: payload.facilityId,
              productId: product.id,
              lotId: lot.id,
              movementType: StockMovementType.PURCHASE,
              quantity: item.quantity,
              remark: `Purchase ${saved.invoiceNumber ?? saved.id}`,
              referenceId: saved.id,
            }),
          );
        }

        const supplier = await manager.findOne(Supplier, { where: { id: payload.supplierId, tenantId } });
        if (supplier && pay.dueAmount > 0) {
          supplier.outstandingDue = num(supplier.outstandingDue) + pay.dueAmount;
          await manager.save(supplier);
          await manager.save(
            manager.create(AccountEntry, {
              tenantId,
              entryType: AccountEntryType.BILL,
              accountHeadId: null,
              partyType: PartyType.SUPPLIER,
              partyId: supplier.id,
              partyName: supplier.name,
              entryDate: payload.invoiceDate,
              amount: pay.dueAmount,
              paymentMode: null,
              narration: `Purchase due ${saved.invoiceNumber ?? saved.id}`,
              referenceNo: saved.id,
            }),
          );
        }
        if (supplier && pay.paidAmount > 0) {
          await manager.save(
            manager.create(AccountEntry, {
              tenantId,
              entryType: AccountEntryType.PAYMENT,
              accountHeadId: null,
              partyType: PartyType.SUPPLIER,
              partyId: supplier.id,
              partyName: supplier.name,
              entryDate: payload.invoiceDate,
              amount: pay.paidAmount,
              paymentMode: saved.paymentMode,
              narration: `Purchase payment ${saved.invoiceNumber ?? saved.id}`,
              referenceNo: saved.id,
            }),
          );
        }
      }
      return manager.findOneOrFail(Purchase, { where: { id: saved.id }, relations: ['items'] });
    });
  }

  async paySupplier(
    tenantId: string,
    payload: {
      id?: string;
      supplierId: string;
      amount: number;
      paymentMode: string;
      entryDate: string;
      remark?: string;
      referenceNo?: string;
    },
  ): Promise<{ supplier: Supplier; entry: AccountEntry }> {
    const ds = getDataSource();
    return ds.transaction(async (manager) => {
      if (payload.id) {
        const existing = await manager.findOne(AccountEntry, { where: { id: payload.id, tenantId } });
        if (existing) {
          const supplier = await manager.findOneOrFail(Supplier, {
            where: { id: payload.supplierId, tenantId },
          });
          return { supplier, entry: existing };
        }
      }
      const supplier = await manager.findOne(Supplier, { where: { id: payload.supplierId, tenantId } });
      if (!supplier) throw Object.assign(new Error('Supplier not found'), { status: 404 });
      const { newDue, applied } = applySupplierPayment(num(supplier.outstandingDue), payload.amount);
      if (applied <= 0) throw Object.assign(new Error('Nothing to pay'), { status: 400 });
      supplier.outstandingDue = newDue;
      await manager.save(supplier);
      const entry = await manager.save(
        manager.create(AccountEntry, {
          ...(payload.id ? { id: payload.id } : {}),
          tenantId,
          entryType: AccountEntryType.PAYMENT,
          accountHeadId: null,
          partyType: PartyType.SUPPLIER,
          partyId: supplier.id,
          partyName: supplier.name,
          entryDate: payload.entryDate,
          amount: applied,
          paymentMode: payload.paymentMode,
          narration: payload.remark ?? 'Supplier payment',
          referenceNo: payload.referenceNo ?? payload.id ?? null,
        }),
      );
      return { supplier, entry };
    });
  }

  async getSupplierLedger(tenantId: string, supplierId: string): Promise<Record<string, unknown>> {
    const supplier = await getDataSource().getRepository(Supplier).findOne({ where: { id: supplierId, tenantId } });
    if (!supplier) throw Object.assign(new Error('Supplier not found'), { status: 404 });
    const purchases = await getDataSource().getRepository(Purchase).find({
      where: { tenantId, supplierId },
      order: { invoiceDate: 'DESC', createdAt: 'DESC' },
      take: 100,
    });
    const entries = await getDataSource().getRepository(AccountEntry).find({
      where: { tenantId, partyType: PartyType.SUPPLIER, partyId: supplierId },
      order: { entryDate: 'DESC', createdAt: 'DESC' },
      take: 200,
    });
    return {
      supplier,
      outstandingDue: num(supplier.outstandingDue),
      purchases,
      entries,
    };
  }

  // ---------- Stock ----------
  async listStock(tenantId: string, facilityId?: string): Promise<Array<Record<string, unknown>>> {
    const qb = getDataSource()
      .getRepository(LotInventoryStock)
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.lot', 'lot')
      .innerJoinAndSelect('lot.product', 'product')
      .where('product.tenantId = :tenantId', { tenantId });
    if (facilityId) qb.andWhere('s.facilityId = :facilityId', { facilityId });
    const rows = await qb.getMany();
    return rows.map((s) => ({
      stockId: s.id,
      facilityId: s.facilityId,
      quantityOnHand: num(s.quantityOnHand),
      aisleShelfLocation: s.aisleShelfLocation,
      lotId: s.lot.id,
      batchNumber: s.lot.batchNumber,
      mrp: num(s.lot.mrp),
      costPrice: num(s.lot.costPrice),
      expiryDate: s.lot.expiryDate,
      lotBarcode: s.lot.lotBarcode,
      productId: s.lot.product.id,
      productName: s.lot.product.name,
      sku: s.lot.product.sku,
      category: s.lot.product.category,
      brand: s.lot.product.brand,
      minStock: s.lot.product.minStock,
      maxStock: s.lot.product.maxStock,
    }));
  }

  async dumpStock(
    tenantId: string,
    payload: { facilityId: string; productId: string; lotId: string; quantity: number; remark?: string },
  ): Promise<StockMovement> {
    const ds = getDataSource();
    return ds.transaction(async (manager) => {
      const stock = await manager.findOne(LotInventoryStock, {
        where: { lotId: payload.lotId, facilityId: payload.facilityId },
      });
      if (!stock || num(stock.quantityOnHand) < payload.quantity) {
        throw Object.assign(new Error('Insufficient stock to dump'), { status: 400 });
      }
      stock.quantityOnHand = num(stock.quantityOnHand) - payload.quantity;
      await manager.save(stock);
      return manager.save(
        manager.create(StockMovement, {
          tenantId,
          facilityId: payload.facilityId,
          productId: payload.productId,
          lotId: payload.lotId,
          movementType: StockMovementType.DUMP,
          quantity: payload.quantity,
          remark: payload.remark ?? 'Stock dump',
          referenceId: null,
        }),
      );
    });
  }

  async correctStock(
    tenantId: string,
    payload: { facilityId: string; productId: string; lotId: string; newQuantity: number; remark?: string },
  ): Promise<StockMovement> {
    const ds = getDataSource();
    return ds.transaction(async (manager) => {
      const stock = await manager.findOne(LotInventoryStock, {
        where: { lotId: payload.lotId, facilityId: payload.facilityId },
      });
      if (!stock) throw Object.assign(new Error('Stock row not found'), { status: 404 });
      const delta = payload.newQuantity - num(stock.quantityOnHand);
      stock.quantityOnHand = payload.newQuantity;
      await manager.save(stock);
      return manager.save(
        manager.create(StockMovement, {
          tenantId,
          facilityId: payload.facilityId,
          productId: payload.productId,
          lotId: payload.lotId,
          movementType: StockMovementType.CORRECTION,
          quantity: delta,
          remark: payload.remark ?? 'Stock correction',
          referenceId: null,
        }),
      );
    });
  }

  async listTransfers(tenantId: string): Promise<StockTransfer[]> {
    return getDataSource().getRepository(StockTransfer).find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async createTransfer(
    tenantId: string,
    payload: {
      fromFacilityId: string;
      toFacilityId: string;
      productId: string;
      lotId: string;
      quantity: number;
      transportDetail?: string;
      remark?: string;
    },
  ): Promise<StockTransfer> {
    const ds = getDataSource();
    return ds.transaction(async (manager) => {
      const fromStock = await manager.findOne(LotInventoryStock, {
        where: { lotId: payload.lotId, facilityId: payload.fromFacilityId },
      });
      if (!fromStock || num(fromStock.quantityOnHand) < payload.quantity) {
        throw Object.assign(new Error('Insufficient stock for transfer'), { status: 400 });
      }
      fromStock.quantityOnHand = num(fromStock.quantityOnHand) - payload.quantity;
      await manager.save(fromStock);

      let toStock = await manager.findOne(LotInventoryStock, {
        where: { lotId: payload.lotId, facilityId: payload.toFacilityId },
      });
      if (!toStock) {
        toStock = manager.create(LotInventoryStock, {
          lotId: payload.lotId,
          facilityId: payload.toFacilityId,
          quantityOnHand: 0,
          aisleShelfLocation: null,
        });
      }
      toStock.quantityOnHand = num(toStock.quantityOnHand) + payload.quantity;
      await manager.save(toStock);

      const transfer = await manager.save(
        manager.create(StockTransfer, {
          tenantId,
          fromFacilityId: payload.fromFacilityId,
          toFacilityId: payload.toFacilityId,
          productId: payload.productId,
          lotId: payload.lotId,
          quantity: payload.quantity,
          status: TransferStatus.RECEIVED,
          transportDetail: payload.transportDetail ?? null,
          remark: payload.remark ?? null,
        }),
      );

      await manager.save([
        manager.create(StockMovement, {
          tenantId,
          facilityId: payload.fromFacilityId,
          productId: payload.productId,
          lotId: payload.lotId,
          movementType: StockMovementType.TRANSFER_OUT,
          quantity: payload.quantity,
          remark: payload.remark ?? null,
          referenceId: transfer.id,
        }),
        manager.create(StockMovement, {
          tenantId,
          facilityId: payload.toFacilityId,
          productId: payload.productId,
          lotId: payload.lotId,
          movementType: StockMovementType.TRANSFER_IN,
          quantity: payload.quantity,
          remark: payload.remark ?? null,
          referenceId: transfer.id,
        }),
      ]);

      return transfer;
    });
  }

  async listMovements(tenantId: string): Promise<StockMovement[]> {
    return getDataSource().getRepository(StockMovement).find({ where: { tenantId }, order: { createdAt: 'DESC' }, take: 200 });
  }

  // ---------- Stocktake ----------
  async startStocktake(
    tenantId: string,
    payload: { facilityId: string; startedBy: string; remark?: string },
  ): Promise<StocktakeSession> {
    const ds = getDataSource();
    return ds.transaction(async (manager) => {
      const session = await manager.save(
        manager.create(StocktakeSession, {
          tenantId,
          facilityId: payload.facilityId,
          startedBy: payload.startedBy,
          status: StocktakeStatus.IN_PROGRESS,
          remark: payload.remark ?? null,
          committedAt: null,
        }),
      );

      const stocks = await manager.find(LotInventoryStock, {
        where: { facilityId: payload.facilityId },
        relations: ['lot'],
      });

      for (const stock of stocks) {
        await manager.save(
          manager.create(StocktakeLine, {
            sessionId: session.id,
            productId: stock.lot.productId,
            lotId: stock.lotId,
            expectedQty: num(stock.quantityOnHand),
            countedQty: null,
            remark: null,
          }),
        );
      }

      return manager.findOneOrFail(StocktakeSession, {
        where: { id: session.id },
        relations: ['lines'],
      });
    });
  }

  async listStocktakes(tenantId: string, facilityId?: string): Promise<StocktakeSession[]> {
    const where: { tenantId: string; facilityId?: string } = { tenantId };
    if (facilityId) where.facilityId = facilityId;
    return getDataSource()
      .getRepository(StocktakeSession)
      .find({ where, relations: ['lines'], order: { createdAt: 'DESC' }, take: 50 });
  }

  async getStocktake(tenantId: string, sessionId: string): Promise<StocktakeSession> {
    const session = await getDataSource()
      .getRepository(StocktakeSession)
      .findOne({ where: { id: sessionId, tenantId }, relations: ['lines'] });
    if (!session) throw Object.assign(new Error('Stocktake not found'), { status: 404 });
    return session;
  }

  async updateStocktakeCount(
    tenantId: string,
    payload: { sessionId: string; lotId: string; countedQty: number; remark?: string },
  ): Promise<StocktakeSession> {
    const session = await this.getStocktake(tenantId, payload.sessionId);
    if (session.status !== StocktakeStatus.IN_PROGRESS) {
      throw Object.assign(new Error('Stocktake is not in progress'), { status: 400 });
    }
    const line = session.lines.find((l) => l.lotId === payload.lotId);
    if (!line) throw Object.assign(new Error('Stocktake line not found'), { status: 404 });
    line.countedQty = payload.countedQty;
    line.remark = payload.remark ?? line.remark;
    await getDataSource().getRepository(StocktakeLine).save(line);
    return this.getStocktake(tenantId, payload.sessionId);
  }

  async commitStocktake(tenantId: string, sessionId: string): Promise<StocktakeSession> {
    const ds = getDataSource();
    return ds.transaction(async (manager) => {
      const session = await manager.findOne(StocktakeSession, {
        where: { id: sessionId, tenantId },
        relations: ['lines'],
      });
      if (!session) throw Object.assign(new Error('Stocktake not found'), { status: 404 });
      if (session.status !== StocktakeStatus.IN_PROGRESS) {
        throw Object.assign(new Error('Stocktake is not in progress'), { status: 400 });
      }

      for (const line of session.lines) {
        if (line.countedQty == null) continue;
        const expected = num(line.expectedQty);
        const counted = num(line.countedQty);
        const variance = counted - expected;
        if (variance === 0) continue;

        const stock = await manager.findOne(LotInventoryStock, {
          where: { lotId: line.lotId, facilityId: session.facilityId },
        });
        if (!stock) continue;
        stock.quantityOnHand = counted;
        await manager.save(stock);
        await manager.save(
          manager.create(StockMovement, {
            tenantId,
            facilityId: session.facilityId,
            productId: line.productId,
            lotId: line.lotId,
            movementType: StockMovementType.AUDIT,
            quantity: Math.abs(variance),
            remark: `Stocktake ${sessionId} variance ${variance}`,
            referenceId: sessionId,
          }),
        );
      }

      session.status = StocktakeStatus.COMMITTED;
      session.committedAt = new Date();
      await manager.save(session);
      return manager.findOneOrFail(StocktakeSession, {
        where: { id: sessionId },
        relations: ['lines'],
      });
    });
  }

  async cancelStocktake(tenantId: string, sessionId: string): Promise<StocktakeSession> {
    const session = await this.getStocktake(tenantId, sessionId);
    if (session.status !== StocktakeStatus.IN_PROGRESS) {
      throw Object.assign(new Error('Only in-progress stocktakes can be cancelled'), { status: 400 });
    }
    session.status = StocktakeStatus.CANCELLED;
    return getDataSource().getRepository(StocktakeSession).save(session);
  }

  // ---------- Schemes ----------
  async listSchemes(tenantId: string): Promise<Scheme[]> {
    return getDataSource().getRepository(Scheme).find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async upsertScheme(tenantId: string, payload: Partial<Scheme> & { name: string; schemeType: SchemeType }): Promise<Scheme> {
    const repo = getDataSource().getRepository(Scheme);
    let row = payload.id ? await repo.findOne({ where: { id: payload.id, tenantId } }) : null;
    if (!row) row = repo.create({ tenantId, isActive: true });
    Object.assign(row, {
      name: payload.name,
      schemeType: payload.schemeType,
      description: payload.description ?? row.description ?? null,
      buyQuantity: payload.buyQuantity ?? row.buyQuantity ?? 0,
      getQuantity: payload.getQuantity ?? row.getQuantity ?? 0,
      discountPercent: payload.discountPercent ?? row.discountPercent ?? 0,
      minBillAmount: payload.minBillAmount ?? row.minBillAmount ?? 0,
      startDate: payload.startDate ?? row.startDate ?? null,
      endDate: payload.endDate ?? row.endDate ?? null,
      isActive: payload.isActive ?? true,
    });
    return repo.save(row);
  }

  // ---------- Sales ----------
  async listSales(tenantId: string, limit = 3000): Promise<OrderInvoice[]> {
    const take = Math.min(Math.max(1, limit || 3000), 5000);
    return getDataSource().getRepository(OrderInvoice).find({
      where: { tenantId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
      take,
    });
  }

  async createSale(
    tenantId: string,
    payload: {
      facilityId: string;
      cashierId: string;
      customerMobile?: string;
      customerName?: string;
      paymentChannel: PaymentChannel;
      originSource: OrderOriginSource;
      discountTotal?: number;
      items: Array<{ productId: string; lotId: string; quantity: number; unitPrice: number }>;
    },
  ): Promise<OrderInvoice> {
    const ds = getDataSource();
    return ds.transaction(async (manager) => {
      const id = uuidv4();
      const invoiceNumber = this.buildDatetimeInvoiceNumber();
      let subtotal = 0;
      let taxTotal = 0;
      const orderItems: OrderItem[] = [];

      for (const item of payload.items) {
        const stock = await manager.findOne(LotInventoryStock, {
          where: { lotId: item.lotId, facilityId: payload.facilityId },
        });
        if (!stock || num(stock.quantityOnHand) < item.quantity) {
          throw Object.assign(new Error(`Insufficient stock for lot ${item.lotId}`), { status: 400 });
        }
        stock.quantityOnHand = num(stock.quantityOnHand) - item.quantity;
        await manager.save(stock);

        // Tax-off policy for this cycle: prices are final; GST breakup deferred.
        const net = item.unitPrice * item.quantity;
        const tax = 0;
        subtotal += net;
        taxTotal += tax;
        orderItems.push(
          manager.create(OrderItem, {
            orderId: id,
            productId: item.productId,
            lotId: item.lotId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            calculatedTax: tax,
            netAmount: net,
            discountPercent: 0,
            discountAmount: 0,
            mrp: item.unitPrice,
          }),
        );

        await manager.save(
          manager.create(StockMovement, {
            tenantId,
            facilityId: payload.facilityId,
            productId: item.productId,
            lotId: item.lotId,
            movementType: StockMovementType.SALE,
            quantity: item.quantity,
            remark: invoiceNumber,
            referenceId: id,
          }),
        );
      }

      const discountTotal = payload.discountTotal ?? 0;
      const finalPayable = Math.max(0, subtotal + taxTotal - discountTotal);
      const order = manager.create(OrderInvoice, {
        id,
        tenantId,
        facilityId: payload.facilityId,
        cashierId: payload.cashierId,
        customerPayload: {
          name: payload.customerName ?? 'Walk-in',
          phone: payload.customerMobile ?? '',
        },
        customerMobile: payload.customerMobile ?? null,
        invoiceNumber,
        subtotal,
        taxTotal,
        discountTotal,
        taxableValue: subtotal,
        grossSale: subtotal + taxTotal,
        finalPayable,
        paymentChannel: payload.paymentChannel,
        originSource: payload.originSource,
        isSynced: true,
        status: 'COMPLETED',
        saleType: 'CASH_SALE',
      });
      await manager.save(order);
      await manager.save(orderItems);

      return manager.findOneOrFail(OrderInvoice, { where: { id }, relations: ['items'] });
    });
  }

  // ---------- Accounts ----------
  async listAccountHeads(tenantId: string): Promise<AccountHead[]> {
    return getDataSource().getRepository(AccountHead).find({ where: { tenantId }, order: { name: 'ASC' } });
  }

  async upsertAccountHead(tenantId: string, payload: Partial<AccountHead> & { name: string; groupName: string }): Promise<AccountHead> {
    const repo = getDataSource().getRepository(AccountHead);
    let row = payload.id ? await repo.findOne({ where: { id: payload.id, tenantId } }) : null;
    if (!row) row = repo.create({ tenantId, isActive: true, openingBalance: 0, nature: 'ASSET' });
    Object.assign(row, {
      name: payload.name,
      groupName: payload.groupName,
      nature: payload.nature ?? row.nature,
      openingBalance: payload.openingBalance ?? row.openingBalance,
      isActive: payload.isActive ?? true,
    });
    return repo.save(row);
  }

  async listAccountEntries(tenantId: string, partyType?: PartyType): Promise<AccountEntry[]> {
    const where: { tenantId: string; partyType?: PartyType } = { tenantId };
    if (partyType) where.partyType = partyType;
    return getDataSource().getRepository(AccountEntry).find({ where, order: { entryDate: 'DESC', createdAt: 'DESC' } });
  }

  async createAccountEntry(
    tenantId: string,
    payload: {
      entryType: AccountEntryType;
      accountHeadId?: string;
      partyType?: PartyType;
      partyId?: string;
      partyName?: string;
      entryDate: string;
      amount: number;
      paymentMode?: string;
      narration?: string;
      referenceNo?: string;
    },
  ): Promise<AccountEntry> {
    const repo = getDataSource().getRepository(AccountEntry);
    return repo.save(
      repo.create({
        tenantId,
        entryType: payload.entryType,
        accountHeadId: payload.accountHeadId ?? null,
        partyType: payload.partyType ?? null,
        partyId: payload.partyId ?? null,
        partyName: payload.partyName ?? null,
        entryDate: payload.entryDate,
        amount: payload.amount,
        paymentMode: payload.paymentMode ?? null,
        narration: payload.narration ?? null,
        referenceNo: payload.referenceNo ?? null,
      }),
    );
  }

  // ---------- SMS ----------
  async listSms(tenantId: string): Promise<SmsMessage[]> {
    return getDataSource().getRepository(SmsMessage).find({ where: { tenantId }, order: { createdAt: 'DESC' }, take: 200 });
  }

  async sendSms(tenantId: string, payload: { channel: SmsChannel; mobile: string; message: string; templateName?: string }): Promise<SmsMessage> {
    const repo = getDataSource().getRepository(SmsMessage);
    return repo.save(
      repo.create({
        tenantId,
        channel: payload.channel,
        mobile: payload.mobile,
        message: payload.message,
        templateName: payload.templateName ?? null,
        status: 'SENT',
      }),
    );
  }

  // ---------- eComm ----------
  async listCoupons(tenantId: string): Promise<Coupon[]> {
    return getDataSource().getRepository(Coupon).find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async upsertCoupon(tenantId: string, payload: Partial<Coupon> & { code: string; title: string }): Promise<Coupon> {
    const repo = getDataSource().getRepository(Coupon);
    let row = payload.id ? await repo.findOne({ where: { id: payload.id, tenantId } }) : null;
    if (!row) row = repo.create({ tenantId, isActive: true });
    Object.assign(row, {
      code: payload.code,
      title: payload.title,
      percentOff: payload.percentOff ?? row.percentOff ?? 0,
      flatOff: payload.flatOff ?? row.flatOff ?? 0,
      minOrderAmount: payload.minOrderAmount ?? row.minOrderAmount ?? 0,
      validFrom: payload.validFrom ?? row.validFrom ?? null,
      validTo: payload.validTo ?? row.validTo ?? null,
      isActive: payload.isActive ?? true,
    });
    return repo.save(row);
  }

  async listEcommerceOrders(tenantId: string): Promise<EcommerceOrder[]> {
    return getDataSource().getRepository(EcommerceOrder).find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async placeEcommerceOrder(
    tenantId: string,
    payload: {
      customerId?: string;
      customerName: string;
      customerMobile: string;
      shippingAddress: string;
      pincode?: string;
      couponCode?: string;
      paymentChannel?: PaymentChannel;
      items: Array<{ productId: string; name: string; quantity: number; unitPrice: number }>;
    },
  ): Promise<EcommerceOrder> {
    const repo = getDataSource().getRepository(EcommerceOrder);
    const items = payload.items.map((i) => ({ ...i, lineTotal: i.quantity * i.unitPrice }));
    let subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    let discountTotal = 0;
    if (payload.couponCode) {
      const coupon = await getDataSource().getRepository(Coupon).findOne({
        where: { tenantId, code: payload.couponCode, isActive: true },
      });
      if (coupon && subtotal >= num(coupon.minOrderAmount)) {
        discountTotal = num(coupon.flatOff) + (subtotal * num(coupon.percentOff)) / 100;
      }
    }
    const deliveryCharge = subtotal >= 499 ? 0 : 40;
    const grandTotal = Math.max(0, subtotal - discountTotal + deliveryCharge);
    return repo.save(
      repo.create({
        tenantId,
        customerId: payload.customerId ?? null,
        customerName: payload.customerName,
        customerMobile: payload.customerMobile,
        shippingAddress: payload.shippingAddress,
        pincode: payload.pincode ?? null,
        items,
        subtotal,
        discountTotal,
        deliveryCharge,
        grandTotal,
        couponCode: payload.couponCode ?? null,
        paymentChannel: payload.paymentChannel ?? PaymentChannel.UPI,
        status: EcommerceOrderStatus.PLACED,
      }),
    );
  }

  async updateEcommerceOrderStatus(tenantId: string, id: string, status: EcommerceOrderStatus): Promise<EcommerceOrder> {
    const repo = getDataSource().getRepository(EcommerceOrder);
    const order = await repo.findOne({ where: { id, tenantId } });
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
    order.status = status;
    return repo.save(order);
  }

  // ---------- Expenses ----------
  async listExpenses(
    tenantId: string,
    from?: string,
    to?: string,
  ): Promise<Expense[]> {
    const qb = getDataSource()
      .getRepository(Expense)
      .createQueryBuilder('e')
      .where('e.tenantId = :tenantId', { tenantId })
      .orderBy('e.expenseDate', 'DESC')
      .addOrderBy('e.createdAt', 'DESC');
    if (from) qb.andWhere('e.expenseDate >= :from', { from });
    if (to) qb.andWhere('e.expenseDate <= :to', { to });
    return qb.getMany();
  }

  async createExpense(
    tenantId: string,
    payload: {
      id?: string;
      facilityId?: string;
      expenseDate: string;
      amount: number;
      purpose: string;
      category?: ExpenseCategory;
      paymentMode?: string;
      payee?: string;
      notes?: string;
      createdBy?: string;
      scheduleId?: string;
      periodKey?: string;
      isRecurringGenerated?: boolean;
    },
  ): Promise<Expense> {
    if (payload.amount <= 0) throw Object.assign(new Error('Amount must be positive'), { status: 400 });
    const repo = getDataSource().getRepository(Expense);
    if (payload.id) {
      const existing = await repo.findOne({ where: { id: payload.id, tenantId } });
      if (existing) return existing;
    }
    return repo.save(
      repo.create({
        ...(payload.id ? { id: payload.id } : {}),
        tenantId,
        facilityId: payload.facilityId ?? null,
        expenseDate: payload.expenseDate,
        amount: payload.amount,
        purpose: payload.purpose.trim(),
        category: payload.category ?? ExpenseCategory.MISC,
        paymentMode: payload.paymentMode ?? 'CASH',
        payee: payload.payee ?? null,
        notes: payload.notes ?? null,
        createdBy: payload.createdBy ?? null,
        scheduleId: payload.scheduleId ?? null,
        periodKey: payload.periodKey ?? null,
        isRecurringGenerated: payload.isRecurringGenerated ?? false,
      }),
    );
  }

  async listExpenseSchedules(tenantId: string): Promise<ExpenseSchedule[]> {
    return getDataSource()
      .getRepository(ExpenseSchedule)
      .find({ where: { tenantId }, order: { purpose: 'ASC' } });
  }

  async upsertExpenseSchedule(
    tenantId: string,
    payload: Partial<ExpenseSchedule> & {
      purpose: string;
      amount: number;
      dayOfMonth: number;
    },
  ): Promise<ExpenseSchedule> {
    if (payload.dayOfMonth < 1 || payload.dayOfMonth > 28) {
      throw Object.assign(new Error('dayOfMonth must be 1–28'), { status: 400 });
    }
    const repo = getDataSource().getRepository(ExpenseSchedule);
    let row = payload.id ? await repo.findOne({ where: { id: payload.id, tenantId } }) : null;
    if (!row) row = repo.create({ tenantId, isActive: true });
    Object.assign(row, {
      purpose: payload.purpose,
      category: payload.category ?? row.category ?? ExpenseCategory.MISC,
      amount: payload.amount,
      dayOfMonth: payload.dayOfMonth,
      paymentMode: payload.paymentMode ?? row.paymentMode ?? 'BANK',
      payee: payload.payee ?? row.payee ?? null,
      notes: payload.notes ?? row.notes ?? null,
      facilityId: payload.facilityId ?? row.facilityId ?? null,
      isActive: payload.isActive ?? true,
      startMonth: payload.startMonth ?? row.startMonth ?? null,
      endMonth: payload.endMonth ?? row.endMonth ?? null,
    });
    return repo.save(row);
  }

  async runExpenseSchedules(tenantId: string, asOf?: string): Promise<{ posted: Expense[] }> {
    const asOfDate = asOf ?? new Date().toISOString().slice(0, 10);
    const periodKey = periodKeyFromDate(asOfDate);
    const asOfDay = Number(asOfDate.slice(8, 10));
    const schedules = await this.listExpenseSchedules(tenantId);
    const existing = await getDataSource().getRepository(Expense).find({
      where: { tenantId, periodKey, isRecurringGenerated: true },
    });
    const posted: Expense[] = [];
    for (const schedule of schedules) {
      const already = existing.filter((e) => e.scheduleId === schedule.id).map((e) => e.periodKey!);
      if (
        !shouldPostSchedule({
          dayOfMonth: schedule.dayOfMonth,
          asOfDay,
          periodKey,
          alreadyPostedPeriodKeys: already,
          isActive: schedule.isActive,
          startMonth: schedule.startMonth,
          endMonth: schedule.endMonth,
        })
      ) {
        continue;
      }
      try {
        const expense = await this.createExpense(tenantId, {
          facilityId: schedule.facilityId ?? undefined,
          expenseDate: asOfDate,
          amount: num(schedule.amount),
          purpose: `${schedule.purpose} (${periodKey})`,
          category: schedule.category,
          paymentMode: schedule.paymentMode ?? 'BANK',
          payee: schedule.payee ?? undefined,
          notes: schedule.notes ?? undefined,
          scheduleId: schedule.id,
          periodKey,
          isRecurringGenerated: true,
          createdBy: 'schedule-runner',
        });
        posted.push(expense);
      } catch {
        // Unique violation = already posted — skip
      }
    }
    return { posted };
  }

  async getProfitLoss(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<Record<string, unknown>> {
    const sales = await this.listSales(tenantId);
    const purchases = await this.listPurchases(tenantId);
    const expenses = await this.listExpenses(tenantId, from, to);

    const netSales = sales
      .filter((s) => s.status === 'COMPLETED')
      .filter((s) => {
        const d = String(s.createdAt).slice(0, 10);
        return d >= from && d <= to;
      })
      .reduce((sum, s) => {
        const amt = num(s.finalPayable);
        return sum + (s.saleType === 'RETURN' ? -amt : amt);
      }, 0);

    const purchaseSpend = purchases
      .filter((p) => p.status === PurchaseStatus.COMPLETED)
      .filter((p) => p.invoiceDate >= from && p.invoiceDate <= to)
      .reduce((sum, p) => sum + num(p.grandTotal), 0);

    const expenseTotal = expenses.reduce((sum, e) => sum + num(e.amount), 0);
    const pnl = computeProfitLoss({
      netSales,
      purchaseSpend,
      expenses: expenseTotal,
    });

    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + num(e.amount);
    }

    return {
      from,
      to,
      ...pnl,
      expenseByCategory: byCategory,
    };
  }

  // ---------- Reports ----------
  async getReports(tenantId: string): Promise<Record<string, unknown>> {
    const monthStart = new Date().toISOString().slice(0, 8) + '01';
    const today = new Date().toISOString().slice(0, 10);
    const [sales, purchases, customers, suppliers, stock, schemes, ecommerce, expenses, pnl] =
      await Promise.all([
        this.listSales(tenantId),
        this.listPurchases(tenantId),
        this.listCustomers(tenantId),
        this.listSuppliers(tenantId),
        this.listStock(tenantId),
        this.listSchemes(tenantId),
        this.listEcommerceOrders(tenantId),
        this.listExpenses(tenantId, monthStart, today),
        this.getProfitLoss(tenantId, monthStart, today),
      ]);

    const saleTotal = sales
      .filter((s) => s.status === 'COMPLETED')
      .reduce((s, x) => s + (x.saleType === 'RETURN' ? -num(x.finalPayable) : num(x.finalPayable)), 0);
    const purchaseTotal = purchases
      .filter((p) => p.status === PurchaseStatus.COMPLETED)
      .reduce((s, x) => s + num(x.grandTotal), 0);
    const expenseTotal = expenses.reduce((s, e) => s + num(e.amount), 0);
    const customerDue = customers.reduce((s, c) => s + num(c.outstandingDue), 0);
    const supplierDue = suppliers.reduce((s, c) => s + num(c.outstandingDue), 0);
    const stockValue = stock.reduce((s, r) => s + num(r.quantityOnHand) * num(r.costPrice), 0);

    const taxByRate: Record<string, number> = {};
    for (const sale of sales) {
      const key = 'GST';
      taxByRate[key] = (taxByRate[key] ?? 0) + num(sale.taxTotal);
    }

    return {
      summary: {
        saleTotal,
        purchaseTotal,
        expenseTotal,
        customerDue,
        supplierDue,
        stockValue,
        profitEstimate: computeProfitLoss({
          netSales: saleTotal,
          purchaseSpend: purchaseTotal,
          expenses: expenseTotal,
        }).result,
        activeSchemes: schemes.filter((s) => s.isActive).length,
        ecommerceOrders: ecommerce.length,
      },
      profitLoss: pnl,
      gstr1: {
        totalInvoices: sales.length,
        taxableValue: sales.reduce((s, x) => s + num(x.taxableValue || x.subtotal), 0),
        taxTotal: sales.reduce((s, x) => s + num(x.taxTotal), 0),
      },
      gstr2: {
        totalPurchases: purchases.length,
        taxableValue: purchases.reduce((s, x) => s + num(x.subtotal), 0),
        taxTotal: purchases.reduce((s, x) => s + num(x.taxTotal), 0),
      },
      customerDueList: customers.filter((c) => num(c.outstandingDue) > 0),
      supplierDueList: suppliers.filter((c) => num(c.outstandingDue) > 0),
      lowStock: stock.filter((r) => num(r.minStock) > 0 && num(r.quantityOnHand) <= num(r.minStock)),
      taxByRate,
    };
  }

  /** INV-YYYYMMDD-HHmmss-SSS — datetime-unique invoice number */
  private buildDatetimeInvoiceNumber(): string {
    const now = new Date();
    const pad = (value: number, size: number): string => String(value).padStart(size, '0');
    return (
      `INV-${now.getFullYear()}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}` +
      `-${pad(now.getHours(), 2)}${pad(now.getMinutes(), 2)}${pad(now.getSeconds(), 2)}` +
      `-${pad(now.getMilliseconds(), 3)}`
    );
  }
}

export const erpService = new ErpService();
