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
      prompt: 'quiero comprar dos hamburguesas',
    };
    quotesService.create.mockReturnValue({ id: 'quote-id' });

    expect(controller.create(payload)).toEqual({ id: 'quote-id' });
    expect(quotesService.create).toHaveBeenCalledWith(payload);
  });
});
