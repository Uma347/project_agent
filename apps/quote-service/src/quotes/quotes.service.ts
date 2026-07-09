import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { NatsRequestClient } from '../infrastructure/nats/nats-request.client';
import { ApproveQuoteDto } from './application/dto/approve-quote.dto';
import { CreateQuoteDto } from './application/dto/create-quote.dto';
import { ExecuteQuoteDto } from './application/dto/execute-quote.dto';
import { RejectQuoteDto } from './application/dto/reject-quote.dto';
import { QuoteDomainError } from './domain/quote.errors';
import { QuoteEventType, QuoteStatus } from './domain/quote.enums';
import { Product } from './infrastructure/typeorm/product.entity';
import { QuoteEvent } from './infrastructure/typeorm/quote-event.entity';
import { Quote } from './infrastructure/typeorm/quote.entity';

type IntentInterpretationResponse = {
  productId?: string;
  quantity?: number;
  reason?: string;
  error?: {
    code: string;
    message: string;
  };
};

@Injectable()
export class QuotesService {
  private readonly expirationMinutes: number;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Quote)
    private readonly quotes: Repository<Quote>,
    @InjectRepository(QuoteEvent)
    private readonly quoteEvents: Repository<QuoteEvent>,
    private readonly natsRequestClient: NatsRequestClient,
    configService: ConfigService,
  ) {
    this.expirationMinutes = configService.getOrThrow<number>(
      'quote.expirationMinutes',
    );
  }

  async create(payload: CreateQuoteDto) {
    const interpretation =
      await this.natsRequestClient.request<IntentInterpretationResponse>(
        'ai.intent.interpret',
        {
          prompt: payload.prompt,
        },
      );

    if (interpretation.error) {
      throw new QuoteDomainError(interpretation.error.message);
    }

    const interpretedQuantity = interpretation.quantity;

    if (
      !interpretation.productId ||
      !Number.isInteger(interpretedQuantity) ||
      interpretedQuantity === undefined ||
      interpretedQuantity < 1
    ) {
      throw new QuoteDomainError(
        'AI agent returned an invalid quote interpretation.',
      );
    }

    const product = await this.products.findOne({
      where: { id: interpretation.productId },
    });

    if (!product || !product.active) {
      throw new QuoteDomainError('Product is not available for quotation.');
    }

    const now = new Date();
    const expiresAt = this.addMinutes(now, this.expirationMinutes);
    const quantity = interpretedQuantity;
    const unitPriceCents = product.priceCents;
    const totalCents = unitPriceCents * quantity;

    const quote = await this.dataSource.transaction(async (manager) => {
      const createdQuote = await manager.getRepository(Quote).save(
        manager.getRepository(Quote).create({
          productId: product.id,
          product,
          quantity,
          unitPriceCents,
          totalCents,
          status: QuoteStatus.PENDING_HUMAN_APPROVAL,
          expiresAt,
        }),
      );

      await this.recordEvent(
        manager,
        createdQuote.id,
        QuoteEventType.QUOTE_CREATED,
        {
          requestedBy: payload.requestedBy,
          prompt: payload.prompt,
          interpretationReason: interpretation.reason,
          productId: product.id,
          quantity,
          unitPriceCents,
          totalCents,
        },
      );

      return createdQuote;
    });

    return this.toResponse(quote);
  }

  async approve(payload: ApproveQuoteDto) {
    const quote = await this.findQuoteOrThrow(payload.quoteId);
    this.ensureNotExpired(quote);

    if (quote.status === QuoteStatus.REJECTED) {
      throw new QuoteDomainError('Rejected quotes cannot be approved.');
    }

    if (quote.status === QuoteStatus.EXECUTED) {
      throw new QuoteDomainError('Executed quotes cannot be approved.');
    }

    if (quote.status === QuoteStatus.APPROVED) {
      return this.toResponse(quote);
    }

    const updatedQuote = await this.dataSource.transaction(async (manager) => {
      quote.status = QuoteStatus.APPROVED;
      quote.approvedAt = new Date();
      const approvedQuote = await manager.getRepository(Quote).save(quote);

      await this.recordEvent(
        manager,
        approvedQuote.id,
        QuoteEventType.APPROVED,
        {
          approvedBy: payload.approvedBy,
          note: payload.note,
        },
      );

      return approvedQuote;
    });

    return this.toResponse(updatedQuote);
  }

  async reject(payload: RejectQuoteDto) {
    const quote = await this.findQuoteOrThrow(payload.quoteId);

    if (quote.status === QuoteStatus.EXECUTED) {
      throw new QuoteDomainError('Executed quotes cannot be rejected.');
    }

    if (quote.status === QuoteStatus.REJECTED) {
      return this.toResponse(quote);
    }

    const updatedQuote = await this.dataSource.transaction(async (manager) => {
      quote.status = QuoteStatus.REJECTED;
      quote.rejectedAt = new Date();
      const rejectedQuote = await manager.getRepository(Quote).save(quote);

      await this.recordEvent(
        manager,
        rejectedQuote.id,
        QuoteEventType.REJECTED,
        {
          rejectedBy: payload.rejectedBy,
          reason: payload.reason,
        },
      );

      return rejectedQuote;
    });

    return this.toResponse(updatedQuote);
  }

  async execute(payload: ExecuteQuoteDto) {
    const quote = await this.findQuoteOrThrow(payload.quoteId);

    if (quote.status === QuoteStatus.EXECUTED) {
      await this.quoteEvents.save(
        this.quoteEvents.create({
          quoteId: quote.id,
          eventType: QuoteEventType.EXECUTION_REPLAYED,
          metadata: {
            executedBy: payload.executedBy,
            executionResult: quote.executionResult ?? undefined,
          },
        }),
      );

      return this.toResponse(quote);
    }

    this.ensureNotExpired(quote);

    if (quote.status !== QuoteStatus.APPROVED) {
      throw new QuoteDomainError(
        'Quote can only be executed after human approval.',
      );
    }

    const executionId = randomUUID();
    const executionResult = {
      executionId,
      status: 'SIMULATED_PURCHASE_EXECUTED',
      executedAt: new Date().toISOString(),
    };

    const updatedQuote = await this.dataSource.transaction(async (manager) => {
      const currentQuote = await manager.getRepository(Quote).findOne({
        where: { id: payload.quoteId },
        relations: { product: true },
      });

      if (!currentQuote) {
        throw new QuoteDomainError('Quote was not found.');
      }

      if (currentQuote.status !== QuoteStatus.APPROVED) {
        return currentQuote;
      }

      currentQuote.status = QuoteStatus.EXECUTED;
      currentQuote.executedAt = new Date();
      currentQuote.executionId = executionId;
      currentQuote.executionResult = executionResult;

      const executedQuote = await manager
        .getRepository(Quote)
        .save(currentQuote);

      await this.recordEvent(
        manager,
        executedQuote.id,
        QuoteEventType.EXECUTED,
        {
          executedBy: payload.executedBy,
          executionResult,
        },
      );

      return executedQuote;
    });

    return this.toResponse(updatedQuote);
  }

  private async findQuoteOrThrow(quoteId: string) {
    const quote = await this.quotes.findOne({
      where: { id: quoteId },
      relations: { product: true },
    });

    if (!quote) {
      throw new QuoteDomainError('Quote was not found.');
    }

    return quote;
  }

  private ensureNotExpired(quote: Quote): void {
    if (quote.expiresAt <= new Date()) {
      throw new QuoteDomainError('Quote has expired.');
    }
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  private async recordEvent(
    manager: EntityManager,
    quoteId: string,
    eventType: QuoteEventType,
    metadata: Record<string, unknown>,
  ) {
    await manager.getRepository(QuoteEvent).save(
      manager.getRepository(QuoteEvent).create({
        quoteId,
        eventType,
        metadata,
      }),
    );
  }

  private toResponse(quote: Quote) {
    return {
      id: quote.id,
      status: quote.status,
      product: quote.product
        ? {
            id: quote.productId,
            sku: quote.product.sku,
            name: quote.product.name,
          }
        : undefined,
      quantity: quote.quantity,
      unitPriceCents: quote.unitPriceCents,
      totalCents: quote.totalCents,
      expiresAt: quote.expiresAt,
      approvedAt: quote.approvedAt,
      rejectedAt: quote.rejectedAt,
      executedAt: quote.executedAt,
      executionId: quote.executionId,
      executionResult: quote.executionResult,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    };
  }
}
