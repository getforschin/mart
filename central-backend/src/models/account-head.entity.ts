import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('account_heads')
@Index('idx_account_heads_tenant_id', ['tenantId'])
export class AccountHead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 64 })
  groupName!: string;

  @Column({ type: 'varchar', length: 32, default: 'ASSET' })
  nature!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  openingBalance!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
