import 'reflect-metadata';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { initializeDatabase, getDataSource } from '../src/core/database/data-source';
import {
  Tenant,
  User,
  Facility,
  Product,
  ProductLot,
  LotInventoryStock,
  Customer,
  Supplier,
  Scheme,
  AccountHead,
  AccountEntry,
  Coupon,
  FinancialSession,
  SmsMessage,
  TenantStatus,
  UserRole,
  FacilityType,
  SchemeType,
  AccountEntryType,
  PartyType,
  SmsChannel,
  PurchaseStatus,
  GstMode,
} from '../src/models';
import { erpService } from '../src/core/services/erp.service';

dotenv.config();

export const DEMO_IDS = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  facilityId: '00000000-0000-0000-0000-000000000002',
  warehouseId: '00000000-0000-0000-0000-000000000004',
  cashierId: '00000000-0000-0000-0000-000000000003',
  adminId: '00000000-0000-0000-0000-000000000005',
  managerId: '00000000-0000-0000-0000-000000000006',
  productMilkId: '00000000-0000-0000-0000-000000000101',
  productRiceId: '00000000-0000-0000-0000-000000000102',
  productOilId: '00000000-0000-0000-0000-000000000103',
  productSoapId: '00000000-0000-0000-0000-000000000104',
  productBreadId: '00000000-0000-0000-0000-000000000105',
  lotMilkNearId: '00000000-0000-0000-0000-000000000201',
  lotMilkFarId: '00000000-0000-0000-0000-000000000202',
  lotRiceId: '00000000-0000-0000-0000-000000000203',
  lotOilId: '00000000-0000-0000-0000-000000000204',
  lotSoapId: '00000000-0000-0000-0000-000000000205',
  lotBreadId: '00000000-0000-0000-0000-000000000206',
  stockMilkNearId: '00000000-0000-0000-0000-000000000301',
  stockMilkFarId: '00000000-0000-0000-0000-000000000302',
  stockRiceId: '00000000-0000-0000-0000-000000000303',
  stockOilId: '00000000-0000-0000-0000-000000000304',
  stockSoapId: '00000000-0000-0000-0000-000000000305',
  stockBreadId: '00000000-0000-0000-0000-000000000306',
  supplierAmulId: '00000000-0000-0000-0000-000000000401',
  supplierAgarwalId: '00000000-0000-0000-0000-000000000402',
  customerRahulId: '00000000-0000-0000-0000-000000000501',
  customerPriyaId: '00000000-0000-0000-0000-000000000502',
} as const;

