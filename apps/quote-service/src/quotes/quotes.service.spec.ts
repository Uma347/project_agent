import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { QuoteStatus } from './domain/quote.enums';
import { Product } from './infrastructure/typeorm/product.entity';
import { QuoteEvent } from './infrastructure/typeorm/quote-event.entity';
import { Quote } from './infrastructure/typeorm/quote.entity';
import { QuotesService } from './quotes.service';

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
      .fn<QuoteEvent, [Partial<QuoteEvent>]>()
      .mockImplementation((payload) => payload as QuoteEvent);
    const eventSave = jest.fn<Promise<QuoteEvent>, [QuoteEvent]>();
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
    const quoteRepository = {
      create: jest.fn((payload: Partial<Quote>) => payload as Quote),
      save: quoteCreate,
    };
    const eventRepository = {
      create: eventCreate,
      save: eventSave,
    };
    const dataSource = {
      transaction: jest.fn((callback: (manager: unknown) => unknown) =>
        callback({
          getRepository: jest.fn((entity: unknown) =>
            entity === Quote ? quoteRepository : eventRepository,
          ),
        }),
      ),
    };
    const products = {
      findOne: jest.fn().mockResolvedValue(product),
    };
    const service = new QuotesService(
      dataSource as unknown as DataSource,
      products as unknown as Repository<Product>,
      {} as Repository<Quote>,
      {} as Repository<QuoteEvent>,
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
    expect(products.findOne).toHaveBeenCalledWith({
      where: { id: 'burger_classic' },
    });
    expect(response.status).toBe(QuoteStatus.PENDING_HUMAN_APPROVAL);
    expect(response.totalCents).toBe(2400);
    expect(eventCreate).toHaveBeenCalledTimes(1);
    const eventCreateCall = eventCreate.mock.calls[0]?.[0];
    expect(eventCreateCall.eventType).toBe('QUOTE_CREATED');
  });
});
