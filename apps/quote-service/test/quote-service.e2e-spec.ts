import { Test, TestingModule } from '@nestjs/testing';
import { QuotesController } from '../src/quotes/quotes.controller';
import { QuotesService } from '../src/quotes/quotes.service';

describe('Quote Service NATS handlers (e2e)', () => {
  let controller: QuotesController;
  const quotesService = {
    create: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    execute: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuotesController],
      providers: [
        {
          provide: QuotesService,
          useValue: quotesService,
        },
      ],
    }).compile();

    controller = moduleFixture.get(QuotesController);
    jest.clearAllMocks();
  });

  it('delegates quote creation messages to the application service', () => {
    const payload = {
      productId: '5bf4eabc-9b9d-474a-b619-99ac88877777',
      quantity: 1,
    };
    quotesService.create.mockReturnValue({ id: 'quote-id' });

    expect(controller.create(payload)).toEqual({ id: 'quote-id' });
    expect(quotesService.create).toHaveBeenCalledWith(payload);
  });
});
