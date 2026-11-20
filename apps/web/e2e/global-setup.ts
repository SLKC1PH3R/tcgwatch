import { createHash } from 'node:crypto';
import { prisma } from '@tcgwatch/db';
import { ITEM_ID, PRODUCT_ID, SESSION_TOKEN } from './fixtures';

/**
 * Jeu de données minimal et idempotent : un compte et sa session, un produit suivi, une ligne de
 * collection et une alerte non vue.
 */
export default async function globalSetup() {
  const user = await prisma.user.upsert({
    where: { email: 'e2e@tcgwatch.test' },
    update: {},
    create: { email: 'e2e@tcgwatch.test', name: 'E2E', passwordHash: 'x' },
  });
  const id = createHash('sha256').update(SESSION_TOKEN).digest('hex');
  await prisma.session.upsert({
    where: { id },
    update: { expiresAt: new Date(Date.now() + 86_400_000) },
    create: { id, userId: user.id, expiresAt: new Date(Date.now() + 86_400_000) },
  });
  await prisma.product.upsert({
    where: { id: PRODUCT_ID },
    update: {},
    create: {
      id: PRODUCT_ID,
      name: 'Display E2E Test (36)',
      slug: 'display-e2e-test-36',
      type: 'DISPLAY',
      msrp: 215.64,
    },
  });
  await prisma.collectionItem.upsert({
    where: { id: ITEM_ID },
    update: { soldAt: null, salePrice: null, saleFees: null, saleChannel: null, quantity: 2 },
    create: {
      id: ITEM_ID,
      productId: PRODUCT_ID,
      quantity: 2,
      purchasePrice: 199,
      purchaseDate: new Date('2026-01-15'),
      store: 'Boutique E2E',
    },
  });
  // Ventes partielles d'un passage précédent : on repart d'une seule ligne.
  await prisma.collectionItem.deleteMany({
    where: { productId: PRODUCT_ID, id: { not: ITEM_ID } },
  });
  await prisma.alertEvent.deleteMany({ where: { dedupeKey: 'e2e' } });
  await prisma.alertEvent.create({
    data: {
      type: 'BACK_IN_STOCK',
      productId: PRODUCT_ID,
      title: '✅ Retour en stock : Display E2E Test (36)',
      message: 'Boutique E2E — 209,90 €',
      dedupeKey: 'e2e',
    },
  });
  await prisma.$disconnect();
}
