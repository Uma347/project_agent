import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentModule } from './agent/agent.module';
import configuration from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { NatsModule } from './infrastructure/nats/nats.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      load: [configuration],
      validate: validateEnvironment,
    }),
    NatsModule,
    AgentModule,
    HealthModule,
  ],
})
export class AppModule {}
