import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { seedAuthData } from './auth.service';

let databaseInstance: Database.Database | null = null;

const SCHEMA_DDL = `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS pos_config (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pos_facilities (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'RETAIL_STORE',
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS pos_users (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    facility_id TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS pos_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    facility_id TEXT NOT NULL,
    logged_in_at TEXT NOT NULL
  );

  -- Columns is_synced/updated_at are added by runMigrations for existing DBs.
  -- Do NOT create indexes on those columns here — CREATE INDEX would fail before migrations.
  CREATE TABLE IF NOT EXISTS pos_customers (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL UNIQUE,
    email TEXT,
    previous_due REAL NOT NULL DEFAULT 0,
    membership_card TEXT,
    loyalty_points INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS pos_suppliers (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    mobile TEXT,
    email TEXT,
    gstin TEXT,
    outstanding_due REAL NOT NULL DEFAULT 0,
    is_synced INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS purchases_local (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    facility_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    invoice_number TEXT,
    invoice_date TEXT NOT NULL,
    gst_mode TEXT NOT NULL DEFAULT 'NON_GST',
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    remark TEXT,
    other_charges REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL DEFAULT 0,
    tax_total REAL NOT NULL DEFAULT 0,
    grand_total REAL NOT NULL DEFAULT 0,
    paid_amount REAL NOT NULL DEFAULT 0,
    due_amount REAL NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID',
    payment_mode TEXT,
    is_synced INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS supplier_payments_local (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_mode TEXT NOT NULL,
    entry_date TEXT NOT NULL,
    remark TEXT,
    reference_no TEXT,
    is_synced INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS expenses_local (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    facility_id TEXT,
    expense_date TEXT NOT NULL,
    amount REAL NOT NULL,
    purpose TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'MISC',
    payment_mode TEXT,
    payee TEXT,
    notes TEXT,
    is_recurring_generated INTEGER NOT NULL DEFAULT 0,
    schedule_id TEXT,
    period_key TEXT,
    created_by TEXT,
    is_synced INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS expense_schedules_local (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    facility_id TEXT,
    purpose TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'MISC',
    amount REAL NOT NULL,
    day_of_month INTEGER NOT NULL,
    payment_mode TEXT,
    payee TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    start_month TEXT,
    end_month TEXT,
    is_synced INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS purchase_items_local (
    id TEXT PRIMARY KEY NOT NULL,
    purchase_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    barcode TEXT,
    sku TEXT,
    quantity INTEGER NOT NULL,
    purchase_rate REAL NOT NULL,
    mrp REAL NOT NULL,
    sale_rate REAL NOT NULL,
    gst_percent REAL NOT NULL DEFAULT 0,
    lot_id TEXT,
    is_new_product INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (purchase_id) REFERENCES purchases_local(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS stock_events_local (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    facility_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    product_id TEXT NOT NULL,
    lot_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    new_quantity INTEGER,
    to_facility_id TEXT,
    remark TEXT,
    is_synced INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invoice_counter (
    facility_id TEXT PRIMARY KEY NOT NULL,
    next_number INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS product_lots_local (
    id TEXT PRIMARY KEY NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_sku TEXT NOT NULL,
    base_barcode TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT '',
    size TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '',
    hsn_code TEXT NOT NULL DEFAULT '',
    batch_number TEXT NOT NULL,
    cost_price REAL NOT NULL,
    mrp REAL NOT NULL,
    sale_rate REAL NOT NULL,
    manufacture_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    lot_barcode TEXT NOT NULL UNIQUE,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    aisle_shelf_location TEXT,
    facility_id TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_lots_base_barcode ON product_lots_local(base_barcode);
  CREATE INDEX IF NOT EXISTS idx_lots_lot_barcode ON product_lots_local(lot_barcode);
  CREATE INDEX IF NOT EXISTS idx_lots_expiry_date ON product_lots_local(expiry_date);
  CREATE INDEX IF NOT EXISTS idx_lots_facility_id ON product_lots_local(facility_id);

  CREATE TABLE IF NOT EXISTS order_invoices_local (
    id TEXT PRIMARY KEY NOT NULL,
    invoice_number TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    facility_id TEXT NOT NULL,
    cashier_id TEXT NOT NULL,
    cashier_name TEXT NOT NULL DEFAULT '',
    sale_type TEXT NOT NULL DEFAULT 'CASH_SALE',
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    customer_payload TEXT NOT NULL DEFAULT '{}',
    customer_mobile TEXT NOT NULL DEFAULT '',
    subtotal REAL NOT NULL,
    taxable_value REAL NOT NULL DEFAULT 0,
    tax_total REAL NOT NULL,
    discount_total REAL NOT NULL DEFAULT 0,
    redeem_amount REAL NOT NULL DEFAULT 0,
    gross_sale REAL NOT NULL DEFAULT 0,
    round_off REAL NOT NULL DEFAULT 0,
    final_payable REAL NOT NULL,
    payment_channel TEXT NOT NULL,
    coupon_code TEXT,
    bill_discount_percent REAL NOT NULL DEFAULT 0,
    amount_tendered REAL NOT NULL DEFAULT 0,
    change_due REAL NOT NULL DEFAULT 0,
    return_of_invoice_id TEXT,
    origin_source TEXT NOT NULL DEFAULT 'OFFLINE_POS',
    is_synced INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stocktake_sessions_local (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    facility_id TEXT NOT NULL,
    started_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    remark TEXT,
    committed_at TEXT,
    is_synced INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stocktake_lines_local (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    lot_id TEXT NOT NULL,
    expected_qty INTEGER NOT NULL,
    counted_qty INTEGER,
    remark TEXT,
    FOREIGN KEY (session_id) REFERENCES stocktake_sessions_local(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_stocktake_lines_session ON stocktake_lines_local(session_id);

  CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON order_invoices_local(invoice_number);

  CREATE TABLE IF NOT EXISTS order_items_local (
    id TEXT PRIMARY KEY NOT NULL,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    lot_id TEXT NOT NULL,
    barcode TEXT NOT NULL DEFAULT '',
    company TEXT NOT NULL DEFAULT '',
    size TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '',
    hsn_code TEXT NOT NULL DEFAULT '',
    batch_number TEXT NOT NULL DEFAULT '',
    serial_number TEXT NOT NULL DEFAULT '',
    price_type TEXT NOT NULL DEFAULT 'MRP',
    box_qty INTEGER NOT NULL DEFAULT 0,
    packet_qty INTEGER NOT NULL DEFAULT 0,
    piece_qty INTEGER NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL,
    purchase_rate REAL NOT NULL DEFAULT 0,
    mrp REAL NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL,
    discount_percent REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    calculated_tax REAL NOT NULL,
    net_amount REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES order_invoices_local(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items_local(order_id);

  CREATE TABLE IF NOT EXISTS workforce_attendance_local (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    facility_id TEXT NOT NULL,
    clock_in TEXT NOT NULL,
    clock_out TEXT,
    biometric_signature_hash TEXT NOT NULL,
    is_synced INTEGER NOT NULL DEFAULT 0
  );

`;

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return columns.some((col) => col.name === column);
}

