import { RpcException } from '@nestjs/microservices';

export class QuoteDomainError extends RpcException {
  constructor(message: string) {
    super({
      statusCode: 400,
      message,
    });
  }
}
