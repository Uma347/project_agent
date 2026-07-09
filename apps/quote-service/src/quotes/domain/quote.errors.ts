import { RpcException } from '@nestjs/microservices';

export class QuoteDomainError extends RpcException {
  constructor(message: string, statusCode = 400) {
    super({
      statusCode,
      message,
    });
  }
}

export class QuoteNotFoundError extends QuoteDomainError {
  constructor() {
    super('Quote was not found.', 404);
  }
}

export class UserNotFoundError extends QuoteDomainError {
  constructor() {
    super('User was not found.', 404);
  }
}

export class UserInactiveError extends QuoteDomainError {
  constructor() {
    super('User is not enabled.');
  }
}
