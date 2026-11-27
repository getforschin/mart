import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentChannel, OrderOriginSource } from './enums';
import { CustomerPayload } from './schemas/tenant-metadata.schema';
import { Tenant } from './tenant.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';
import { OrderItem } from './order-item.entity';

@Entity('order_invoices')
@Index('idx_order_invoices_tenant_id', ['tenantId'])
@Index('idx_order_invoices_is_synced', ['isSynced'])
@Index('idx_order_invoices_facility_id', ['facilityId'])
@Index('idx_order_invoices_created_at', ['createdAt'])
export class OrderInvoice {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  facilityId!: string;

  @Column({ type: 'uuid' })
  cashierId!: string;

  @Column({ type: 'jsonb', default: {} })
  customerPayload!: CustomerPayload;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  taxTotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountTotal!: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  invoiceNumber!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'CASH_SALE' })
  saleType!: string;

  @Column({ type: 'varchar', length: 32, default: 'COMPLETED' })
  status!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  customerMobile!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxableValue!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  redeemAmount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  grossSale!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  roundOff!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  couponCode!: string | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  billDiscountPercent!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amountTendered!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  changeDue!: number;

  @Column({ type: 'uuid', nullable: true })
  returnOfInvoiceId!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  cashierName!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  finalPayable!: number;

  @Column({ type: 'enum', enum: PaymentChannel })
  paymentChannel!: PaymentChannel;

  @Column({ type: 'enum', enum: OrderOriginSource })
  originSource!: OrderOriginSource;

  @Column({ type: 'boolean', default: true })
  isSynced!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @ManyToOne(() => Facility, (facility) => facility.orders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'facilityId' })
  facility!: Facility;

  @ManyToOne(() => User, (user) => user.processedOrders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cashierId' })
  cashier!: User;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];
}