function runMigrations(db: Database.Database): void {
  const migrations: Array<{ table: string; column: string; ddl: string }> = [
    { table: 'product_lots_local', column: 'company', ddl: 'ALTER TABLE product_lots_local ADD COLUMN company TEXT NOT NULL DEFAULT \'\'' },
    { table: 'product_lots_local', column: 'size', ddl: 'ALTER TABLE product_lots_local ADD COLUMN size TEXT NOT NULL DEFAULT \'\'' },
    { table: 'product_lots_local', column: 'color', ddl: 'ALTER TABLE product_lots_local ADD COLUMN color TEXT NOT NULL DEFAULT \'\'' },
    { table: 'product_lots_local', column: 'hsn_code', ddl: 'ALTER TABLE product_lots_local ADD COLUMN hsn_code TEXT NOT NULL DEFAULT \'\'' },
    { table: 'product_lots_local', column: 'sale_rate', ddl: 'ALTER TABLE product_lots_local ADD COLUMN sale_rate REAL NOT NULL DEFAULT 0' },
    { table: 'order_invoices_local', column: 'invoice_number', ddl: 'ALTER TABLE order_invoices_local ADD COLUMN invoice_number TEXT NOT NULL DEFAULT \'\'' },
    { table: 'order_invoices_local', column: 'cashier_name', ddl: 'ALTER TABLE order_invoices_local ADD COLUMN cashier_name TEXT NOT NULL DEFAULT \'\'' },
    { table: 'order_invoices_local', column: 'sale_type', ddl: 'ALTER TABLE order_invoices_local ADD COLUMN sale_type TEXT NOT NULL DEFAULT \'CASH_SALE\'' },
    { table: 'order_invoices_local', column: 'status', ddl: 'ALTER TABLE order_invoices_local ADD COLUMN status TEXT NOT NULL DEFAULT \'COMPLETED\'' },
    { table: 'order_invoices_local', column: 'customer_mobile', ddl: 'ALTER TABLE order_invoices_local ADD COLUMN customer_mobile TEXT NOT NULL DEFAULT \'\'' },
    { table: 'order_invoices_local', column: 'taxable_value', ddl: 'ALTER TABLE order_invoices_local ADD COLUMN taxable_value REAL NOT NULL DEFAULT 0' },
    { table: 'order_invoices_local', column: 'redeem_amount', ddl: 'ALTER TABLE order_invoices_local ADD COLUMN redeem_amount REAL NOT NULL DEFAULT 0' },
    { table: 'order_invoices_local', column: 'gross_sale', ddl: 'ALTER TABLE order_invoices_local ADD COLUMN gross_sale REAL NOT NULL DEFAULT 0' },
    { table: 'order_invoices_local', column: 'round_off', ddl: 'ALTER TABLE order_invoices_local ADD COLUMN round_off REAL NOT NULL DEFAULT 0' },
    { table: 'order_invoices_local', column: 'coupon_code', ddl: 'ALTER TABLE order_invoices_local ADD COLUMN coupon_code TEXT' },
    { table: 'order_invoices_local', column: 'bill_discount_percent', ddl: 'ALTER TABLE order_invoices_local ADD COLUMN bill_discount_percent REAL NOT NULL DEFAULT 0' },
    { table: 'order_invoices_local', column: 'amount_tendered', ddl: 'ALTER TABLE order_invoices_local ADD COLUMN amount_tendered REAL NOT NULL DEFAULT 0' },
    { table: 'order_invoices_local', column: 'change_due', ddl: 'ALTER TABLE order_invoices_local ADD COLUMN change_due REAL NOT NULL DEFAULT 0' },
    { table: 'order_invoices_local', column: 'return_of_invoice_id', ddl: 'ALTER TABLE order_invoices_local ADD COLUMN return_of_invoice_id TEXT' },
    { table: 'pos_customers', column: 'is_synced', ddl: 'ALTER TABLE pos_customers ADD COLUMN is_synced INTEGER NOT NULL DEFAULT 0' },
    { table: 'pos_customers', column: 'updated_at', ddl: 'ALTER TABLE pos_customers ADD COLUMN updated_at TEXT NOT NULL DEFAULT \'\'' },
    { table: 'purchases_local', column: 'paid_amount', ddl: 'ALTER TABLE purchases_local ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0' },
    { table: 'purchases_local', column: 'due_amount', ddl: 'ALTER TABLE purchases_local ADD COLUMN due_amount REAL NOT NULL DEFAULT 0' },
    { table: 'purchases_local', column: 'payment_status', ddl: 'ALTER TABLE purchases_local ADD COLUMN payment_status TEXT NOT NULL DEFAULT \'UNPAID\'' },
    { table: 'purchases_local', column: 'payment_mode', ddl: 'ALTER TABLE purchases_local ADD COLUMN payment_mode TEXT' },
    { table: 'pos_suppliers', column: 'outstanding_due', ddl: 'ALTER TABLE pos_suppliers ADD COLUMN outstanding_due REAL NOT NULL DEFAULT 0' },
    { table: 'purchase_items_local', column: 'sku', ddl: 'ALTER TABLE purchase_items_local ADD COLUMN sku TEXT' },
    {
      table: 'purchase_items_local',
      column: 'is_new_product',
      ddl: 'ALTER TABLE purchase_items_local ADD COLUMN is_new_product INTEGER NOT NULL DEFAULT 0',
    },
    {
      table: 'pos_customers',
      column: 'created_at',
      ddl: 'ALTER TABLE pos_customers ADD COLUMN created_at TEXT NOT NULL DEFAULT \'\'',
    },
  ];

  for (const migration of migrations) {
    if (!columnExists(db, migration.table, migration.column)) {
      try {
        db.exec(migration.ddl);
        console.log(`[Main] Migrated ${migration.table}.${migration.column}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[Main] Migration failed ${migration.table}.${migration.column}:`, message);
        throw error;
      }
    }
  }

  // Backfill customer created_at once the column exists
  try {
    db.exec(
      `UPDATE pos_customers
       SET created_at = CASE
         WHEN created_at IS NULL OR created_at = '' THEN COALESCE(NULLIF(updated_at, ''), datetime('now'))
         ELSE created_at
       END`,
    );
  } catch {
    /* ignore if table missing on first boot */
  }

  // Demo seed customers used non-UUID ids (cust-001..) before is_synced existed (DEFAULT 0).
  // Central Customer.id is uuid — these can never sync. Keep them local-only.
  try {
    db.exec(
      `UPDATE pos_customers
       SET is_synced = 1
       WHERE is_synced = 0
         AND (
           id LIKE 'cust-%'
           OR length(id) <> 36
           OR id NOT LIKE '________-____-____-____-____________'
         )`,
    );
  } catch {
    /* ignore */
  }

  // Indexes that require migrated columns — safe only after ALTER TABLE
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_customers_is_synced ON pos_customers(is_synced);
    CREATE INDEX IF NOT EXISTS idx_purchases_is_synced ON purchases_local(is_synced);
    CREATE INDEX IF NOT EXISTS idx_stock_events_is_synced ON stock_events_local(is_synced);
    CREATE INDEX IF NOT EXISTS idx_invoices_is_synced ON order_invoices_local(is_synced);
    CREATE INDEX IF NOT EXISTS idx_attendance_is_synced ON workforce_attendance_local(is_synced);
    CREATE INDEX IF NOT EXISTS idx_supplier_payments_is_synced ON supplier_payments_local(is_synced);
    CREATE INDEX IF NOT EXISTS idx_expenses_is_synced ON expenses_local(is_synced);
  `);
}

export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  const dbDirectory = path.join(userDataPath, 'data');
  if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
  }
  return path.join(dbDirectory, 'mart-pos.db');
}

function seedBundledDemoDatabase(dbPath: string): void {
  if (fs.existsSync(dbPath)) return;
  if (!app.isPackaged) return;

  const bundled = path.join(process.resourcesPath, 'demo-data', 'mart-pos.db');
  if (!fs.existsSync(bundled)) return;

  fs.copyFileSync(bundled, dbPath);
  console.log('[Main] Seeded local POS database from bundled demo data');
}

export function initializeDatabase(): Database.Database {
  if (databaseInstance !== null) {
    return databaseInstance;
  }

  const dbPath = getDatabasePath();
  seedBundledDemoDatabase(dbPath);
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  db.exec(SCHEMA_DDL);
  runMigrations(db);

  seedDefaultConfig(db);
  seedAuthData(db);
  seedSampleInventory(db);
  seedSampleCustomers(db);

  databaseInstance = db;
  return db;
}

export function getDatabase(): Database.Database {
  if (databaseInstance === null) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return databaseInstance;
}

export function closeDatabase(): void {
  if (databaseInstance !== null) {
    databaseInstance.close();
    databaseInstance = null;
  }
}

function seedDefaultConfig(db: Database.Database): void {
  const defaults: Record<string, string> = {
    tenantId: process.env.POS_TENANT_ID ?? '00000000-0000-0000-0000-000000000001',
    facilityId: process.env.POS_FACILITY_ID ?? '00000000-0000-0000-0000-000000000002',
    facilityName: process.env.POS_FACILITY_NAME ?? 'Demo Retail Store — Main',
    shopName: process.env.POS_SHOP_NAME ?? 'Mart Demo Retail',
    cashierId: process.env.POS_CASHIER_ID ?? '00000000-0000-0000-0000-000000000003',
    deviceId: process.env.POS_DEVICE_ID ?? `POS-${process.platform}-${Date.now()}`,
    apiBaseUrl: process.env.POS_API_BASE_URL ?? 'http://localhost:3000',
    taxRate: process.env.POS_TAX_RATE ?? '18',
    lastApiContactAt: '',
    lastSyncAt: '',
    lastPullAt: '',
    lastOnline: '0',
  };

  // Keys that must always follow .env (so production API URL is never stuck on localhost)
  const alwaysOverrideFromEnv = new Set(['apiBaseUrl', 'tenantId', 'facilityId', 'taxRate']);

  const insertIgnore = db.prepare(
    'INSERT OR IGNORE INTO pos_config (key, value) VALUES (@key, @value)',
  );
  const upsert = db.prepare(
    `INSERT INTO pos_config (key, value) VALUES (@key, @value)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );

  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(defaults)) {
      if (alwaysOverrideFromEnv.has(key)) {
        upsert.run({ key, value });
      } else {
        insertIgnore.run({ key, value });
      }
    }
  });

  transaction();
}

