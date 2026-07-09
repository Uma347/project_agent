import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
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

type PaymentSimulationResponse = {
  purchaseId?: string;
  status?: string;
  provider?: string;
  quoteId?: string;
  amountCents?: number;
  currency?: string;
  executedAt?: string;
  message?: string;
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

    if (quote.status === QuoteStatus.APPROVED_BY_HUMAN) {
      return this.toResponse(quote);
    }

    const updatedQuote = await this.dataSource.transaction(async (manager) => {
      quote.status = QuoteStatus.APPROVED_BY_HUMAN;
      quote.approvedAt = new Date();
      const approvedQuote = await manager.getRepository(Quote).save(quote);

      await this.recordEvent(
        manager,
        approvedQuote.id,
        QuoteEventType.APPROVED_BY_HUMAN,
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
    const updatedQuote = await this.dataSource.transaction(async (manager) => {
      const currentQuote = await manager.getRepository(Quote).findOne({
        where: { id: payload.quoteId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!currentQuote) {
        throw new QuoteDomainError('Quote was not found.');
      }

      if (currentQuote.status === QuoteStatus.EXECUTED) {
        return this.loadQuoteProduct(manager, currentQuote);
      }

      this.ensureNotExpired(currentQuote);

      if (currentQuote.status !== QuoteStatus.APPROVED_BY_HUMAN) {
        throw new QuoteDomainError(
          'Quote can only be executed after human approval.',
        );
      }

      const executionResult = await this.executeSimulatedPayment(currentQuote);

      currentQuote.status = QuoteStatus.EXECUTED;
      currentQuote.executedAt = new Date();
      currentQuote.executionId = currentQuote.id;
      currentQuote.executionResult = executionResult;

      const executedQuote = await manager
        .getRepository(Quote)
        .save(currentQuote);
      await this.loadQuoteProduct(manager, executedQuote);

      await this.recordEvent(
        manager,
        executedQuote.id,
        QuoteEventType.QUOTE_EXECUTED,
        {
          executedBy: payload.executedBy,
          executionResult,
        },
      );

      return executedQuote;
    });

    return this.toResponse(updatedQuote);
  }

  private async executeSimulatedPayment(
    quote: Quote,
  ): Promise<Record<string, unknown>> {
    const response =
      await this.natsRequestClient.request<PaymentSimulationResponse>(
        'payment.simulate.execute',
        {
          quoteId: quote.id,
          amountCents: quote.totalCents,
          currency: 'BOB',
          idempotencyKey: quote.id,
        },
      );

    if (response.error) {
      throw new QuoteDomainError(
        `Payment simulator rejected the request: ${response.error.message}`,
      );
    }

    if (!response.purchaseId || response.status !== 'SIMULATED_SUCCESS') {
      throw new QuoteDomainError(
        'Payment simulator returned an invalid response.',
      );
    }

    return response as Record<string, unknown>;
  }

  private async loadQuoteProduct(
    manager: EntityManager,
    quote: Quote,
  ): Promise<Quote> {
    const product = await manager.getRepository(Product).findOne({
      where: { id: quote.productId },
    });

    if (product) {
      quote.product = product;
    }

    return quote;
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
