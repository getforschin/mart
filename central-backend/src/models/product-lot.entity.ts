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
} from 'typeorm';
import { Product } from './product.entity';
import { LotInventoryStock } from './lot-inventory-stock.entity';
import { OrderItem } from './order-item.entity';

@Entity('product_lots')
@Index('idx_product_lots_batch_number', ['batchNumber'])
@Index('idx_product_lots_expiry_date', ['expiryDate'])
@Index('idx_product_lots_product_id', ['productId'])
export class ProductLot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  productId!: string;

  @Column({ type: 'varchar', length: 128 })
  batchNumber!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  costPrice!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  mrp!: number;

  @Column({ type: 'timestamptz' })
  manufactureDate!: Date;

  @Column({ type: 'timestamptz' })
  expiryDate!: Date;

  @Column({ type: 'varchar', length: 64, unique: true })
  lotBarcode!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Product, (product) => product.lots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  @OneToMany(() => LotInventoryStock, (stock) => stock.lot)
  inventoryStocks!: LotInventoryStock[];

  @OneToMany(() => OrderItem, (item) => item.lot)
  orderItems!: OrderItem[];
}
