import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  Quote,
  QuoteEventType as PrismaQuoteEventType,
  QuoteStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { ApproveQuoteDto } from './application/dto/approve-quote.dto';
import { CreateQuoteDto } from './application/dto/create-quote.dto';
import { ExecuteQuoteDto } from './application/dto/execute-quote.dto';
import { RejectQuoteDto } from './application/dto/reject-quote.dto';
import { QuoteDomainError } from './domain/quote.errors';
import { QuoteEventType } from './domain/quote-event-type';

@Injectable()
export class QuotesService {
  private readonly expirationMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.expirationMinutes = configService.getOrThrow<number>(
      'quote.expirationMinutes',
    );
  }

  async create(payload: CreateQuoteDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: payload.productId },
    });

    if (!product || !product.active) {
      throw new QuoteDomainError('Product is not available for quotation.');
    }

    const now = new Date();
    const expiresAt = this.addMinutes(now, this.expirationMinutes);
    const totalCents = product.priceCents * payload.quantity;

    const quote = await this.prisma.$transaction(async (tx) => {
      const createdQuote = await tx.quote.create({
        data: {
          productId: product.id,
          quantity: payload.quantity,
          unitPriceCents: product.priceCents,
          totalCents,
          status: QuoteStatus.PENDING_HUMAN_APPROVAL,
          expiresAt,
        },
        include: { product: true },
      });

      await this.recordEvent(tx, createdQuote.id, QuoteEventType.CREATED, {
        requestedBy: payload.requestedBy,
        productId: product.id,
        quantity: payload.quantity,
        unitPriceCents: product.priceCents,
        totalCents,
      });

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

    const updatedQuote = await this.prisma.$transaction(async (tx) => {
      const approvedQuote = await tx.quote.update({
        where: { id: payload.quoteId },
        data: {
          status: QuoteStatus.APPROVED,
          approvedAt: new Date(),
        },
        include: { product: true },
      });

      await this.recordEvent(tx, approvedQuote.id, QuoteEventType.APPROVED, {
        approvedBy: payload.approvedBy,
        note: payload.note,
      });

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

    const updatedQuote = await this.prisma.$transaction(async (tx) => {
      const rejectedQuote = await tx.quote.update({
        where: { id: payload.quoteId },
        data: {
          status: QuoteStatus.REJECTED,
          rejectedAt: new Date(),
        },
        include: { product: true },
      });

      await this.recordEvent(tx, rejectedQuote.id, QuoteEventType.REJECTED, {
        rejectedBy: payload.rejectedBy,
        reason: payload.reason,
      });

      return rejectedQuote;
    });

    return this.toResponse(updatedQuote);
  }

  async execute(payload: ExecuteQuoteDto) {
    const quote = await this.findQuoteOrThrow(payload.quoteId);

    if (quote.status === QuoteStatus.EXECUTED) {
      await this.prisma.quoteEvent.create({
        data: {
          quoteId: quote.id,
          eventType: PrismaQuoteEventType.EXECUTION_REPLAYED,
          metadata: {
            executedBy: payload.executedBy,
            executionResult: quote.executionResult,
          },
        },
      });

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

    const updatedQuote = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.quote.updateMany({
        where: {
          id: payload.quoteId,
          status: QuoteStatus.APPROVED,
        },
        data: {
          status: QuoteStatus.EXECUTED,
          executedAt: new Date(),
          executionId,
          executionResult,
        },
      });

      if (updated.count === 0) {
        const currentQuote = await tx.quote.findUniqueOrThrow({
          where: { id: payload.quoteId },
          include: { product: true },
        });

        return currentQuote;
      }

      const executedQuote = await tx.quote.findUniqueOrThrow({
        where: { id: payload.quoteId },
        include: { product: true },
      });

      await this.recordEvent(tx, executedQuote.id, QuoteEventType.EXECUTED, {
        executedBy: payload.executedBy,
        executionResult,
      });

      return executedQuote;
    });

    return this.toResponse(updatedQuote);
  }

  private async findQuoteOrThrow(quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { product: true },
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
    tx: Prisma.TransactionClient,
    quoteId: string,
    eventType: QuoteEventType,
    metadata: Prisma.InputJsonValue,
  ) {
    await tx.quoteEvent.create({
      data: {
        quoteId,
        eventType,
        metadata,
      },
    });
  }

  private toResponse(
    quote: Quote & { product?: { name: string; sku: string } },
  ) {
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
