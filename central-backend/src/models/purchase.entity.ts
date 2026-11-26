import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GstMode, PurchaseStatus } from './enums';
import { PurchaseItem } from './purchase-item.entity';

@Entity('purchases')
@Index('idx_purchases_tenant_id', ['tenantId'])
@Index('idx_purchases_supplier_id', ['supplierId'])
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  facilityId!: string;

  @Column({ type: 'uuid' })
  supplierId!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  invoiceNumber!: string | null;

  @Column({ type: 'date' })
  invoiceDate!: string;

  @Column({ type: 'enum', enum: GstMode, default: GstMode.NON_GST })
  gstMode!: GstMode;

  @Column({ type: 'enum', enum: PurchaseStatus, default: PurchaseStatus.DRAFT })
  status!: PurchaseStatus;

  @Column({ type: 'varchar', length: 512, nullable: true })
  remark!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxTotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  otherCharges!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  grandTotal!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => PurchaseItem, (item) => item.purchase, { cascade: true })
  items!: PurchaseItem[];
}
