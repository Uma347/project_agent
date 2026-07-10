import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCatalogSeed } from './product-catalog.seed';
import { Product } from '../../quotes/infrastructure/typeorm/product.entity';
import { QuoteEvent } from '../../quotes/infrastructure/typeorm/quote-event.entity';
import { Quote } from '../../quotes/infrastructure/typeorm/quote.entity';
import { User } from '../../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.getOrThrow<string>('DATABASE_URL'),
        entities: [Product, Quote, QuoteEvent, User],
        synchronize: true,
      }),
    }),
    TypeOrmModule.forFeature([Product, User]),
  ],
  providers: [ProductCatalogSeed],
})
export class DatabaseModule {}
