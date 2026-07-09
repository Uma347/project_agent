import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { NATS_SUBJECTS } from '../infrastructure/nats/nats.constants';
import { NatsRequestClient } from '../infrastructure/nats/nats-request.client';
import {
  CatalogProductSearchRequestDto,
  CatalogProductSearchResponseDto,
  CatalogSearchProductDto,
} from './application/dto/catalog-search.dto';
import { ApproveQuoteDto } from './application/dto/approve-quote.dto';
import { CreateQuoteDto } from './application/dto/create-quote.dto';
import { ExecuteQuoteDto } from './application/dto/execute-quote.dto';
import { RejectQuoteDto } from './application/dto/reject-quote.dto';
import {
  QuoteDomainError,
  QuoteNotFoundError,
  UserInactiveError,
  UserNotFoundError,
} from './domain/quote.errors';
import { QuoteEventType, QuoteStatus } from './domain/quote.enums';
import { Product } from './infrastructure/typeorm/product.entity';
import { QuoteEvent } from './infrastructure/typeorm/quote-event.entity';
import { Quote } from './infrastructure/typeorm/quote.entity';
import { User } from '../users/user.entity';

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
  private readonly logger = new Logger(QuotesService.name);
  private readonly expirationMinutes: number;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Quote)
    private readonly quotes: Repository<Quote>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly natsRequestClient: NatsRequestClient,
    configService: ConfigService,
  ) {
    this.expirationMinutes = configService.getOrThrow<number>(
      'quote.expirationMinutes',
    );
  }

  async create(payload: CreateQuoteDto) {
    const requestedBy = await this.findActiveUserOrThrow(
      payload.requestedByUserId,
    );
    const interpretation =
      await this.natsRequestClient.request<IntentInterpretationResponse>(
        NATS_SUBJECTS.AI_INTENT_INTERPRET,
        {
          prompt: payload.prompt,
        },
      );

    if (interpretation.error) {
      throw new QuoteDomainError(interpretation.error.message);
    }

    const quantity = payload.quantity ?? interpretation.quantity;

    if (
      !interpretation.productId ||
      !Number.isInteger(quantity) ||
      quantity === undefined ||
      quantity < 1
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
          requestedByUserId: requestedBy.id,
          requestedBy,
          status: QuoteStatus.PENDING_HUMAN_APPROVAL,
          expiresAt,
        }),
      );

      await this.recordEvent(
        manager,
        createdQuote.id,
        QuoteEventType.QUOTE_CREATED,
        {
          prompt: payload.prompt,
          interpretationReason: interpretation.reason,
          productId: product.id,
          quantity,
          unitPriceCents,
          totalCents,
          ...this.toUserAuditMetadata(requestedBy),
        },
      );

      return createdQuote;
    });

    return this.toResponse(quote);
  }

  async approve(payload: ApproveQuoteDto) {
    const approvedBy = await this.findActiveUserOrThrow(
      payload.approvedByUserId,
    );
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
      quote.approvedByUserId = approvedBy.id;
      quote.approvedBy = approvedBy;
      const approvedQuote = await manager.getRepository(Quote).save(quote);

      await this.recordEvent(
        manager,
        approvedQuote.id,
        QuoteEventType.APPROVED_BY_HUMAN,
        {
          note: payload.note,
          ...this.toUserAuditMetadata(approvedBy),
        },
      );

      return approvedQuote;
    });

    return this.toResponse(updatedQuote);
  }

  async reject(payload: RejectQuoteDto) {
    const rejectedBy = await this.findActiveUserOrThrow(
      payload.rejectedByUserId,
    );
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
      quote.rejectedByUserId = rejectedBy.id;
      quote.rejectedBy = rejectedBy;
      const rejectedQuote = await manager.getRepository(Quote).save(quote);

      await this.recordEvent(
        manager,
        rejectedQuote.id,
        QuoteEventType.REJECTED,
        {
          reason: payload.reason,
          ...this.toUserAuditMetadata(rejectedBy),
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
        throw new QuoteNotFoundError();
      }

      if (currentQuote.status === QuoteStatus.EXECUTED) {
        return this.loadQuoteRelations(manager, currentQuote);
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
      await this.loadQuoteRelations(manager, executedQuote);

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

  async searchCatalogProducts(
    payload: CatalogProductSearchRequestDto,
  ): Promise<CatalogProductSearchResponseDto> {
    if (!payload || typeof payload.query !== 'string' || !payload.query.trim()) {
      return {
        error: {
          code: 'INVALID_CATALOG_SEARCH_REQUEST',
          message:
            "El campo 'query' es requerido y debe ser un texto no vacio.",
        },
      };
    }

    const query = payload.query.trim();
    const limit =
      typeof payload.limit === 'number' && Number.isInteger(payload.limit)
        ? Math.min(Math.max(payload.limit, 1), 20)
        : 5;
    const terms = this.extractSearchTerms(query);

    this.logger.debug(
      `Searching catalog products for query="${query}" limit=${limit}`,
    );

    const queryBuilder = this.products
      .createQueryBuilder('product')
      .where('product.active = :active', { active: true })
      .andWhere(
        `(
          product.name ILIKE :queryLike
          OR product.description ILIKE :queryLike
          OR product.category ILIKE :queryLike
          OR EXISTS (
            SELECT 1 FROM unnest(product.keywords) AS keyword(value)
            WHERE lower(:query) LIKE '%' || lower(keyword.value) || '%'
          )
          OR EXISTS (
            SELECT 1 FROM unnest(product.tags) AS tag(value)
            WHERE lower(:query) LIKE '%' || lower(tag.value) || '%'
          )
          OR product.name ILIKE ANY(:termLikes)
          OR product.description ILIKE ANY(:termLikes)
          OR product.category ILIKE ANY(:termLikes)
          OR EXISTS (
            SELECT 1 FROM unnest(product.keywords) AS keyword(value)
            WHERE keyword.value ILIKE ANY(:termLikes)
          )
          OR EXISTS (
            SELECT 1 FROM unnest(product.tags) AS tag(value)
            WHERE tag.value ILIKE ANY(:termLikes)
          )
        )`,
        {
          query,
          queryLike: `%${query}%`,
          termLikes: terms.map((term) => `%${term}%`),
        },
      )
      .orderBy('product.name', 'ASC')
      .take(limit);

    const products = await queryBuilder.getMany();

    return {
      products: products.map((product) => this.toCatalogSearchProduct(product)),
    };
  }

  private async executeSimulatedPayment(
    quote: Quote,
  ): Promise<Record<string, unknown>> {
    const response =
      await this.natsRequestClient.request<PaymentSimulationResponse>(
        NATS_SUBJECTS.PAYMENT_SIMULATE_EXECUTE,
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

  private async loadQuoteRelations(
    manager: EntityManager,
    quote: Quote,
  ): Promise<Quote> {
    await this.loadQuoteProduct(manager, quote);

    const userRepository = manager.getRepository(User);
    const userIds = [
      quote.requestedByUserId,
      quote.approvedByUserId,
      quote.rejectedByUserId,
    ].filter((userId): userId is string => Boolean(userId));

    const users = await Promise.all(
      userIds.map((userId) =>
        userRepository.findOne({ where: { id: userId } }),
      ),
    );
    const userById = new Map(
      users
        .filter((user): user is User => Boolean(user))
        .map((user) => [user.id, user]),
    );

    quote.requestedBy = quote.requestedByUserId
      ? (userById.get(quote.requestedByUserId) ?? null)
      : null;
    quote.approvedBy = quote.approvedByUserId
      ? (userById.get(quote.approvedByUserId) ?? null)
      : null;
    quote.rejectedBy = quote.rejectedByUserId
      ? (userById.get(quote.rejectedByUserId) ?? null)
      : null;

    return quote;
  }

  private async findActiveUserOrThrow(userId: string): Promise<User> {
    const user = await this.users.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    if (!user.active) {
      throw new UserInactiveError();
    }

    return user;
  }

  private async findQuoteOrThrow(quoteId: string) {
    const quote = await this.quotes.findOne({
      where: { id: quoteId },
      relations: {
        product: true,
        requestedBy: true,
        approvedBy: true,
        rejectedBy: true,
      },
    });

    if (!quote) {
      throw new QuoteNotFoundError();
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

  private extractSearchTerms(query: string): string[] {
    const terms = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .match(/[a-z0-9]+/g);

    return terms && terms.length > 0 ? terms : [query.toLowerCase()];
  }

  private toCatalogSearchProduct(product: Product): CatalogSearchProductDto {
    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      category: product.category,
      keywords: product.keywords,
      tags: product.tags,
      priceCents: product.priceCents,
    };
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
      requestedBy: quote.requestedBy
        ? this.toUserResponse(quote.requestedBy)
        : undefined,
      approvedBy: quote.approvedBy
        ? this.toUserResponse(quote.approvedBy)
        : undefined,
      rejectedBy: quote.rejectedBy
        ? this.toUserResponse(quote.rejectedBy)
        : undefined,
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

  private toUserAuditMetadata(user: User) {
    return {
      userId: user.id,
      userName: this.toUserFullName(user),
      userEmail: user.email,
    };
  }

  private toUserResponse(user: User) {
    return {
      id: user.id,
      fullName: this.toUserFullName(user),
      email: user.email,
    };
  }

  private toUserFullName(user: User): string {
    return `${user.firstName} ${user.lastName}`;
  }
}
