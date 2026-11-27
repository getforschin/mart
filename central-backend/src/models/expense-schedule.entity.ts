import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExpenseCategory } from './enums';

@Entity('expense_schedules')
@Index('idx_expense_schedules_tenant_id', ['tenantId'])
export class ExpenseSchedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid', nullable: true })
  facilityId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  purpose!: string;

  @Column({ type: 'enum', enum: ExpenseCategory, default: ExpenseCategory.MISC })
  category!: ExpenseCategory;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: number;

  @Column({ type: 'int' })
  dayOfMonth!: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  paymentMode!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  payee!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  notes!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 7, nullable: true })
  startMonth!: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  endMonth!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
