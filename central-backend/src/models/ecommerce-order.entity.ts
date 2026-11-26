import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EcommerceOrderStatus, PaymentChannel } from './enums';

@Entity('ecommerce_orders')
@Index('idx_ecommerce_orders_tenant_id', ['tenantId'])
export class EcommerceOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid', nullable: true })
  customerId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  customerName!: string;

  @Column({ type: 'varchar', length: 20 })
  customerMobile!: string;

  @Column({ type: 'varchar', length: 512 })
  shippingAddress!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  pincode!: string | null;

  @Column({ type: 'jsonb' })
  items!: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountTotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  deliveryCharge!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  grandTotal!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  couponCode!: string | null;

  @Column({ type: 'enum', enum: PaymentChannel, default: PaymentChannel.UPI })
  paymentChannel!: PaymentChannel;

  @Column({ type: 'enum', enum: EcommerceOrderStatus, default: EcommerceOrderStatus.PLACED })
  status!: EcommerceOrderStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
