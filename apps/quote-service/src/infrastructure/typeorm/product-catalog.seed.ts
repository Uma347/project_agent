import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../quotes/infrastructure/typeorm/product.entity';
import { User } from '../../users/user.entity';

const PRODUCTS: ProductSeed[] = [
  {
    id: 'burger_classic',
    sku: 'BURGER-CLASSIC',
    name: 'Hamburguesa clasica',
    description: 'Hamburguesa clasica de carne para cotizaciones demo.',
    category: 'food',
    keywords: ['hamburguesa', 'hamburguesas', 'burger', 'burgers'],
    tags: ['comida', 'clasico', 'carne'],
    priceCents: 2500,
    active: true,
  },
  {
    id: 'fries_regular',
    sku: 'FRIES-REGULAR',
    name: 'Papas fritas',
    description: 'Porcion regular de papas fritas para acompanar pedidos.',
    category: 'food',
    keywords: ['papas', 'papas fritas', 'fritas', 'fries'],
    tags: ['comida', 'acompanamiento'],
    priceCents: 600,
    active: true,
  },
  {
    id: 'soda_regular',
    sku: 'SODA-REGULAR',
    name: 'Gaseosa regular',
    description: 'Bebida gaseosa regular para pedidos de comida.',
    category: 'drink',
    keywords: ['gaseosa', 'refresco', 'soda', 'bebida'],
    tags: ['bebida', 'gaseosa'],
    priceCents: 500,
    active: true,
  },
];

type ProductSeed = Pick<
  Product,
  | 'id'
  | 'sku'
  | 'name'
  | 'description'
  | 'category'
  | 'keywords'
  | 'tags'
  | 'priceCents'
  | 'active'
>;

const USERS: UserSeed[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    firstName: 'Juan',
    lastName: 'Perez',
    email: 'juan.perez@example.com',
    active: true,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    firstName: 'Maria',
    lastName: 'Lopez',
    email: 'maria.lopez@example.com',
    active: true,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    firstName: 'Carlos',
    lastName: 'Rojas',
    email: 'carlos.rojas@example.com',
    active: true,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    firstName: 'Ana',
    lastName: 'Fernandez',
    email: 'ana.fernandez@example.com',
    active: true,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    firstName: 'Pedro',
    lastName: 'Gomez',
    email: 'pedro.gomez@example.com',
    active: true,
  },
];

type UserSeed = Pick<
  User,
  'id' | 'firstName' | 'lastName' | 'email' | 'active'
>;

@Injectable()
export class ProductCatalogSeed implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.products.upsert(PRODUCTS, ['id']);
    await this.users.upsert(USERS, ['id']);
  }
}
