import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantStatus } from './enums';
import { TenantMetadataSchema } from './schemas/tenant-metadata.schema';
import { User } from './user.entity';
import { Facility } from './facility.entity';
import { Product } from './product.entity';
import { OrderInvoice } from './order-invoice.entity';
import { WorkforceAttendance } from './workforce-attendance.entity';

@Entity('tenants')
@Index('idx_tenants_status', ['status'])
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 63, unique: true })
  subdomain!: string;

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.PROVISIONING })
  status!: TenantStatus;

  @Column({ type: 'jsonb', default: {} })
  metadata!: TenantMetadataSchema;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => User, (user) => user.tenant)
  users!: User[];

  @OneToMany(() => Facility, (facility) => facility.tenant)
  facilities!: Facility[];

  @OneToMany(() => Product, (product) => product.tenant)
  products!: Product[];

  @OneToMany(() => OrderInvoice, (order) => order.tenant)
  orders!: OrderInvoice[];

  @OneToMany(() => WorkforceAttendance, (attendance) => attendance.tenant)
  attendanceRecords!: WorkforceAttendance[];
}
