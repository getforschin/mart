import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TransferStatus } from './enums';

@Entity('stock_transfers')
@Index('idx_stock_transfers_tenant_id', ['tenantId'])
export class StockTransfer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  fromFacilityId!: string;

  @Column({ type: 'uuid' })
  toFacilityId!: string;

  @Column({ type: 'uuid' })
  productId!: string;

  @Column({ type: 'uuid', nullable: true })
  lotId!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantity!: number;

  @Column({ type: 'enum', enum: TransferStatus, default: TransferStatus.PENDING })
  status!: TransferStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  transportDetail!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  remark!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
