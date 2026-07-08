import { Module } from '@nestjs/common';
import { NatsModule } from '../infrastructure/nats/nats.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [NatsModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
