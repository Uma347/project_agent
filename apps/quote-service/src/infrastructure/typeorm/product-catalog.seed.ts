import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../quotes/infrastructure/typeorm/product.entity';
import { User } from '../../users/user.entity';

const PRODUCTS: ProductSeed[] = [
  {
    id: '0e2b0f7f-6f5f-4b35-a0d8-1e42dd90791f',
    sku: 'MOCHILA-URBANA',
    name: 'Mochila urbana',
    description: 'Mochila resistente para uso diario, trabajo o universidad.',
    category: 'backpack',
    keywords: ['mochila', 'mochilas', 'morral', 'bolso escolar', 'backpack'],
    tags: ['urbano', 'estudio', 'trabajo', 'viaje corto'],
    priceCents: 28900,
    active: true,
  },
  {
    id: '24e44649-8b2d-42b5-bcfd-46d4f4e4f7a8',
    sku: 'MOCHILA-VIAJE',
    name: 'Mochila de viaje',
    description: 'Mochila amplia con compartimientos para viajes y escapadas.',
    category: 'backpack',
    keywords: ['mochila de viaje', 'mochila viajera', 'viaje', 'equipaje'],
    tags: ['viaje', 'grande', 'organizador'],
    priceCents: 39900,
    active: true,
  },
  {
    id: '8f8e2095-7c5b-4b5b-9ea0-c37f8fd5cc64',
    sku: 'CARTERA-CUERO',
    name: 'Cartera de cuero',
    description: 'Cartera elegante de cuero sintetico para uso cotidiano.',
    category: 'handbag',
    keywords: ['cartera', 'carteras', 'bolso', 'bolsa', 'handbag'],
    tags: ['moda', 'elegante', 'diario'],
    priceCents: 34900,
    active: true,
  },
  {
    id: 'd6a3868d-f4ac-4bf8-b295-573037f08811',
    sku: 'BILLETERA-COMPACTA',
    name: 'Billetera compacta',
    description: 'Billetera pequena con espacio para tarjetas y efectivo.',
    category: 'wallet',
    keywords: ['billetera', 'billeteras', 'monedero', 'wallet'],
    tags: ['compacto', 'tarjetas', 'accesorio'],
    priceCents: 9900,
    active: true,
  },
  {
    id: '62be4a2a-0df9-4422-92f6-0a6d3d8e17d4',
    sku: 'LONCHERA-TERMICA',
    name: 'Lonchera termica',
    description: 'Lonchera termica para conservar alimentos durante el dia.',
    category: 'lunchbag',
    keywords: ['lonchera', 'loncheras', 'termica', 'lunch bag'],
    tags: ['colegio', 'oficina', 'alimentos'],
    priceCents: 15900,
    active: true,
  },
  {
    id: '75b5e2ad-3d99-4f3f-a817-c1a6e5a1f1bb',
    sku: 'CARTUCHERA-ESCOLAR',
    name: 'Cartuchera escolar',
    description: 'Cartuchera para utiles escolares y accesorios pequenos.',
    category: 'pencil_case',
    keywords: ['cartuchera', 'cartucheras', 'estuche', 'lapicera'],
    tags: ['colegio', 'utiles', 'organizador'],
    priceCents: 7900,
    active: true,
  },
  {
    id: 'a7f88841-c6c6-4e68-8848-0da368b64d7a',
    sku: 'MORRAL-CROSSBODY',
    name: 'Morral crossbody',
    description: 'Morral liviano para llevar objetos personales con comodidad.',
    category: 'crossbody',
    keywords: ['morral', 'bolso cruzado', 'crossbody', 'canguro'],
    tags: ['urbano', 'liviano', 'diario'],
    priceCents: 21900,
    active: true,
  },
  {
    id: 'ca56771b-04a7-47d4-9f47-f1577d97682e',
    sku: 'MALETA-CABINA',
    name: 'Maleta de cabina',
    description: 'Maleta compacta para cabina con ruedas y manija extensible.',
    category: 'luggage',
    keywords: ['maleta', 'maletas', 'equipaje', 'carry on', 'cabina'],
    tags: ['viaje', 'ruedas', 'cabina'],
    priceCents: 54900,
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
    id: 'b6fd7d2d-5e56-4b37-a761-2d69b86a9e91',
    firstName: 'Juan',
    lastName: 'Perez',
    email: 'juan.perez@example.com',
    active: true,
  },
  {
    id: '9cc1fe5e-8b25-4e3d-908e-d9aa0d8f51f2',
    firstName: 'Maria',
    lastName: 'Lopez',
    email: 'maria.lopez@example.com',
    active: true,
  },
  {
    id: '47ad93a6-44fa-494c-88cc-7a865639e2d0',
    firstName: 'Carlos',
    lastName: 'Rojas',
    email: 'carlos.rojas@example.com',
    active: true,
  },
  {
    id: 'f2c41e10-a105-4c09-9bc8-e7980799d21e',
    firstName: 'Ana',
    lastName: 'Fernandez',
    email: 'ana.fernandez@example.com',
    active: true,
  },
  {
    id: '6c77170e-87ad-4f49-9848-c618b06030f7',
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
