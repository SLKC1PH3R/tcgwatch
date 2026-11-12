import 'server-only';
import { prisma } from '@tcgwatch/db';
import { priceChange } from '@tcgwatch/market';
import { toNumber } from '@tcgwatch/shared';
import { getCollection } from './collection';
import { getUpcomingEvents } from './releases';

export async function getRecentRestocks(limit = 6) {
  return prisma.alertEvent.findMany({
    where: { type: { in: ['BACK_IN_STOCK', 'PREORDER_OPEN'] } },
    include: {
      product: { select: { id: true, name: true } },
      listing: { select: { retailer: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getActiveAlerts(limit = 8) {
  const [items, count] = await Promise.all([
    prisma.alertEvent.findMany({
      where: { acknowledged: false },
      include: { product: { select: { id: true, name: true } } },
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
 * Top variations sur 30 jours : meilleur prix boutique (snapshots) et prix marché,
 * en comparant le premier relevé de la fenêtre au plus récent.
 */
export async function getTopPriceMoves(limit = 6): Promise<PriceMove[]> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [snapshots, market] = await Promise.all([
    prisma.snapshot.findMany({
      where: {
        createdAt: { gte: since },
        price: { not: null },
        availability: { in: ['IN_STOCK', 'PREORDER'] },
      },
      select: {
        createdAt: true,
        price: true,
        listing: { select: { productId: true, product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
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
    const day = s.createdAt.toISOString().slice(0, 10);
    const entry = retail.get(id) ?? {
      name: s.listing.product.name,
      days: new Map<string, number>(),
    };
    const p = toNumber(s.price)!;
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
  const [upcoming, restocks, alerts, collection, moves, trackedCount] = await Promise.all([
    getUpcomingEvents(6),
    getRecentRestocks(),
    getActiveAlerts(),
    getCollection(),
    getTopPriceMoves(),
    prisma.listing.count({ where: { state: { not: 'PAUSED' } } }),
  ]);
  return {
    upcoming,
    restocks,
    alerts,
    valuation: collection.valuation,
    itemCount: collection.rows.length,
    moves,
    trackedCount,
  };
}
