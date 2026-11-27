import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ExpenseCategory } from './enums';

@Entity('expenses')
@Index('idx_expenses_tenant_id', ['tenantId'])
@Index('idx_expenses_expense_date', ['expenseDate'])
@Unique('uq_expenses_schedule_period', ['scheduleId', 'periodKey'])
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid', nullable: true })
  facilityId!: string | null;

  @Column({ type: 'date' })
  expenseDate!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 255 })
  purpose!: string;

  @Column({ type: 'enum', enum: ExpenseCategory, default: ExpenseCategory.MISC })
  category!: ExpenseCategory;

  @Column({ type: 'varchar', length: 32, nullable: true })
  paymentMode!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  payee!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  notes!: string | null;

  @Column({ type: 'boolean', default: false })
  isRecurringGenerated!: boolean;

  @Column({ type: 'uuid', nullable: true })
  scheduleId!: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  periodKey!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
