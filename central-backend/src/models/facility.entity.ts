import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FacilityType } from './enums';
import { GeoCoordinates } from './schemas/tenant-metadata.schema';
import { Tenant } from './tenant.entity';
import { LotInventoryStock } from './lot-inventory-stock.entity';
import { OrderInvoice } from './order-invoice.entity';
import { WorkforceAttendance } from './workforce-attendance.entity';

@Entity('facilities')
@Index('idx_facilities_tenant_id', ['tenantId'])
@Index('idx_facilities_type', ['type'])
export class Facility {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'enum', enum: FacilityType })
  type!: FacilityType;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  shortcut!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  state!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gstin!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  registerType!: string | null;

  @Column({ type: 'jsonb' })
  geoCoordinates!: GeoCoordinates;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.facilities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @OneToMany(() => LotInventoryStock, (stock) => stock.facility)
  lotStocks!: LotInventoryStock[];

  @OneToMany(() => OrderInvoice, (order) => order.facility)
  orders!: OrderInvoice[];

  @OneToMany(() => WorkforceAttendance, (attendance) => attendance.facility)
  attendanceRecords!: WorkforceAttendance[];
}
