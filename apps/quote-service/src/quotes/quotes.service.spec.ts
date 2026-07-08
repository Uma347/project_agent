import { ConfigService } from '@nestjs/config';
import { QuoteStatus } from '@prisma/client';
import { QuotesService } from './quotes.service';

type TransactionMock = {
  quote: { create: jest.Mock };
  quoteEvent: { create: jest.Mock };
};

const product = {
  id: 'burger_classic',
  sku: 'BURGER-CLASSIC',
  name: 'Hamburguesa clasica',
  description: 'Mochila simulada para cotizaciones.',
  priceCents: 1200,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('QuotesService', () => {
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(10),
  } as unknown as ConfigService;

  it('creates a quote pending human approval', async () => {
    const natsRequestClient = {
      request: jest.fn().mockResolvedValue({
        productId: 'burger_classic',
        quantity: 2,
        reason: 'Producto identificado desde la intencion del usuario',
      }),
    };
    const eventCreate = jest
      .fn<Promise<unknown>, [{ data: { eventType: string } }]>()
      .mockResolvedValue({});
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
    const service = new QuotesService(
      prisma as never,
      natsRequestClient as never,
      configService,
    );

    const response = await service.create({
      prompt: 'quiero comprar dos hamburguesas',
    });

    expect(natsRequestClient.request).toHaveBeenCalledWith(
      'ai.intent.interpret',
      {
        prompt: 'quiero comprar dos hamburguesas',
      },
    );
    expect(prisma.product.findUnique).toHaveBeenCalledWith({
      where: { id: 'burger_classic' },
    });
    expect(response.status).toBe(QuoteStatus.PENDING_HUMAN_APPROVAL);
    expect(response.totalCents).toBe(2400);
    expect(eventCreate).toHaveBeenCalledTimes(1);
    const eventCreateCall = eventCreate.mock.calls[0]?.[0];
    expect(eventCreateCall.data.eventType).toBe('QUOTE_CREATED');
  });
});
