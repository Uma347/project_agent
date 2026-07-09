import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { NATS_SUBJECTS } from '../infrastructure/nats/nats.constants';
import type { CatalogProductSearchRequestDto } from './application/dto/catalog-search.dto';
import { ApproveQuoteDto } from './application/dto/approve-quote.dto';
import { CreateQuoteDto } from './application/dto/create-quote.dto';
import { ExecuteQuoteDto } from './application/dto/execute-quote.dto';
import { RejectQuoteDto } from './application/dto/reject-quote.dto';
import { QuotesService } from './quotes.service';

@Controller()
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @MessagePattern(NATS_SUBJECTS.QUOTE_CREATE)
  create(@Payload() payload: CreateQuoteDto) {
    return this.quotesService.create(payload);
  }

  @MessagePattern(NATS_SUBJECTS.QUOTE_APPROVE)
  approve(@Payload() payload: ApproveQuoteDto) {
    return this.quotesService.approve(payload);
  }

  @MessagePattern(NATS_SUBJECTS.QUOTE_REJECT)
  reject(@Payload() payload: RejectQuoteDto) {
    return this.quotesService.reject(payload);
  }

  @MessagePattern(NATS_SUBJECTS.QUOTE_EXECUTE)
  execute(@Payload() payload: ExecuteQuoteDto) {
    return this.quotesService.execute(payload);
  }

  @MessagePattern(NATS_SUBJECTS.CATALOG_PRODUCTS_SEARCH)
  searchCatalog(@Payload() payload: CatalogProductSearchRequestDto) {
    return this.quotesService.searchCatalogProducts(payload);
  }
}
