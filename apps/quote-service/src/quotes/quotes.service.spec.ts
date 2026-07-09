import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { UserInactiveError, UserNotFoundError } from './domain/quote.errors';
import { QuoteStatus } from './domain/quote.enums';
import { Product } from './infrastructure/typeorm/product.entity';
import { QuoteEvent } from './infrastructure/typeorm/quote-event.entity';
import { Quote } from './infrastructure/typeorm/quote.entity';
import { QuotesService } from './quotes.service';
import { User } from '../users/user.entity';

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

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  firstName: 'Juan',
  lastName: 'Perez',
  email: 'juan.perez@example.com',
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} as User;

describe('QuotesService', () => {
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(10),
  } as unknown as ConfigService;

  function createService(options: {
    dataSource: Partial<DataSource>;
    products?: Partial<Repository<Product>>;
    quotes?: Partial<Repository<Quote>>;
    users?: Partial<Repository<User>>;
    natsRequestClient: { request: jest.Mock };
  }) {
    return new QuotesService(
      options.dataSource as DataSource,
      (options.products ?? {}) as Repository<Product>,
      (options.quotes ?? {}) as Repository<Quote>,
      (options.users ?? {}) as Repository<User>,
      options.natsRequestClient as never,
      configService,
    );
  }

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
      requestedByUserId: user.id,
      requestedBy: user,
      approvedByUserId: null,
      approvedBy: null,
      rejectedByUserId: null,
      rejectedBy: null,
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
    const users = {
      findOne: jest.fn().mockResolvedValue(user),
    };
    const service = createService({
      dataSource: dataSource as unknown as DataSource,
      products,
      users,
      natsRequestClient,
    });

    const response = await service.create({
      prompt: 'quiero comprar dos hamburguesas',
      requestedByUserId: user.id,
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
    expect(users.findOne).toHaveBeenCalledWith({
      where: { id: user.id },
    });
    expect(response.status).toBe(QuoteStatus.PENDING_HUMAN_APPROVAL);
    expect(response.totalCents).toBe(2400);
    expect(response.requestedBy).toEqual({
      id: user.id,
      fullName: 'Juan Perez',
      email: user.email,
    });
    expect(eventCreate).toHaveBeenCalledTimes(1);
    const eventCreateCall = eventCreate.mock.calls[0]?.[0];
    expect(eventCreateCall.eventType).toBe('QUOTE_CREATED');
    expect(eventCreateCall.metadata).toEqual(
      expect.objectContaining({
        userId: user.id,
        userName: 'Juan Perez',
        userEmail: user.email,
      }),
    );
  });

  it('rejects quote creation when the user does not exist', async () => {
    const service = createService({
      dataSource: {},
      products: {},
      users: {
        findOne: jest.fn().mockResolvedValue(null),
      },
      natsRequestClient: { request: jest.fn() },
    });

    await expect(
      service.create({
        prompt: 'quiero comprar dos hamburguesas',
        requestedByUserId: user.id,
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('rejects quote creation when the user is inactive', async () => {
    const service = createService({
      dataSource: {},
      products: {},
      users: {
        findOne: jest.fn().mockResolvedValue({
          ...user,
          active: false,
        }),
      },
      natsRequestClient: { request: jest.fn() },
    });

    await expect(
      service.create({
        prompt: 'quiero comprar dos hamburguesas',
        requestedByUserId: user.id,
      }),
    ).rejects.toBeInstanceOf(UserInactiveError);
  });

  it('executes an approved quote through the payment simulator', async () => {
    const paymentResponse = {
      purchaseId: 'pur_123',
      status: 'SIMULATED_SUCCESS',
      provider: 'qhantuy-payment-simulator',
      quoteId: 'quote-id',
      amountCents: 2400,
      currency: 'BOB',
      executedAt: new Date().toISOString(),
      message:
        'Compra simulada ejecutada correctamente. No se movió dinero real.',
    };
    const quote = {
      id: 'quote-id',
      productId: product.id,
      product,
      quantity: 2,
      unitPriceCents: product.priceCents,
      totalCents: 2400,
      requestedByUserId: user.id,
      requestedBy: user,
      approvedByUserId: user.id,
      approvedBy: user,
      rejectedByUserId: null,
      rejectedBy: null,
      status: QuoteStatus.APPROVED_BY_HUMAN,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      approvedAt: new Date(),
      rejectedAt: null,
      executedAt: null,
      executionId: null,
      executionResult: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Quote;
    const quoteRepository = {
      findOne: jest.fn().mockResolvedValue(quote),
      save: jest.fn(async (payload: Quote) => payload),
    };
    const productRepository = {
      findOne: jest.fn().mockResolvedValue(product),
    };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(user),
    };
    const eventRepository = {
      create: jest.fn((payload: Partial<QuoteEvent>) => payload as QuoteEvent),
      save: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn((callback: (manager: unknown) => unknown) =>
        callback({
          getRepository: jest.fn((entity: unknown) =>
            entity === Quote
              ? quoteRepository
              : entity === Product
                ? productRepository
                : entity === User
                  ? userRepository
                  : eventRepository,
          ),
        }),
      ),
    };
    const natsRequestClient = {
      request: jest.fn().mockResolvedValue(paymentResponse),
    };
    const service = createService({
      dataSource: dataSource as unknown as DataSource,
      natsRequestClient,
    });

    const response = await service.execute({
      quoteId: 'quote-id',
      executedBy: 'human-operator-1',
    });

    expect(natsRequestClient.request).toHaveBeenCalledWith(
      'payment.simulate.execute',
      {
        quoteId: 'quote-id',
        amountCents: 2400,
        currency: 'BOB',
        idempotencyKey: 'quote-id',
      },
    );
    expect(quoteRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'quote-id' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(productRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'burger_classic' },
    });
    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: user.id },
    });
    expect(response.status).toBe(QuoteStatus.EXECUTED);
    expect(response.executionResult).toEqual(paymentResponse);
    expect(eventRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'QUOTE_EXECUTED',
      }),
    );
  });

  it('returns an executed quote without calling the payment simulator again', async () => {
    const executionResult = {
      purchaseId: 'pur_123',
      status: 'SIMULATED_SUCCESS',
    };
    const quote = {
      id: 'quote-id',
      productId: product.id,
      product,
      quantity: 2,
      unitPriceCents: product.priceCents,
      totalCents: 2400,
      requestedByUserId: user.id,
      requestedBy: user,
      approvedByUserId: user.id,
      approvedBy: user,
      rejectedByUserId: null,
      rejectedBy: null,
      status: QuoteStatus.EXECUTED,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      approvedAt: new Date(),
      rejectedAt: null,
      executedAt: new Date(),
      executionId: 'quote-id',
      executionResult,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Quote;
    const quoteRepository = {
      findOne: jest.fn().mockResolvedValue(quote),
    };
    const productRepository = {
      findOne: jest.fn().mockResolvedValue(product),
    };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue(user),
    };
    const dataSource = {
      transaction: jest.fn((callback: (manager: unknown) => unknown) =>
        callback({
          getRepository: jest.fn((entity: unknown) =>
            entity === Quote
              ? quoteRepository
              : entity === Product
                ? productRepository
                : userRepository,
          ),
        }),
      ),
    };
    const natsRequestClient = {
      request: jest.fn(),
    };
    const service = createService({
      dataSource: dataSource as unknown as DataSource,
      natsRequestClient,
    });

    const response = await service.execute({
      quoteId: 'quote-id',
      executedBy: 'human-operator-1',
    });

    expect(natsRequestClient.request).not.toHaveBeenCalled();
    expect(quoteRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'quote-id' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(productRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'burger_classic' },
    });
    expect(response.executionResult).toEqual(executionResult);
  });
});
