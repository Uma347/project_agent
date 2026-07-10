import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { NATS_CLIENT } from './nats.constants';

@Injectable()
export class NatsRequestClient implements OnModuleDestroy {
  private readonly logger = new Logger(NatsRequestClient.name);
  private readonly timeoutMs: number;

  constructor(
    @Inject(NATS_CLIENT) private readonly client: ClientProxy,
    configService: ConfigService,
  ) {
    this.timeoutMs = configService.getOrThrow<number>('nats.timeoutMs');
  }

  async request<TResponse, TPayload = unknown>(
    pattern: string,
    payload: TPayload,
  ): Promise<TResponse> {
    this.logger.debug(`Sending NATS request: ${pattern}`);

    return firstValueFrom(
      this.client.send<TResponse, TPayload>(pattern, payload).pipe(
        timeout({
          first: this.timeoutMs,
        }),
      ),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
