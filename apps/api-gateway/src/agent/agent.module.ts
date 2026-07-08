import { Module } from '@nestjs/common';
import { NatsModule } from '../infrastructure/nats/nats.module';
import { AgentQuoteService } from './application/agent-quote.service';
import { AgentQuoteController } from './presentation/http/agent-quote.controller';

@Module({
  imports: [NatsModule],
  controllers: [AgentQuoteController],
  providers: [AgentQuoteService],
})
export class AgentModule {}
