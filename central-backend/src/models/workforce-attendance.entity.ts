import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';
import { Facility } from './facility.entity';

@Entity('workforce_attendance')
@Index('idx_workforce_attendance_tenant_id', ['tenantId'])
@Index('idx_workforce_attendance_user_id', ['userId'])
@Index('idx_workforce_attendance_is_synced', ['isSynced'])
export class WorkforceAttendance {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  facilityId!: string;

  @Column({ type: 'timestamptz' })
  clockIn!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  clockOut!: Date | null;

  @Column({ type: 'varchar', length: 128 })
  biometricSignatureHash!: string;

  @Column({ type: 'boolean', default: true })
  isSynced!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.attendanceRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @ManyToOne(() => User, (user) => user.attendanceRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Facility, (facility) => facility.attendanceRecords, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'facilityId' })
  facility!: Facility;
}
