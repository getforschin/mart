import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('coupons')
@Index('idx_coupons_tenant_id', ['tenantId'])
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  percentOff!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  flatOff!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  minOrderAmount!: number;

  @Column({ type: 'date', nullable: true })
  validFrom!: string | null;

  @Column({ type: 'date', nullable: true })
  validTo!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
