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

/**
 * Cartes possédées valorisées à leur cote Cardmarket (tendance). Sans prix d'achat saisi, une
 * carte compte pour 0 € investi : elle vient en général d'un booster déjà payé.
 */
async function getOwnedCardLines() {
  const owned = await prisma.ownedCard.findMany({
    select: {
      cardId: true,
      quantity: true,
      purchasePrice: true,
      createdAt: true,
      card: { select: { priceTrend: true } },
    },
  });
  return owned.map((o) => ({
    cardId: o.cardId,
    quantity: o.quantity,
    paid: toNumber(o.purchasePrice) ?? 0,
    price: toNumber(o.card.priceTrend) ?? 0,
    createdAt: o.createdAt,
  }));
}

export async function getCollection() {
  const [items, market, products, cardLines] = await Promise.all([
    prisma.collectionItem.findMany({
      include: { product: { select: { id: true, name: true, type: true, imageUrl: true } } },
      orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
    }),
    latestMarketPrices(),
    getProducts(),
    getOwnedCardLines(),
  ]);

  const retail = new Map<string, number>();
  for (const p of products) {
    const best = bestOffer(p.listings);
    if (best) retail.set(p.id, best.price);
  }
  const marketPrice = new Map([...market].map(([id, m]) => [id, m.price]));

  const held = items.filter((i) => i.soldAt === null);
  const rows = held.map((i) => {
    const purchasePrice = toNumber(i.purchasePrice)!;
    const shipping = toNumber(i.shipping);
    const unitCost = lineUnitCost(i);
    const unitValue = marketPrice.get(i.productId) ?? retail.get(i.productId) ?? null;
    return {
      id: i.id,
      product: i.product,
      quantity: i.quantity,
      purchasePrice,
      shipping,
      unitCost,
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
      gain: unitValue !== null ? round((unitValue - unitCost) * i.quantity) : null,
    };
  });

  // Reventes : plus-value réalisée = prix de vente − frais − coût d'achat (port compris).
  const sold = items
    .filter((i) => i.soldAt !== null)
    .map((i) => {
      const unitCost = lineUnitCost(i);
      const salePrice = toNumber(i.salePrice) ?? 0;
      const saleFees = toNumber(i.saleFees) ?? 0;
      const cost = round(unitCost * i.quantity);
      const proceeds = round(salePrice * i.quantity - saleFees);
      return {
        id: i.id,
        product: i.product,
        quantity: i.quantity,
        purchasePrice: toNumber(i.purchasePrice)!,
        shipping: toNumber(i.shipping),
        unitCost,
        purchaseDate: i.purchaseDate,
        store: i.store,
        condition: i.condition,
        notes: i.notes,
        soldAt: i.soldAt!,
        salePrice,
        saleFees,
        saleChannel: i.saleChannel,
        cost,
        proceeds,
        gain: round(proceeds - cost),
      };
    })
    .sort((a, b) => b.soldAt.getTime() - a.soldAt.getTime());
  const realized = {
    count: sold.reduce((n, r) => n + r.quantity, 0),
    cost: round(sold.reduce((s, r) => s + r.cost, 0)),
    proceeds: round(sold.reduce((s, r) => s + r.proceeds, 0)),
    gain: round(sold.reduce((s, r) => s + r.gain, 0)),
  };

  const sealed = valueCollection({
    lines: held.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      purchasePrice: lineUnitCost(i),
    })),
    marketPrice,
    retailPrice: retail,
  });

  const cards = {
    value: round(cardLines.reduce((s, l) => s + l.price * l.quantity, 0)),
    cost: round(cardLines.reduce((s, l) => s + l.paid * l.quantity, 0)),
    copies: cardLines.reduce((n, l) => n + l.quantity, 0),
    distinct: new Set(cardLines.map((l) => l.cardId)).size,
  };
  // Valorisation de toute la collection : scellé + cartes.
  const totalCost = round(sealed.totalCost + cards.cost);
  const estimatedValue = round(sealed.estimatedValue + cards.value);
  const valuation = {
    ...sealed,
    totalCost,
    estimatedValue,
    unrealizedGain: round(estimatedValue - totalCost),
    ratio: totalCost > 0 ? estimatedValue / totalCost : null,
    sealed,
    cards,
  };

  return { rows, sold, realized, valuation };
}

/** Coût unitaire d'une ligne : prix payé + sa part des frais de port. */
function lineUnitCost(i: {
  purchasePrice: Parameters<typeof toNumber>[0];
  shipping: Parameters<typeof toNumber>[0];
  quantity: number;
}): number {
  const shipping = toNumber(i.shipping) ?? 0;
  return round(toNumber(i.purchasePrice)! + shipping / Math.max(1, i.quantity));
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
  const [items, cardLines] = await Promise.all([
    prisma.collectionItem.findMany({
      select: {
        productId: true,
        quantity: true,
        purchasePrice: true,
        shipping: true,
        purchaseDate: true,
        soldAt: true,
      },
    }),
    getOwnedCardLines(),
  ]);
  if (items.length === 0 && cardLines.length === 0) return [];
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
  // Cartes : comptées à partir de leur ajout, à leur cote actuelle (pas d'historique par carte).
  const firstPurchase = Math.min(
    ...items.map((i) => i.purchaseDate.getTime()),
    ...cardLines.map((l) => l.createdAt.getTime()),
  );
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
      // Revendu : sort de la collection (valeur et investi) à partir du jour de la vente.
      if (i.purchaseDate.getTime() > t || (i.soldAt && i.soldAt.getTime() <= t)) continue;
      const paid = lineUnitCost(i);
      invested += paid * i.quantity;
      value += (lastMarket.get(i.productId) ?? lastRetail.get(i.productId) ?? paid) * i.quantity;
    }
    for (const l of cardLines) {
      if (l.createdAt.getTime() > t + 86_399_999) continue;
      invested += l.paid * l.quantity;
      value += l.price * l.quantity;
    }
    points.push({ day: k, invested: round(invested), value: round(value) });
  }
  return points;
}

const round = (n: number) => Math.round(n * 100) / 100;
