import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SmsChannel } from './enums';

@Entity('sms_messages')
@Index('idx_sms_messages_tenant_id', ['tenantId'])
export class SmsMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'enum', enum: SmsChannel })
  channel!: SmsChannel;

  @Column({ type: 'varchar', length: 20 })
  mobile!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', length: 32, default: 'SENT' })
  status!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  templateName!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
