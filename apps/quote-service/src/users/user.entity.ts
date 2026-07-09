import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Quote } from '../quotes/infrastructure/typeorm/quote.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'first_name', type: 'text' })
  firstName!: string;

  @Column({ name: 'last_name', type: 'text' })
  lastName!: string;

  @Column({ type: 'text', unique: true })
  email!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @OneToMany(() => Quote, (quote) => quote.requestedBy)
  requestedQuotes!: Quote[];

  @OneToMany(() => Quote, (quote) => quote.approvedBy)
  approvedQuotes!: Quote[];

  @OneToMany(() => Quote, (quote) => quote.rejectedBy)
  rejectedQuotes!: Quote[];
}