async function seed(): Promise<void> {
  await initializeDatabase();
  const dataSource = getDataSource();
  const force = process.argv.includes('--force');

  const existingTenant = await dataSource.getRepository(Tenant).findOne({
    where: { id: DEMO_IDS.tenantId },
  });

  if (existingTenant !== null && !force) {
    console.log('Demo data already seeded — skipping. Use --force to reseed.');
    await dataSource.destroy();
    return;
  }

  if (force && existingTenant) {
    console.log('Force reseed requested — clearing demo tenant data…');
    await dataSource.query(
      'TRUNCATE TABLE ecommerce_orders, sms_messages, coupons, account_entries, account_heads, schemes, stock_movements, stock_transfers, purchase_items, purchases, order_items, order_invoices, lot_inventory_stock, product_lots, products, customers, suppliers, financial_sessions, workforce_attendance, sync_event_log, users, facilities, tenants CASCADE',
    );
  }

  const now = new Date();
  const expiryNear = new Date(now);
  expiryNear.setDate(expiryNear.getDate() + 25);
  const expiryFar = new Date(now);
  expiryFar.setDate(expiryFar.getDate() + 180);
  const expiryWarning = new Date(now);
  expiryWarning.setDate(expiryWarning.getDate() + 45);

  const passwordHash = await bcrypt.hash('admin123', 10);
  const managerHash = await bcrypt.hash('manager123', 10);

  await dataSource.transaction(async (manager) => {
    await manager.save(Tenant, {
      id: DEMO_IDS.tenantId,
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

    await manager.save(User, [
      {
        id: DEMO_IDS.adminId,
        tenantId: DEMO_IDS.tenantId,
        email: 'admin@demo-mart.local',
        username: 'admin',
        fullName: 'Store Admin',
        mobile: '8393926666',
        passwordHash,
        role: UserRole.MART_ADMIN,
        isActive: true,
      },
      {
        id: DEMO_IDS.cashierId,
        tenantId: DEMO_IDS.tenantId,
        email: 'cashier@demo-mart.local',
        username: 'cashier',
        fullName: 'Demo Cashier',
        mobile: '9876543210',
        passwordHash,
        role: UserRole.CASHIER,
        isActive: true,
      },
      {
        id: DEMO_IDS.managerId,
        tenantId: DEMO_IDS.tenantId,
        email: 'manager@demo-mart.local',
        username: 'manager',
        fullName: 'Store Manager',
        mobile: '9988776655',
        passwordHash: managerHash,
        role: UserRole.STORE_MANAGER,
        isActive: true,
      },
    ]);

    await manager.save(Facility, [
      {
        id: DEMO_IDS.facilityId,
        tenantId: DEMO_IDS.tenantId,
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
        id: DEMO_IDS.warehouseId,
        tenantId: DEMO_IDS.tenantId,
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
    ]);

    await manager.save(FinancialSession, [
      {
        id: '00000000-0000-0000-0000-000000000601',
        tenantId: DEMO_IDS.tenantId,
        name: '2025-2026',
        startDate: '2025-04-01',
        endDate: '2026-03-31',
        isCurrent: false,
      },
      {
        id: '00000000-0000-0000-0000-000000000602',
        tenantId: DEMO_IDS.tenantId,
        name: '2026-2027',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        isCurrent: true,
      },
    ]);

    await manager.save(Product, [
      {
        id: DEMO_IDS.productMilkId,
        tenantId: DEMO_IDS.tenantId,
        sku: 'MILK-ORG-1L',
        baseBarcode: '8901234567890',
        name: 'Organic Whole Milk 1L',
        description: 'Farm-fresh organic whole milk, 1 litre pack',
        category: 'Dairy',
        brand: 'Amul',
        unit: 'LTR',
        hsnCode: '0401',
        gstPercent: 5,
        purchaseRate: 42,
        saleRate: 58,
        mrp: 62,
        minStock: 20,
        maxStock: 200,
        showOnEcommerce: true,
        isActive: true,
      },
      {
        id: DEMO_IDS.productRiceId,
        tenantId: DEMO_IDS.tenantId,
        sku: 'RICE-BAS-5KG',
        baseBarcode: '8909876543210',
        name: 'Premium Basmati Rice 5kg',
        description: 'Aged basmati rice, 5kg bag',
        category: 'Grocery',
        brand: 'India Gate',
        unit: 'KG',
        hsnCode: '1006',
        gstPercent: 5,
        purchaseRate: 380,
        saleRate: 470,
        mrp: 499,
        minStock: 10,
        maxStock: 80,
        showOnEcommerce: true,
        isActive: true,
      },
      {
        id: DEMO_IDS.productOilId,
        tenantId: DEMO_IDS.tenantId,
        sku: 'OIL-SUN-1L',
        baseBarcode: '8901111222333',
        name: 'Sunflower Oil 1L',
        description: 'Refined sunflower oil',
        category: 'Grocery',
        brand: 'Fortune',
        unit: 'LTR',
        hsnCode: '1512',
        gstPercent: 5,
        purchaseRate: 110,
        saleRate: 135,
        mrp: 145,
        minStock: 15,
        maxStock: 100,
        showOnEcommerce: true,
        isActive: true,
      },
      {
        id: DEMO_IDS.productSoapId,
        tenantId: DEMO_IDS.tenantId,
        sku: 'SOAP-DOVE-100',
        baseBarcode: '8902222333444',
        name: 'Dove Soap 100g',
        description: 'Moisturising bathing bar',
        category: 'Personal Care',
        brand: 'Dove',
        unit: 'PCS',
        hsnCode: '3401',
        gstPercent: 18,
        purchaseRate: 35,
        saleRate: 48,
        mrp: 55,
        minStock: 30,
        maxStock: 300,
        showOnEcommerce: true,
        isActive: true,
      },
      {
        id: DEMO_IDS.productBreadId,
        tenantId: DEMO_IDS.tenantId,
        sku: 'BREAD-WHT-400',
        baseBarcode: '8903333444555',
        name: 'White Bread 400g',
        description: 'Fresh bakery bread',
        category: 'Bakery',
        brand: 'Britannia',
        unit: 'PCS',
        hsnCode: '1905',
        gstPercent: 5,
        purchaseRate: 28,
        saleRate: 38,
        mrp: 42,
        minStock: 25,
        maxStock: 120,
        showOnEcommerce: true,
        isActive: true,
      },
    ]);

    await manager.save(ProductLot, [
      {
        id: DEMO_IDS.lotMilkNearId,
        productId: DEMO_IDS.productMilkId,
        batchNumber: 'BATCH-2026-01',
        costPrice: 42,
        mrp: 62,
        manufactureDate: now,
        expiryDate: expiryNear,
        lotBarcode: 'LOT-MILK-001',
        isActive: true,
      },
      {
        id: DEMO_IDS.lotMilkFarId,
        productId: DEMO_IDS.productMilkId,
        batchNumber: 'BATCH-2026-03',
        costPrice: 44,
        mrp: 68,
        manufactureDate: now,
        expiryDate: expiryFar,
        lotBarcode: 'LOT-MILK-002',
        isActive: true,
      },
      {
        id: DEMO_IDS.lotRiceId,
        productId: DEMO_IDS.productRiceId,
        batchNumber: 'BATCH-RICE-01',
        costPrice: 380,
        mrp: 499,
        manufactureDate: now,
        expiryDate: expiryWarning,
        lotBarcode: 'LOT-RICE-001',
        isActive: true,
      },
      {
        id: DEMO_IDS.lotOilId,
        productId: DEMO_IDS.productOilId,
        batchNumber: 'BATCH-OIL-01',
        costPrice: 110,
        mrp: 145,
        manufactureDate: now,
        expiryDate: expiryFar,
        lotBarcode: 'LOT-OIL-001',
        isActive: true,
      },
      {
        id: DEMO_IDS.lotSoapId,
        productId: DEMO_IDS.productSoapId,
        batchNumber: 'BATCH-SOAP-01',
        costPrice: 35,
        mrp: 55,
        manufactureDate: now,
        expiryDate: expiryFar,
        lotBarcode: 'LOT-SOAP-001',
        isActive: true,
      },
      {
        id: DEMO_IDS.lotBreadId,
        productId: DEMO_IDS.productBreadId,
        batchNumber: 'BATCH-BREAD-01',
        costPrice: 28,
        mrp: 42,
        manufactureDate: now,
        expiryDate: expiryNear,
        lotBarcode: 'LOT-BREAD-001',
        isActive: true,
      },
    ]);

    await manager.save(LotInventoryStock, [
      { id: DEMO_IDS.stockMilkNearId, lotId: DEMO_IDS.lotMilkNearId, facilityId: DEMO_IDS.facilityId, quantityOnHand: 48, aisleShelfLocation: 'A-12-3' },
      { id: DEMO_IDS.stockMilkFarId, lotId: DEMO_IDS.lotMilkFarId, facilityId: DEMO_IDS.facilityId, quantityOnHand: 120, aisleShelfLocation: 'A-12-4' },
      { id: DEMO_IDS.stockRiceId, lotId: DEMO_IDS.lotRiceId, facilityId: DEMO_IDS.facilityId, quantityOnHand: 35, aisleShelfLocation: 'B-05-1' },
      { id: DEMO_IDS.stockOilId, lotId: DEMO_IDS.lotOilId, facilityId: DEMO_IDS.facilityId, quantityOnHand: 60, aisleShelfLocation: 'B-02-1' },
      { id: DEMO_IDS.stockSoapId, lotId: DEMO_IDS.lotSoapId, facilityId: DEMO_IDS.facilityId, quantityOnHand: 90, aisleShelfLocation: 'C-01-2' },
      { id: DEMO_IDS.stockBreadId, lotId: DEMO_IDS.lotBreadId, facilityId: DEMO_IDS.facilityId, quantityOnHand: 40, aisleShelfLocation: 'D-01-1' },
      { id: '00000000-0000-0000-0000-000000000311', lotId: DEMO_IDS.lotRiceId, facilityId: DEMO_IDS.warehouseId, quantityOnHand: 200, aisleShelfLocation: 'W-01' },
      { id: '00000000-0000-0000-0000-000000000312', lotId: DEMO_IDS.lotOilId, facilityId: DEMO_IDS.warehouseId, quantityOnHand: 150, aisleShelfLocation: 'W-02' },
    ]);

    await manager.save(Supplier, [
      {
        id: DEMO_IDS.supplierAmulId,
        tenantId: DEMO_IDS.tenantId,
        name: 'Amul Distributors',
        mobile: '9123456780',
        email: 'amul@supplier.local',
        address: 'Dairy Road, Dehradun',
        state: 'Uttarakhand',
        gstin: '05AMUL0000A1Z5',
        outstandingDue: 12500,
        isActive: true,
      },
      {
        id: DEMO_IDS.supplierAgarwalId,
        tenantId: DEMO_IDS.tenantId,
        name: 'Agarwal Trading',
        mobile: '9123456781',
        email: 'agarwal@supplier.local',
        address: 'Wholesale Market, Haridwar',
        state: 'Uttarakhand',
        gstin: '05AGAR0000A1Z5',
        outstandingDue: 8200,
        isActive: true,
      },
    ]);

    await manager.save(Customer, [
      {
        id: DEMO_IDS.customerRahulId,
        tenantId: DEMO_IDS.tenantId,
        name: 'Rahul Sharma',
        mobile: '9876543210',
        email: 'rahul@customer.local',
        address: '12 Rajpur Road',
        city: 'Dehradun',
        state: 'Uttarakhand',
        pincode: '248001',
        membershipCard: 'MEM-1001',
        discountPercent: 2,
        priceType: 'MRP',
        outstandingDue: 450,
        creditLimit: 5000,
        passwordHash,
        isActive: true,
      },
      {
        id: DEMO_IDS.customerPriyaId,
        tenantId: DEMO_IDS.tenantId,
        name: 'Priya Verma',
        mobile: '9123456000',
        email: 'priya@customer.local',
        address: '45 Clock Tower',
        city: 'Dehradun',
        state: 'Uttarakhand',
        pincode: '248001',
        membershipCard: 'MEM-1002',
        discountPercent: 5,
        priceType: 'SALE',
        outstandingDue: 0,
        creditLimit: 3000,
        passwordHash,
        isActive: true,
      },
    ]);

    await manager.save(Scheme, [
      {
        id: '00000000-0000-0000-0000-000000000701',
        tenantId: DEMO_IDS.tenantId,
        name: 'Buy 2 Get 1 Free — Soap',
        schemeType: SchemeType.FREE_ITEM,
        description: 'On Dove soap purchase',
        buyQuantity: 2,
        getQuantity: 1,
        discountPercent: 0,
        minBillAmount: 0,
        startDate: '2026-04-01',
        endDate: '2026-12-31',
        isActive: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000702',
        tenantId: DEMO_IDS.tenantId,
        name: 'Bill Discount 5% above 1000',
        schemeType: SchemeType.BILL_DISCOUNT,
        description: 'Storewide bill discount',
        buyQuantity: 0,
        getQuantity: 0,
        discountPercent: 5,
        minBillAmount: 1000,
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        isActive: true,
      },
    ]);

    await manager.save(AccountHead, [
      { id: '00000000-0000-0000-0000-000000000801', tenantId: DEMO_IDS.tenantId, name: 'Cash', groupName: 'Current Assets', nature: 'ASSET', openingBalance: 25000, isActive: true },
      { id: '00000000-0000-0000-0000-000000000802', tenantId: DEMO_IDS.tenantId, name: 'Bank - SBI', groupName: 'Bank Accounts', nature: 'ASSET', openingBalance: 150000, isActive: true },
      { id: '00000000-0000-0000-0000-000000000803', tenantId: DEMO_IDS.tenantId, name: 'Sales', groupName: 'Income', nature: 'INCOME', openingBalance: 0, isActive: true },
      { id: '00000000-0000-0000-0000-000000000804', tenantId: DEMO_IDS.tenantId, name: 'Purchase', groupName: 'Expenses', nature: 'EXPENSE', openingBalance: 0, isActive: true },
    ]);

    await manager.save(AccountEntry, [
      {
        id: '00000000-0000-0000-0000-000000000901',
        tenantId: DEMO_IDS.tenantId,
        entryType: AccountEntryType.PAYMENT,
        accountHeadId: '00000000-0000-0000-0000-000000000802',
        partyType: PartyType.SUPPLIER,
        partyId: DEMO_IDS.supplierAmulId,
        partyName: 'Amul Distributors',
        entryDate: '2026-11-01',
        amount: 5000,
        paymentMode: 'UPI',
        narration: 'Part payment against purchase',
        referenceNo: 'PAY-001',
      },
      {
        id: '00000000-0000-0000-0000-000000000902',
        tenantId: DEMO_IDS.tenantId,
        entryType: AccountEntryType.RECEIPT,
        accountHeadId: '00000000-0000-0000-0000-000000000801',
        partyType: PartyType.CUSTOMER,
        partyId: DEMO_IDS.customerRahulId,
        partyName: 'Rahul Sharma',
        entryDate: '2026-11-05',
        amount: 450,
        paymentMode: 'CASH',
        narration: 'Due collection',
        referenceNo: 'REC-001',
      },
    ]);

    await manager.save(Coupon, [
      {
        id: '00000000-0000-0000-0000-000000000a01',
        tenantId: DEMO_IDS.tenantId,
        code: 'WELCOME50',
        title: 'Welcome flat ₹50 off',
        percentOff: 0,
        flatOff: 50,
        minOrderAmount: 299,
        validFrom: '2026-04-01',
        validTo: '2027-03-31',
        isActive: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000a02',
        tenantId: DEMO_IDS.tenantId,
        code: 'SAVE10',
        title: '10% off storewide',
        percentOff: 10,
        flatOff: 0,
        minOrderAmount: 499,
        validFrom: '2026-04-01',
        validTo: '2027-03-31',
        isActive: true,
      },
    ]);

    await manager.save(SmsMessage, [
      {
        id: '00000000-0000-0000-0000-000000000b01',
        tenantId: DEMO_IDS.tenantId,
        channel: SmsChannel.SMS,
        mobile: '9876543210',
        message: 'Thank you for shopping at CNP Mart. Bill amount ₹450.',
        status: 'SENT',
        templateName: 'SALE_BILL',
      },
      {
        id: '00000000-0000-0000-0000-000000000b02',
        tenantId: DEMO_IDS.tenantId,
        channel: SmsChannel.WHATSAPP,
        mobile: '9123456000',
        message: 'Your order has been confirmed. Track in the CNP Mart app.',
        status: 'SENT',
        templateName: 'ORDER_CONFIRM',
      },
    ]);
  });

  // Sample purchase + ecomm order via service layer
  await erpService.createPurchase(DEMO_IDS.tenantId, {
    facilityId: DEMO_IDS.facilityId,
    supplierId: DEMO_IDS.supplierAmulId,
    invoiceNumber: 'PUR-DEMO-001',
    invoiceDate: '2026-11-10',
    gstMode: GstMode.EXCLUSIVE,
    status: PurchaseStatus.COMPLETED,
    remark: 'Seed purchase',
    items: [
      {
        productId: DEMO_IDS.productMilkId,
        productName: 'Organic Whole Milk 1L',
        barcode: '8901234567890',
        quantity: 24,
        purchaseRate: 42,
        mrp: 62,
        saleRate: 58,
        gstPercent: 5,
      },
    ],
  });

  await erpService.placeEcommerceOrder(DEMO_IDS.tenantId, {
    customerId: DEMO_IDS.customerPriyaId,
    customerName: 'Priya Verma',
    customerMobile: '9123456000',
    shippingAddress: '45 Clock Tower, Dehradun',
    pincode: '248001',
    couponCode: 'WELCOME50',
    items: [
      { productId: DEMO_IDS.productSoapId, name: 'Dove Soap 100g', quantity: 3, unitPrice: 48 },
      { productId: DEMO_IDS.productOilId, name: 'Sunflower Oil 1L', quantity: 1, unitPrice: 135 },
    ],
  });

  console.log('');
  console.log('✓ Full ERP demo data seeded');
  console.log('');
  console.log('  Admin login:   admin / admin123');
  console.log('  Cashier login: cashier / admin123');
  console.log('  Manager login: manager / manager123');
  console.log('  Customer mobile for dues: 9876543210 (Rahul Sharma)');
  console.log('  Coupons: WELCOME50, SAVE10');
  console.log('');

  await dataSource.destroy();
}

seed().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
