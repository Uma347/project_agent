import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QuoteEventType } from '../../domain/quote.enums';
import { Quote } from './quote.entity';

@Entity({ name: 'quote_events' })
@Index(['quoteId'])
export class QuoteEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'quote_id', type: 'uuid' })
  quoteId!: string;

  @ManyToOne(() => Quote, (quote) => quote.events, { nullable: false })
  @JoinColumn({ name: 'quote_id' })
  quote!: Quote;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: QuoteEventType,
    enumName: 'QuoteEventType',
  })
  eventType!: QuoteEventType;

  @Column({ type: 'jsonb' })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp' })
  timestamp!: Date;
}
