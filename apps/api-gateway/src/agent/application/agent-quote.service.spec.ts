import { BadGatewayException, HttpException } from '@nestjs/common';
import { NatsRequestClient } from '../../infrastructure/nats/nats-request.client';
import { AgentQuoteService } from './agent-quote.service';

describe('AgentQuoteService', () => {
  const natsRequestClient = {
    request: jest.fn(),
  } as unknown as jest.Mocked<NatsRequestClient>;
  let service: AgentQuoteService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AgentQuoteService(natsRequestClient);
  });

  it('propagates quote-service RPC http errors with their status code', async () => {
    natsRequestClient.request.mockRejectedValue({
      statusCode: 404,
      message: 'User was not found.',
    });

    await expect(
      service.create({
        prompt: 'quiero comprar dos hamburguesas',
        requestedByUserId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: 'User was not found.',
    } satisfies Partial<HttpException>);
  });

  it('keeps unknown quote-service errors as bad gateway', async () => {
    natsRequestClient.request.mockRejectedValue(new Error('boom'));

    await expect(
      service.create({
        prompt: 'quiero comprar dos hamburguesas',
        requestedByUserId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
