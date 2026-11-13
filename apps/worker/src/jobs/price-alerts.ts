import { prisma } from '@tcgwatch/db';
import {
  formatPercent,
  formatPrice,
  isBuyable,
  relativeChange,
  toNumber,
  type Availability,
} from '@tcgwatch/shared';
import type { WorkerContext } from '../context';
import { dispatchAlert } from './dispatch';

/** Historique minimal avant de parler de « plus bas historique » (évite le bruit au départ). */
export const NEW_LOW_MIN_HISTORY_DAYS = 14;
const DAY_MS = 86_400_000;

/**
 * Nouveau plus bas historique : le prix achetable relevé est inférieur à tous les prix
 * achetables connus du produit, toutes boutiques et tous jours confondus (hors ce relevé).
 */
export async function checkNewLow(
  ctx: WorkerContext,
  listing: {
    id: string;
    url: string;
    productId: string;
    product: { name: string };
    retailer: { name: string };
  },
  price: number | null,
  availability: Availability,
  now: Date,
): Promise<boolean> {
  if (price === null || !isBuyable(availability)) return false;
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const where = {
    listing: { productId: listing.productId },
    minBuyablePrice: { not: null },
    NOT: { listingId: listing.id, date: today },
  };
  const [low, oldest] = await Promise.all([
    prisma.listingDaily.aggregate({ where, _min: { minBuyablePrice: true } }),
    prisma.listingDaily.findFirst({ where, orderBy: { date: 'asc' }, select: { date: true } }),
  ]);
  const previousLow = toNumber(low._min.minBuyablePrice);
  if (previousLow === null || !oldest) return false;
  if (now.getTime() - oldest.date.getTime() < NEW_LOW_MIN_HISTORY_DAYS * DAY_MS) return false;
  if (price >= previousLow - 0.005) return false;

  const days = Math.round((now.getTime() - oldest.date.getTime()) / DAY_MS);
  return dispatchAlert(ctx, {
    type: 'NEW_LOW',
    dedupeKey: `NEW_LOW:${listing.productId}:${price.toFixed(2)}`,
    productId: listing.productId,
    listingId: listing.id,
    price,
    title: `📉 Plus bas historique : ${listing.product.name}`,
    message: `${formatPrice(price)} chez ${listing.retailer.name} (précédent plus bas ${formatPrice(previousLow)}, ${days} jours d’historique).`,
    url: listing.url,
    priority: 'high',
    tags: ['chart_with_downwards_trend'],
  });
}

/**
 * Variation du prix marché sur 7 jours au-delà de `thresholdPct` % (hausse ou baisse),
 * par produit et par source. La référence est le relevé le plus proche d'il y a 7 jours
 * (entre 5 et 10 jours). Une alerte par produit, source et jour au plus.
 */
export async function checkMarketMoves(
  ctx: WorkerContext,
  date: Date,
  thresholdPct: number,
): Promise<number> {
  if (!(thresholdPct > 0)) return 0;
  const from = new Date(date.getTime() - 10 * DAY_MS);
  const to = new Date(date.getTime() - 5 * DAY_MS);
  const [todays, references] = await Promise.all([
    prisma.marketPrice.findMany({
      where: { date },
      select: { productId: true, source: true, price: true, product: { select: { name: true } } },
    }),
    prisma.marketPrice.findMany({
      where: { date: { gte: from, lte: to } },
      select: { productId: true, source: true, price: true, date: true },
    }),
  ]);
  const target = date.getTime() - 7 * DAY_MS;
  const refs = new Map<string, { price: number; date: Date }>();
  for (const r of references) {
    const key = `${r.productId}|${r.source}`;
    const cur = refs.get(key);
    if (!cur || Math.abs(r.date.getTime() - target) < Math.abs(cur.date.getTime() - target)) {
      refs.set(key, { price: toNumber(r.price)!, date: r.date });
    }
  }

  let sent = 0;
  for (const q of todays) {
    const ref = refs.get(`${q.productId}|${q.source}`);
    const price = toNumber(q.price)!;
    const change = ref ? relativeChange(ref.price, price) : null;
    if (change === null || Math.abs(change) * 100 < thresholdPct) continue;
    const up = change > 0;
    const ok = await dispatchAlert(ctx, {
      type: 'MARKET_MOVE',
      dedupeKey: `MARKET_MOVE:${q.productId}:${q.source}:${date.toISOString().slice(0, 10)}`,
      productId: q.productId,
      price,
      title: `${up ? '📈' : '📉'} Marché ${formatPercent(change)} en 7 j : ${q.product.name}`,
      message: `Prix marché (${q.source}) : ${formatPrice(ref!.price)} → ${formatPrice(price)}.`,
      priority: 'default',
      tags: [up ? 'chart_with_upwards_trend' : 'chart_with_downwards_trend'],
    });
    if (ok) sent++;
  }
  return sent;
}
