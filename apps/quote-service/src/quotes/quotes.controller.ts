import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ApproveQuoteDto } from './application/dto/approve-quote.dto';
import { CreateQuoteDto } from './application/dto/create-quote.dto';
import { ExecuteQuoteDto } from './application/dto/execute-quote.dto';
import { RejectQuoteDto } from './application/dto/reject-quote.dto';
import { QuotesService } from './quotes.service';

@Controller()
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @MessagePattern('agent.quote.create')
  create(@Payload() payload: CreateQuoteDto) {
    return this.quotesService.create(payload);
  }

  @MessagePattern('agent.quote.approve')
  approve(@Payload() payload: ApproveQuoteDto) {
    return this.quotesService.approve(payload);
  }

  @MessagePattern('agent.quote.reject')
  reject(@Payload() payload: RejectQuoteDto) {
    return this.quotesService.reject(payload);
  }

  @MessagePattern('agent.quote.execute')
  execute(@Payload() payload: ExecuteQuoteDto) {
    return this.quotesService.execute(payload);
  }
}
