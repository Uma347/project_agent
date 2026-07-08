import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import { NatsRequestClient } from '../../infrastructure/nats/nats-request.client';
import { ApproveQuoteRequestDto } from './dto/approve-quote-request.dto';
import { CreateQuoteRequestDto } from './dto/create-quote-request.dto';
import { ExecuteQuoteRequestDto } from './dto/execute-quote-request.dto';
import { RejectQuoteRequestDto } from './dto/reject-quote-request.dto';

@Injectable()
export class AgentQuoteService {
  constructor(private readonly natsRequestClient: NatsRequestClient) {}

  create(payload: CreateQuoteRequestDto) {
    return this.requestQuoteService('agent.quote.create', payload);
  }

  approve(quoteId: string, payload: ApproveQuoteRequestDto) {
    return this.requestQuoteService('agent.quote.approve', {
      quoteId,
      ...payload,
    });
  }

  reject(quoteId: string, payload: RejectQuoteRequestDto) {
    return this.requestQuoteService('agent.quote.reject', {
      quoteId,
      ...payload,
    });
  }

  execute(quoteId: string, payload: ExecuteQuoteRequestDto) {
    return this.requestQuoteService('agent.quote.execute', {
      quoteId,
      ...payload,
    });
  }

  private async requestQuoteService<TPayload>(
    subject: string,
    payload: TPayload,
  ) {
    try {
      return await this.natsRequestClient.request(subject, payload);
    } catch (error) {
      if (this.isRpcBadRequest(error)) {
        throw new BadRequestException(error.message);
      }

      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException('Quote service did not respond.');
      }

      throw new BadGatewayException('Quote service request failed.');
    }
  }

  private isRpcBadRequest(error: unknown): error is { message: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      'message' in error &&
      Number((error as { statusCode: unknown }).statusCode) === 400 &&
      typeof (error as { message: unknown }).message === 'string'
    );
  }
}
