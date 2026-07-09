import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCatalogSeed } from './product-catalog.seed';
import { Product } from '../../quotes/infrastructure/typeorm/product.entity';
import { QuoteEvent } from '../../quotes/infrastructure/typeorm/quote-event.entity';
import { Quote } from '../../quotes/infrastructure/typeorm/quote.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.getOrThrow<string>('DATABASE_URL'),
        entities: [Product, Quote, QuoteEvent],
        synchronize: true,
      }),
    }),
    TypeOrmModule.forFeature([Product]),
  ],
  providers: [ProductCatalogSeed],
})
export class DatabaseModule {}
