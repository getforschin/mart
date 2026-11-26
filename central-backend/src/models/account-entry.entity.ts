import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AccountEntryType, PartyType } from './enums';

@Entity('account_entries')
@Index('idx_account_entries_tenant_id', ['tenantId'])
export class AccountEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'enum', enum: AccountEntryType })
  entryType!: AccountEntryType;

  @Column({ type: 'uuid', nullable: true })
  accountHeadId!: string | null;

  @Column({ type: 'enum', enum: PartyType, nullable: true })
  partyType!: PartyType | null;

  @Column({ type: 'uuid', nullable: true })
  partyId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  partyName!: string | null;

  @Column({ type: 'date' })
  entryDate!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  paymentMode!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  narration!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  referenceNo!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