function seedSampleCustomers(db: Database.Database): void {
  // Do not seed demo customers — non-UUID ids / shared mobiles collide with central pull
  // (UNIQUE pos_customers.mobile) and previously stuck the sync outbox.

  const supplierCount = db.prepare('SELECT COUNT(*) AS count FROM pos_suppliers').get() as { count: number };
  if (supplierCount.count === 0) {
    db.prepare(
      `INSERT INTO pos_suppliers (id, name, mobile, email, gstin, is_synced)
       VALUES ('supp-001', 'Demo Supplier', '9000000001', NULL, NULL, 1)`,
    ).run();
  }
}

function seedSampleInventory(db: Database.Database): void {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM product_lots_local').get() as {
    count: number;
  };

  if (countRow.count > 0) {
    db.prepare(
      `UPDATE product_lots_local SET
         company = CASE WHEN company = '' THEN 'Amul' ELSE company END,
         hsn_code = CASE WHEN hsn_code = '' THEN '0401' ELSE hsn_code END,
         sale_rate = CASE WHEN sale_rate = 0 THEN mrp ELSE sale_rate END
       WHERE product_sku = 'MILK-ORG-1L'`,
    ).run();
    db.prepare(
      `UPDATE product_lots_local SET
         company = CASE WHEN company = '' THEN 'India Gate' ELSE company END,
         hsn_code = CASE WHEN hsn_code = '' THEN '1006' ELSE hsn_code END,
         sale_rate = CASE WHEN sale_rate = 0 THEN mrp ELSE sale_rate END
       WHERE product_sku = 'RICE-BAS-5KG'`,
    ).run();
    return;
  }

  const facilityId = process.env.POS_FACILITY_ID ?? '00000000-0000-0000-0000-000000000002';
  const now = new Date();
  const expiryNear = new Date(now);
  expiryNear.setDate(expiryNear.getDate() + 25);
  const expiryFar = new Date(now);
  expiryFar.setDate(expiryFar.getDate() + 180);

  const lots = [
    {
      id: '00000000-0000-0000-0000-000000000201',
      product_id: '00000000-0000-0000-0000-000000000101',
      product_name: 'Organic Whole Milk 1L',
      product_sku: 'MILK-ORG-1L',
      base_barcode: '8901234567890',
      company: 'Amul',
      size: '1L',
      color: '',
      hsn_code: '0401',
      batch_number: 'BATCH-2026-01',
      cost_price: 42.0,
      mrp: 62.0,
      sale_rate: 62.0,
      manufacture_date: now.toISOString(),
      expiry_date: expiryNear.toISOString(),
      lot_barcode: 'LOT-MILK-001',
      quantity_on_hand: 48,
      aisle_shelf_location: 'A-12-3',
      facility_id: facilityId,
    },
    {
      id: '00000000-0000-0000-0000-000000000202',
      product_id: '00000000-0000-0000-0000-000000000101',
      product_name: 'Organic Whole Milk 1L',
      product_sku: 'MILK-ORG-1L',
      base_barcode: '8901234567890',
      company: 'Amul',
      size: '1L',
      color: '',
      hsn_code: '0401',
      batch_number: 'BATCH-2026-03',
      cost_price: 44.0,
      mrp: 68.0,
      sale_rate: 68.0,
      manufacture_date: now.toISOString(),
      expiry_date: expiryFar.toISOString(),
      lot_barcode: 'LOT-MILK-002',
      quantity_on_hand: 120,
      aisle_shelf_location: 'A-12-4',
      facility_id: facilityId,
    },
    {
      id: '00000000-0000-0000-0000-000000000203',
      product_id: '00000000-0000-0000-0000-000000000102',
      product_name: 'Premium Basmati Rice 5kg',
      product_sku: 'RICE-BAS-5KG',
      base_barcode: '8909876543210',
      company: 'India Gate',
      size: '5kg',
      color: '',
      hsn_code: '1006',
      batch_number: 'BATCH-RICE-01',
      cost_price: 380.0,
      mrp: 499.0,
      sale_rate: 499.0,
      manufacture_date: now.toISOString(),
      expiry_date: expiryFar.toISOString(),
      lot_barcode: 'LOT-RICE-001',
      quantity_on_hand: 35,
      aisle_shelf_location: 'B-05-1',
      facility_id: facilityId,
    },
  ];

  const insertLot = db.prepare(`
    INSERT INTO product_lots_local (
      id, product_id, product_name, product_sku, base_barcode, company, size, color, hsn_code,
      batch_number, cost_price, mrp, sale_rate, manufacture_date, expiry_date, lot_barcode,
      quantity_on_hand, aisle_shelf_location, facility_id
    ) VALUES (
      @id, @product_id, @product_name, @product_sku, @base_barcode, @company, @size, @color, @hsn_code,
      @batch_number, @cost_price, @mrp, @sale_rate, @manufacture_date, @expiry_date, @lot_barcode,
      @quantity_on_hand, @aisle_shelf_location, @facility_id
    )
  `);

  const seedTransaction = db.transaction(() => {
    for (const lot of lots) {
      insertLot.run(lot);
    }
  });

  seedTransaction();
}
