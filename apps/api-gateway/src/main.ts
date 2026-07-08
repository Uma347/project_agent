import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const logger = new Logger('ApiGateway');
  const configService = app.get(ConfigService);

  app.useLogger(logger);
  app.setGlobalPrefix(configService.getOrThrow<string>('app.globalPrefix'));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.getOrThrow<string>('swagger.title'))
    .setDescription(configService.getOrThrow<string>('swagger.description'))
    .setVersion(configService.getOrThrow<string>('swagger.version'))
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(
    configService.getOrThrow<string>('swagger.path'),
    app,
    document,
  );

  const port = configService.getOrThrow<number>('app.port');
  await app.listen(port);
  logger.log(`API Gateway running on port ${port}`);
}
void bootstrap();
