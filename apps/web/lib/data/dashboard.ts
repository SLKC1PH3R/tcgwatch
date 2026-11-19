import 'server-only';
import { KEPT_DAILY, prisma } from '@tcgwatch/db';
import { priceChange } from '@tcgwatch/market';
import { toNumber, type ProductTypeKey } from '@tcgwatch/shared';
import { getCollection, getCollectionHistory } from './collection';
import { findDeals } from './deals';
import { getSealedPrices } from './prices';
import { getUpcomingEvents } from './releases';

/** Libellés courts pour la répartition de la collection. */
const TYPE_SHORT: Record<ProductTypeKey, string> = {
  ETB: 'ETB',
  DISPLAY: 'Displays',
  TRIPACK: 'Tripacks',
  BOOSTER: 'Boosters',
  BLISTER: 'Blisters',
  COFFRET: 'Coffrets',
  UPC: 'UPC',
  MINI_TIN: 'Mini Tins',
  POKEBOX: 'Pokébox',
  DECK: 'Decks',
  AUTRE: 'Autres',
};

/**
 * Répartition de la valeur de la collection par type de produit (valeur estimée, à défaut prix
 * d'achat). Les plus petits types au-delà de `max` sont regroupés dans « Autres ».
 */
function breakdownByType(
  rows: {
    product: { type: string };
    quantity: number;
    purchasePrice: number;
    unitValue: number | null;
  }[],
  max = 5,
) {
  const byType = new Map<string, number>();
  for (const r of rows) {
    const v = (r.unitValue ?? r.purchasePrice) * r.quantity;
    byType.set(r.product.type, (byType.get(r.product.type) ?? 0) + v);
  }
  const total = [...byType.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  const sorted = [...byType.entries()].sort(([, a], [, b]) => b - a);
  const head = sorted.slice(0, max - 1);
  const tail = sorted.slice(max - 1);
  const parts = head.map(([type, value]) => ({
    key: type,
    label: TYPE_SHORT[type as ProductTypeKey] ?? type,
    value,
  }));
  if (tail.length === 1) {
    const [type, value] = tail[0]!;
    parts.push({ key: type, label: TYPE_SHORT[type as ProductTypeKey] ?? type, value });
  } else if (tail.length > 1) {
    parts.push({ key: 'REST', label: 'Autres', value: tail.reduce((s, [, v]) => s + v, 0) });
  }
  return parts.map((p) => ({ ...p, share: p.value / total }));
}

export async function getRecentRestocks(limit = 6) {
  return prisma.alertEvent.findMany({
    where: { type: { in: ['BACK_IN_STOCK', 'PREORDER_OPEN'] } },
    include: {
      product: { select: { id: true, name: true, imageUrl: true, images: true } },
      listing: { select: { lastImageUrl: true, retailer: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getActiveAlerts(limit = 8) {
  const [items, count] = await Promise.all([
    prisma.alertEvent.findMany({
      where: { acknowledged: false },
      include: {
        product: { select: { id: true, name: true } },
        chaseCard: { select: { tcgdexId: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.alertEvent.count({ where: { acknowledged: false } }),
  ]);
  return { items, count };
}

export interface PriceMove {
  productId: string;
  name: string;
  kind: 'boutique' | 'marché';
  before: number;
  after: number;
  change: number;
}

/**
 * Top variations sur 30 jours : meilleur prix boutique (résumés quotidiens) et prix marché,
 * en comparant le premier relevé de la fenêtre au plus récent.
 */
export async function getTopPriceMoves(limit = 6): Promise<PriceMove[]> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [snapshots, market] = await Promise.all([
    prisma.listingDaily.findMany({
      where: { AND: [KEPT_DAILY, { date: { gte: since }, minBuyablePrice: { not: null } }] },
      select: {
        date: true,
        minBuyablePrice: true,
        listing: { select: { productId: true, product: { select: { name: true } } } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.marketPrice.findMany({
      where: { date: { gte: since } },
      select: { date: true, price: true, productId: true, product: { select: { name: true } } },
      orderBy: { date: 'asc' },
    }),
  ]);

  // Meilleur prix boutique du premier et du dernier jour observés, par produit.
  const retail = new Map<string, { name: string; days: Map<string, number> }>();
  for (const s of snapshots) {
    const id = s.listing.productId;
    const day = s.date.toISOString().slice(0, 10);
    const entry = retail.get(id) ?? {
      name: s.listing.product.name,
      days: new Map<string, number>(),
    };
    const p = toNumber(s.minBuyablePrice)!;
    entry.days.set(day, Math.min(entry.days.get(day) ?? Infinity, p));
    retail.set(id, entry);
  }

  const moves: PriceMove[] = [];
  for (const [productId, { name, days }] of retail) {
    const sorted = [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (sorted.length < 2) continue;
    const before = sorted[0]![1];
    const after = sorted[sorted.length - 1]![1];
    const change = priceChange(before, after);
    if (change) moves.push({ productId, name, kind: 'boutique', before, after, change });
  }

  const byProduct = new Map<string, { name: string; first: number; last: number }>();
  for (const m of market) {
    const p = toNumber(m.price)!;
    const entry = byProduct.get(m.productId);
    if (!entry) byProduct.set(m.productId, { name: m.product.name, first: p, last: p });
    else entry.last = p;
  }
  for (const [productId, { name, first, last }] of byProduct) {
    const change = priceChange(first, last);
    if (change) moves.push({ productId, name, kind: 'marché', before: first, after: last, change });
  }

  return moves.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, limit);
}

export async function getDashboard() {
  const [
    upcoming,
    restocks,
    alerts,
    collection,
    moves,
    trackedCount,
    lastCheck,
    collectionHistory,
    sealed,
  ] = await Promise.all([
    getUpcomingEvents(10),
    getRecentRestocks(),
    getActiveAlerts(),
    getCollection(),
    getTopPriceMoves(),
    prisma.listing.count({ where: { state: { not: 'PAUSED' } } }),
    prisma.listing.aggregate({ _max: { lastCheckedAt: true } }),
    // Depuis le premier achat (jusqu'à 5 ans) : la période « Tout » du graphique de l'accueil.
    getCollectionHistory(5 * 366),
    getSealedPrices(),
  ]);
  return {
    upcoming,
    restocks,
    alerts,
    valuation: collection.valuation,
    itemCount: collection.rows.length,
    collectionHistory,
    moves,
    trackedCount,
    lastCheckedAt: lastCheck._max.lastCheckedAt,
    breakdown: breakdownByType(collection.rows),
    deals: findDeals(sealed)
      .sort((a, b) => b.discount - a.discount)
      .slice(0, 5),
  };
}
