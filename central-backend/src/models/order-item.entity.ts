import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderInvoice } from './order-invoice.entity';
import { Product } from './product.entity';
import { ProductLot } from './product-lot.entity';

@Entity('order_items')
@Index('idx_order_items_order_id', ['orderId'])
@Index('idx_order_items_lot_id', ['lotId'])
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  orderId!: string;

  @Column({ type: 'uuid' })
  productId!: string;

  @Column({ type: 'uuid' })
  lotId!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  barcode!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  batchNumber!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  mrp!: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  discountPercent!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  calculatedTax!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  netAmount!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => OrderInvoice, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order!: OrderInvoice;

  @ManyToOne(() => Product, (product) => product.orderItems, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  @ManyToOne(() => ProductLot, (lot) => lot.orderItems, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lotId' })
  lot!: ProductLot;
}
