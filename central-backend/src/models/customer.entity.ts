import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('customers')
@Index('idx_customers_tenant_id', ['tenantId'])
@Index('idx_customers_mobile', ['tenantId', 'mobile'])
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 20 })
  mobile!: string;

  @Column({ type: 'varchar', length: 320, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  state!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  pincode!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gstin!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  membershipCard!: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent!: number;

  @Column({ type: 'varchar', length: 32, default: 'MRP' })
  priceType!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  outstandingDue!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  creditLimit!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
