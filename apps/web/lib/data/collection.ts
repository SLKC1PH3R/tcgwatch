import 'server-only';
import { prisma } from '@tcgwatch/db';
import { valueCollection } from '@tcgwatch/market';
import { toNumber } from '@tcgwatch/shared';
import { bestOffer, getProducts } from './products';

/** Dernier prix marché connu par produit (toutes sources confondues). */
export async function latestMarketPrices(): Promise<
  Map<string, { price: number; date: Date; source: string }>
> {
  const rows = await prisma.marketPrice.findMany({
    distinct: ['productId'],
    orderBy: [{ productId: 'asc' }, { date: 'desc' }, { updatedAt: 'desc' }],
  });
  return new Map(
    rows.map((r) => [r.productId, { price: toNumber(r.price)!, date: r.date, source: r.source }]),
  );
}

export async function getCollection() {
  const [items, market, products] = await Promise.all([
    prisma.collectionItem.findMany({
      include: { product: { select: { id: true, name: true, type: true, imageUrl: true } } },
      orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
    }),
    latestMarketPrices(),
    getProducts(),
  ]);

  const retail = new Map<string, number>();
  for (const p of products) {
    const best = bestOffer(p.listings);
    if (best) retail.set(p.id, best.price);
  }
  const marketPrice = new Map([...market].map(([id, m]) => [id, m.price]));

  const rows = items.map((i) => {
    const purchasePrice = toNumber(i.purchasePrice)!;
    const unitValue = marketPrice.get(i.productId) ?? retail.get(i.productId) ?? null;
    return {
      id: i.id,
      product: i.product,
      quantity: i.quantity,
      purchasePrice,
      purchaseDate: i.purchaseDate,
      store: i.store,
      condition: i.condition,
      photoPath: i.photoPath,
      notes: i.notes,
      unitValue,
      valueSource: marketPrice.has(i.productId)
        ? ('marché' as const)
        : retail.has(i.productId)
          ? ('boutique' as const)
          : null,
      gain: unitValue !== null ? (unitValue - purchasePrice) * i.quantity : null,
    };
  });

  const valuation = valueCollection({
    lines: items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      purchasePrice: toNumber(i.purchasePrice)!,
    })),
    marketPrice,
    retailPrice: retail,
  });

  return { rows, valuation };
}
