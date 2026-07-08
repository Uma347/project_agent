import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AgentQuoteService } from '../../application/agent-quote.service';
import { ApproveQuoteRequestDto } from '../../application/dto/approve-quote-request.dto';
import { CreateQuoteRequestDto } from '../../application/dto/create-quote-request.dto';
import { ExecuteQuoteRequestDto } from '../../application/dto/execute-quote-request.dto';
import { RejectQuoteRequestDto } from '../../application/dto/reject-quote-request.dto';

@ApiTags('agent quotes')
@Controller('agent/quote')
export class AgentQuoteController {
  constructor(private readonly agentQuoteService: AgentQuoteService) {}

  @Post()
  @ApiOperation({ summary: 'Create a quote from a purchase intention.' })
  @ApiBody({ type: CreateQuoteRequestDto })
  create(@Body() payload: CreateQuoteRequestDto) {
    return this.agentQuoteService.create(payload);
  }

  @Post(':quote_id/approve')
  @ApiOperation({ summary: 'Approve a quote as a human operator.' })
  @ApiParam({ name: 'quote_id' })
  @ApiBody({ type: ApproveQuoteRequestDto })
  approve(
    @Param('quote_id') quoteId: string,
    @Body() payload: ApproveQuoteRequestDto,
  ) {
    return this.agentQuoteService.approve(quoteId, payload);
  }

  @Post(':quote_id/reject')
  @ApiOperation({ summary: 'Reject a quote as a human operator.' })
  @ApiParam({ name: 'quote_id' })
  @ApiBody({ type: RejectQuoteRequestDto })
  reject(
    @Param('quote_id') quoteId: string,
    @Body() payload: RejectQuoteRequestDto,
  ) {
    return this.agentQuoteService.reject(quoteId, payload);
  }

  @Post(':quote_id/execute')
  @ApiOperation({ summary: 'Execute an approved quote.' })
  @ApiParam({ name: 'quote_id' })
  @ApiBody({ type: ExecuteQuoteRequestDto })
  execute(
    @Param('quote_id') quoteId: string,
    @Body() payload: ExecuteQuoteRequestDto,
  ) {
    return this.agentQuoteService.execute(quoteId, payload);
  }
}
