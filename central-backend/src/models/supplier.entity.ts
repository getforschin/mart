import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('suppliers')
@Index('idx_suppliers_tenant_id', ['tenantId'])
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile!: string | null;

  @Column({ type: 'varchar', length: 320, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  state!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gstin!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  outstandingDue!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
