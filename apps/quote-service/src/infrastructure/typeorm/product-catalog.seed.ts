import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../quotes/infrastructure/typeorm/product.entity';

const PRODUCTS: ProductSeed[] = [
  {
    id: 'burger_classic',
    sku: 'BURGER-CLASSIC',
    name: 'Hamburguesa clasica',
    description: 'Producto simulado interpretado por el AI Agent.',
    priceCents: 1200,
    active: true,
  },
  {
    id: 'fries_regular',
    sku: 'FRIES-REGULAR',
    name: 'Papas fritas',
    description: 'Producto simulado interpretado por el AI Agent.',
    priceCents: 600,
    active: true,
  },
  {
    id: 'soda_regular',
    sku: 'SODA-REGULAR',
    name: 'Gaseosa regular',
    description: 'Producto simulado interpretado por el AI Agent.',
    priceCents: 500,
    active: true,
  },
];

type ProductSeed = Pick<
  Product,
  'id' | 'sku' | 'name' | 'description' | 'priceCents' | 'active'
>;

@Injectable()
export class ProductCatalogSeed implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.products.upsert(PRODUCTS, ['id']);
  }
}
