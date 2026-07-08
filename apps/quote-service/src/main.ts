import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { config as loadEnv } from 'dotenv';
import { AppModule } from './app.module';

async function bootstrap() {
  loadEnv({ path: '../../.env' });
  loadEnv({ path: '.env', override: true });

  const logger = new Logger('QuoteService');
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.NATS,
      options: {
        servers: (process.env.NATS_SERVERS ?? 'nats://localhost:4222')
          .split(',')
          .map((server) => server.trim())
          .filter(Boolean),
        queue: process.env.NATS_QUEUE ?? 'quote-service',
      },
    },
  );

  app.useLogger(logger);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen();
  logger.log('Quote Service listening for NATS messages');
}
void bootstrap();
