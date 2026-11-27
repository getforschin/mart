import dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import {
  Tenant,
  User,
  Facility,
  Product,
  ProductLot,
  LotInventoryStock,
  OrderInvoice,
  OrderItem,
  WorkforceAttendance,
  SyncEventLog,
  Customer,
  Supplier,
  Purchase,
  PurchaseItem,
  StockTransfer,
  StockMovement,
  Scheme,
  AccountHead,
  AccountEntry,
  SmsMessage,
  EcommerceOrder,
  Coupon,
  FinancialSession,
  StocktakeSession,
  StocktakeLine,
  Expense,
  ExpenseSchedule,
} from '../../models';

dotenv.config();

const useDatabaseUrl = Boolean(process.env.DATABASE_URL);

const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  ...(useDatabaseUrl
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DATABASE_HOST ?? 'localhost',
        port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
        username: process.env.DATABASE_USER ?? 'mart_admin',
        password: process.env.DATABASE_PASSWORD ?? 'mart_secure_pass_2026',
        database: process.env.DATABASE_NAME ?? 'mart_omnichannel',
      }),
  // Prefer migrations in production. Set TYPEORM_SYNCHRONIZE=true only for first bootstrap.
  synchronize:
    process.env.TYPEORM_SYNCHRONIZE === 'true' || process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  entities: [
    Tenant,
    User,
    Facility,
    Product,
    ProductLot,
    LotInventoryStock,
    OrderInvoice,
    OrderItem,
    WorkforceAttendance,
    SyncEventLog,
    Customer,
    Supplier,
    Purchase,
    PurchaseItem,
    StockTransfer,
    StockMovement,
    Scheme,
    AccountHead,
    AccountEntry,
    SmsMessage,
    EcommerceOrder,
    Coupon,
    FinancialSession,
    StocktakeSession,
    StocktakeLine,
    Expense,
    ExpenseSchedule,
  ],
  migrations: ['dist/core/database/migrations/*.js'],
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
};

export const AppDataSource = new DataSource(dataSourceOptions);

export async function initializeDatabase(): Promise<DataSource> {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }
  await AppDataSource.initialize();
  return AppDataSource;
}

export function getDataSource(): DataSource {
  if (!AppDataSource.isInitialized) {
    throw new Error('Database has not been initialized. Call initializeDatabase() first.');
  }
  return AppDataSource;
}
