import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { NATS_CLIENT } from './nats.constants';
import { NatsRequestClient } from './nats-request.client';

@Module({
  providers: [
    {
      provide: NATS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        ClientProxyFactory.create({
          transport: Transport.NATS,
          options: {
            servers: configService.getOrThrow<string[]>('nats.servers'),
          },
        }),
    },
    NatsRequestClient,
  ],
  exports: [NatsRequestClient],
})
export class NatsModule {}
