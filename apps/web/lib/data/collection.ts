import 'server-only';
import { KEPT_DAILY, prisma } from '@tcgwatch/db';
import { valueCollection } from '@tcgwatch/market';
import { todayUtc, toNumber } from '@tcgwatch/shared';
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

export type CollectionPoint = {
  day: string;
  /** Total payé pour les articles achetés à cette date. */
  invested: number;
  /** Valeur estimée ce jour-là : prix marché, à défaut meilleur prix boutique, à défaut prix payé. */
  value: number;
};

/**
 * Valeur de la collection jour par jour, reconstruite à partir des prix marché et des résumés
 * quotidiens des boutiques (dernier prix connu à chaque date), à côté du total investi.
 */
export async function getCollectionHistory(days = 365): Promise<CollectionPoint[]> {
  const items = await prisma.collectionItem.findMany({
    select: { productId: true, quantity: true, purchasePrice: true, purchaseDate: true },
  });
  if (items.length === 0) return [];
  const ids = [...new Set(items.map((i) => i.productId))];
  const [market, daily] = await Promise.all([
    prisma.marketPrice.findMany({
      where: { productId: { in: ids } },
      select: { productId: true, date: true, price: true },
      orderBy: { date: 'asc' },
    }),
    prisma.listingDaily.findMany({
      where: {
        AND: [
          KEPT_DAILY,
          { listing: { productId: { in: ids } } },
          { minBuyablePrice: { not: null } },
        ],
      },
      select: { date: true, minBuyablePrice: true, listing: { select: { productId: true } } },
      orderBy: { date: 'asc' },
    }),
  ]);
  const key = (d: Date) => d.toISOString().slice(0, 10);
  // Prix par produit et par jour (marché prioritaire, sinon meilleur prix boutique du jour).
  const marketBy = new Map<string, Map<string, number>>();
  for (const m of market) {
    const map = marketBy.get(m.productId) ?? new Map<string, number>();
    map.set(key(m.date), toNumber(m.price)!);
    marketBy.set(m.productId, map);
  }
  const retailBy = new Map<string, Map<string, number>>();
  for (const d of daily) {
    const id = d.listing.productId;
    const map = retailBy.get(id) ?? new Map<string, number>();
    const k = key(d.date);
    map.set(k, Math.min(map.get(k) ?? Infinity, toNumber(d.minBuyablePrice)!));
    retailBy.set(id, map);
  }

  const today = todayUtc();
  const firstPurchase = Math.min(...items.map((i) => i.purchaseDate.getTime()));
  const start = Math.max(firstPurchase, today.getTime() - days * 86_400_000);
  const lastMarket = new Map<string, number>();
  const lastRetail = new Map<string, number>();
  // Les prix antérieurs au début de la fenêtre servent de point de départ.
  const startKey = key(new Date(start));
  for (const id of ids) {
    for (const [k, v] of marketBy.get(id) ?? []) if (k < startKey) lastMarket.set(id, v);
    for (const [k, v] of retailBy.get(id) ?? []) if (k < startKey) lastRetail.set(id, v);
  }

  const points: CollectionPoint[] = [];
  for (let t = start; t <= today.getTime(); t += 86_400_000) {
    const k = key(new Date(t));
    for (const id of ids) {
      const m = marketBy.get(id)?.get(k);
      if (m !== undefined) lastMarket.set(id, m);
      const r = retailBy.get(id)?.get(k);
      if (r !== undefined) lastRetail.set(id, r);
    }
    let invested = 0;
    let value = 0;
    for (const i of items) {
      if (i.purchaseDate.getTime() > t) continue;
      const paid = toNumber(i.purchasePrice)!;
      invested += paid * i.quantity;
      value += (lastMarket.get(i.productId) ?? lastRetail.get(i.productId) ?? paid) * i.quantity;
    }
    points.push({ day: k, invested: round(invested), value: round(value) });
  }
  return points;
}

const round = (n: number) => Math.round(n * 100) / 100;
