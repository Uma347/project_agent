const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.product.upsert({
    where: { id: 'burger_classic' },
    update: {},
    create: {
      id: 'burger_classic',
      sku: 'BURGER-CLASSIC',
      name: 'Hamburguesa clasica',
      description: 'Producto simulado interpretado por el AI Agent.',
      priceCents: 1200,
      active: true,
    },
  });

  await prisma.product.upsert({
    where: { id: 'fries_regular' },
    update: {},
    create: {
      id: 'fries_regular',
      sku: 'FRIES-REGULAR',
      name: 'Papas fritas',
      description: 'Producto simulado interpretado por el AI Agent.',
      priceCents: 600,
      active: true,
    },
  });

  await prisma.product.upsert({
    where: { id: 'soda_regular' },
    update: {},
    create: {
      id: 'soda_regular',
      sku: 'SODA-REGULAR',
      name: 'Gaseosa regular',
      description: 'Producto simulado interpretado por el AI Agent.',
      priceCents: 500,
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
