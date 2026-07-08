import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.product.upsert({
    where: { sku: 'TOTTO-BACKPACK-001' },
    update: {},
    create: {
      sku: 'TOTTO-BACKPACK-001',
      name: 'Mochila Totto Campus',
      description: 'Producto simulado para flujo de cotizacion.',
      priceCents: 24900,
      active: true,
    },
  });

  await prisma.product.upsert({
    where: { sku: 'TOTTO-LUNCH-002' },
    update: {},
    create: {
      sku: 'TOTTO-LUNCH-002',
      name: 'Lonchera Totto Eco',
      description: 'Producto simulado para flujo de cotizacion.',
      priceCents: 8900,
      active: true,
    },
  });

  await prisma.product.upsert({
    where: { sku: 'TOTTO-PENCIL-003' },
    update: {},
    create: {
      sku: 'TOTTO-PENCIL-003',
      name: 'Cartuchera Totto Neon',
      description: 'Producto simulado para flujo de cotizacion.',
      priceCents: 3900,
      active: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
