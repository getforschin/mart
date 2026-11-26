import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { ProductLot } from './product-lot.entity';
import { Facility } from './facility.entity';

@Entity('lot_inventory_stock')
@Unique('uq_lot_inventory_lot_facility', ['lotId', 'facilityId'])
@Index('idx_lot_inventory_facility_id', ['facilityId'])
@Index('idx_lot_inventory_lot_id', ['lotId'])
export class LotInventoryStock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  lotId!: string;

  @Column({ type: 'uuid' })
  facilityId!: string;

  @Column({ type: 'integer', default: 0 })
  quantityOnHand!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  aisleShelfLocation!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => ProductLot, (lot) => lot.inventoryStocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lotId' })
  lot!: ProductLot;

  @ManyToOne(() => Facility, (facility) => facility.lotStocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'facilityId' })
  facility!: Facility;
}
