import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Purchase } from './purchase.entity';

@Entity('purchase_items')
@Index('idx_purchase_items_purchase_id', ['purchaseId'])
export class PurchaseItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  purchaseId!: string;

  @Column({ type: 'uuid' })
  productId!: string;

  @Column({ type: 'uuid', nullable: true })
  lotId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  productName!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  barcode!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  purchaseRate!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  mrp!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  saleRate!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  gstPercent!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  lineTotal!: number;

  @ManyToOne(() => Purchase, (purchase) => purchase.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchaseId' })
  purchase!: Purchase;
}
