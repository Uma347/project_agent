import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NatsModule } from '../infrastructure/nats/nats.module';
import { Product } from './infrastructure/typeorm/product.entity';
import { QuoteEvent } from './infrastructure/typeorm/quote-event.entity';
import { Quote } from './infrastructure/typeorm/quote.entity';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [NatsModule, TypeOrmModule.forFeature([Product, Quote, QuoteEvent])],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
