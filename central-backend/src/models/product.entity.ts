import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { ProductLot } from './product-lot.entity';
import { OrderItem } from './order-item.entity';

@Entity('products')
@Unique('uq_products_tenant_sku', ['tenantId', 'sku'])
@Index('idx_products_tenant_id', ['tenantId'])
@Index('idx_products_base_barcode', ['baseBarcode'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 64 })
  sku!: string;

  @Column({ type: 'varchar', length: 32 })
  baseBarcode!: string;

  @Column({ type: 'varchar', length: 512 })
  name!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  company!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  size!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  color!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  hsnCode!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  category!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  brand!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  subCategory!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unit!: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  gstPercent!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  saleRate!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  mrp!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  purchaseRate!: number;

  @Column({ type: 'int', default: 0 })
  minStock!: number;

  @Column({ type: 'int', default: 0 })
  maxStock!: number;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'boolean', default: false })
  showOnEcommerce!: boolean;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @OneToMany(() => ProductLot, (lot) => lot.product)
  lots!: ProductLot[];

  @OneToMany(() => OrderItem, (item) => item.product)
  orderItems!: OrderItem[];
}
