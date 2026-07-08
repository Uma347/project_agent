import { ConfigService } from '@nestjs/config';
import { QuoteStatus } from '@prisma/client';
import { QuotesService } from './quotes.service';

type TransactionMock = {
  quote: { create: jest.Mock };
  quoteEvent: { create: jest.Mock };
};

const product = {
  id: '5bf4eabc-9b9d-474a-b619-99ac88877777',
  sku: 'TOTTO-BACKPACK-001',
  name: 'Mochila Totto Campus',
  description: 'Mochila simulada para cotizaciones.',
  priceCents: 24900,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('QuotesService', () => {
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(10),
  } as unknown as ConfigService;

  it('creates a quote pending human approval', async () => {
    const eventCreate = jest.fn().mockResolvedValue({});
    const quoteCreate = jest.fn().mockResolvedValue({
      id: 'quote-id',
      productId: product.id,
      product,
      quantity: 2,
      unitPriceCents: product.priceCents,
      totalCents: product.priceCents * 2,
      status: QuoteStatus.PENDING_HUMAN_APPROVAL,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      approvedAt: null,
      rejectedAt: null,
      executedAt: null,
      executionId: null,
      executionResult: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue(product),
      },
      $transaction: jest.fn((callback: (tx: TransactionMock) => unknown) =>
        callback({
          quote: { create: quoteCreate },
          quoteEvent: { create: eventCreate },
        }),
      ),
    };
    const service = new QuotesService(prisma as never, configService);

    const response = await service.create({
      productId: product.id,
      quantity: 2,
    });

    expect(response.status).toBe(QuoteStatus.PENDING_HUMAN_APPROVAL);
    expect(response.totalCents).toBe(49800);
    expect(eventCreate).toHaveBeenCalledTimes(1);
  });
});
