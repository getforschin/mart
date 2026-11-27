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
  Supplier,
  User,
  AccountEntryType,
  EcommerceOrderStatus,
  GstMode,
  PartyType,
  PurchaseStatus,
  SchemeType,
  SmsChannel,
  StockMovementType,
  TransferStatus,
  UserRole,
  PaymentChannel,
  OrderOriginSource,
} from '../../models';
import bcrypt from 'bcryptjs';
import { createAccessToken } from '../security/jwt';
import { v4 as uuidv4 } from 'uuid';

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
    const salesTotal = sales.reduce((sum, s) => sum + num(s.finalPayable), 0);
    const purchases = await ds.getRepository(Purchase).find({ where: { tenantId, status: PurchaseStatus.COMPLETED } });
    const purchaseTotal = purchases.reduce((sum, p) => sum + num(p.grandTotal), 0);

    const lowStock = await ds
      .getRepository(Product)
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isActive = true')
      .andWhere('p.minStock > 0')
      .getMany();

    return {
      productCount,
      customerCount,
      supplierCount,
      purchaseCount,
      saleCount,
      openTransfers,
      activeSchemes,
      ecommerceOrders,
      criticalStock,
      salesTotal: Math.round(salesTotal * 100) / 100,
      purchaseTotal: Math.round(purchaseTotal * 100) / 100,
      lowStockCount: lowStock.length,
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
    },
  ): Promise<Purchase> {
    const ds = getDataSource();
    return ds.transaction(async (manager) => {
      if (payload.id) {
        const existing = await manager.findOne(Purchase, { where: { id: payload.id }, relations: ['items'] });
        if (existing) return existing;
      }
      const items = payload.items.map((item) => {
        const lineTotal = item.quantity * item.purchaseRate;
        return manager.create(PurchaseItem, {
          ...item,
          lotId: null,
          gstPercent: item.gstPercent ?? 0,
          lineTotal,
        });
      });
      const subtotal = items.reduce((s, i) => s + num(i.lineTotal), 0);
      const taxTotal = items.reduce((s, i) => s + num(i.lineTotal) * (num(i.gstPercent) / 100), 0);
      const otherCharges = payload.otherCharges ?? 0;
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
        grandTotal: subtotal + taxTotal + otherCharges,
        items,
      });
      const saved = await manager.save(purchase);

      if (saved.status === PurchaseStatus.COMPLETED) {
        for (const item of saved.items) {
          const product = await manager.findOne(Product, { where: { id: item.productId, tenantId } });
          if (!product) continue;
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
      }
      return manager.findOneOrFail(Purchase, { where: { id: saved.id }, relations: ['items'] });
    });
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
  async listSales(tenantId: string): Promise<OrderInvoice[]> {
    return getDataSource().getRepository(OrderInvoice).find({
      where: { tenantId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
      take: 200,
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

        const product = await manager.findOneOrFail(Product, { where: { id: item.productId } });
        const net = item.unitPrice * item.quantity;
        const tax = net * (num(product.gstPercent) / 100);
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
            netAmount: net + tax,
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

  // ---------- Reports ----------
  async getReports(tenantId: string): Promise<Record<string, unknown>> {
    const [sales, purchases, customers, suppliers, stock, schemes, ecommerce] = await Promise.all([
      this.listSales(tenantId),
      this.listPurchases(tenantId),
      this.listCustomers(tenantId),
      this.listSuppliers(tenantId),
      this.listStock(tenantId),
      this.listSchemes(tenantId),
      this.listEcommerceOrders(tenantId),
    ]);

    const saleTotal = sales.reduce((s, x) => s + num(x.finalPayable), 0);
    const purchaseTotal = purchases
      .filter((p) => p.status === PurchaseStatus.COMPLETED)
      .reduce((s, x) => s + num(x.grandTotal), 0);
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
        customerDue,
        supplierDue,
        stockValue,
        profitEstimate: saleTotal - purchaseTotal,
        activeSchemes: schemes.filter((s) => s.isActive).length,
        ecommerceOrders: ecommerce.length,
      },
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
