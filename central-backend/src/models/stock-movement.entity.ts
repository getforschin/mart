import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StockMovementType } from './enums';

@Entity('stock_movements')
@Index('idx_stock_movements_tenant_id', ['tenantId'])
@Index('idx_stock_movements_product_id', ['productId'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  facilityId!: string;

  @Column({ type: 'uuid' })
  productId!: string;

  @Column({ type: 'uuid', nullable: true })
  lotId!: string | null;

  @Column({ type: 'enum', enum: StockMovementType })
  movementType!: StockMovementType;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantity!: number;

  @Column({ type: 'varchar', length: 512, nullable: true })
  remark!: string | null;

  @Column({ type: 'uuid', nullable: true })
  referenceId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
