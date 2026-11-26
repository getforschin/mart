import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SchemeType } from './enums';

@Entity('schemes')
@Index('idx_schemes_tenant_id', ['tenantId'])
export class Scheme {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'enum', enum: SchemeType })
  schemeType!: SchemeType;

  @Column({ type: 'varchar', length: 512, nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  buyQuantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  getQuantity!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  minBillAmount!: number;

  @Column({ type: 'date', nullable: true })
  startDate!: string | null;

  @Column({ type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
