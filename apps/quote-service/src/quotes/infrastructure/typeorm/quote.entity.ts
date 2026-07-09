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
import { QuoteStatus } from '../../domain/quote.enums';
import { Product } from './product.entity';
import { QuoteEvent } from './quote-event.entity';

@Entity({ name: 'quotes' })
@Index(['productId'])
@Index(['status'])
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'text' })
  productId!: string;

  @ManyToOne(() => Product, (product) => product.quotes, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ name: 'unit_price_cents', type: 'integer' })
  unitPriceCents!: number;

  @Column({ name: 'total_cents', type: 'integer' })
  totalCents!: number;

  @Column({
    type: 'enum',
    enum: QuoteStatus,
    enumName: 'QuoteStatus',
    default: QuoteStatus.PENDING_HUMAN_APPROVAL,
  })
  status!: QuoteStatus;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'rejected_at', type: 'timestamp', nullable: true })
  rejectedAt!: Date | null;

  @Column({ name: 'executed_at', type: 'timestamp', nullable: true })
  executedAt!: Date | null;

  @Column({ name: 'execution_id', type: 'uuid', nullable: true, unique: true })
  executionId!: string | null;

  @Column({ name: 'execution_result', type: 'jsonb', nullable: true })
  executionResult!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @OneToMany(() => QuoteEvent, (event) => event.quote)
  events!: QuoteEvent[];
}
