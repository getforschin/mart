import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StocktakeSession } from './stocktake-session.entity';

@Entity('stocktake_lines')
@Index('idx_stocktake_lines_session_id', ['sessionId'])
@Index('idx_stocktake_lines_lot_id', ['lotId'])
export class StocktakeLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'uuid' })
  productId!: string;

  @Column({ type: 'uuid' })
  lotId!: string;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  expectedQty!: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  countedQty!: number | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  remark!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => StocktakeSession, (session) => session.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session!: StocktakeSession;
}
