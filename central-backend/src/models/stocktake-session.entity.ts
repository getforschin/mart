import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StocktakeStatus } from './enums';
import { StocktakeLine } from './stocktake-line.entity';

@Entity('stocktake_sessions')
@Index('idx_stocktake_sessions_tenant_id', ['tenantId'])
@Index('idx_stocktake_sessions_facility_id', ['facilityId'])
export class StocktakeSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  facilityId!: string;

  @Column({ type: 'uuid' })
  startedBy!: string;

  @Column({ type: 'enum', enum: StocktakeStatus, default: StocktakeStatus.IN_PROGRESS })
  status!: StocktakeStatus;

  @Column({ type: 'varchar', length: 512, nullable: true })
  remark!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  committedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => StocktakeLine, (line) => line.session, { cascade: true })
  lines!: StocktakeLine[];
}
