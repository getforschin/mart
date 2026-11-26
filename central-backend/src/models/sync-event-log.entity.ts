import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { SyncEventType } from './enums';

@Entity('sync_event_log')
@Index('idx_sync_event_log_client_id', ['clientEventId'], { unique: true })
@Index('idx_sync_event_log_tenant_id', ['tenantId'])
export class SyncEventLog {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  clientEventId!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'enum', enum: SyncEventType })
  eventType!: SyncEventType;

  @Column({ type: 'jsonb' })
  payloadSnapshot!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  processedAt!: Date;
}
