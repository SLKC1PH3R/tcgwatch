import 'server-only';
import { prisma } from '@tcgwatch/db';
import { lowestBest, lowSince, outOfStockRanges, toNumber, type DailyBest } from '@tcgwatch/shared';

/** Périodes proposées sur le graphique d'une fiche produit (null = tout l'historique). */
export const PERIODS = [
  { key: '7', label: '7 j', days: 7 },
  { key: '30', label: '30 j', days: 30 },
  { key: '90', label: '90 j', days: 90 },
  { key: '365', label: '1 an', days: 365 },
  { key: 'tout', label: 'Tout', days: null },
] as const;
export type PeriodKey = (typeof PERIODS)[number]['key'];

export function periodOf(key: string | undefined) {
  return PERIODS.find((p) => p.key === key) ?? PERIODS[2];
}

export const BEST_SERIES = 'Meilleur prix achetable';
export const MARKET_SERIES = 'Marché';

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Historique d'un produit pour le graphique, à partir des résumés quotidiens des fiches :
 * dernier prix de chaque revendeur, meilleur prix achetable du jour (toutes boutiques),
 * prix marché, périodes de rupture et repères (plus bas historique, plus bas 30 j).
 */
export async function getPriceHistory(productId: string, days: number | null) {
  const [daily, market, purchases] = await Promise.all([
    prisma.listingDaily.findMany({
      where: { listing: { productId } },
      select: {
        date: true,
        lastPrice: true,
        minBuyablePrice: true,
        listing: { select: { retailer: { select: { name: true } } } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.marketPrice.findMany({
      where: { productId },
      select: { date: true, price: true, median: true, listingCount: true, source: true },
      orderBy: { date: 'asc' },
    }),
    prisma.collectionItem.findMany({
      where: { productId },
      select: { quantity: true, purchasePrice: true },
    }),
  ]);

  // Meilleur prix achetable par jour, sur tout l'historique (repères).
  const bestByDay = new Map<string, number | null>();
  for (const d of daily) {
    const day = dayOf(d.date);
    const p = toNumber(d.minBuyablePrice);
    const cur = bestByDay.get(day);
    if (p === null) bestByDay.set(day, cur ?? null);
    else bestByDay.set(day, cur === undefined || cur === null ? p : Math.min(cur, p));
  }
  const bestSeries: DailyBest[] = [...bestByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, best]) => ({ day, best }));

  const since = days ? dayOf(new Date(Date.now() - days * 86_400_000)) : '';
  const rows = new Map<string, Record<string, number | string>>();
  const row = (day: string) => {
    const r = rows.get(day) ?? { day };
    rows.set(day, r);
    return r;
  };
  const retailers = new Set<string>();
  for (const d of daily) {
    const day = dayOf(d.date);
    const price = toNumber(d.lastPrice);
    if (day < since || price === null) continue;
    retailers.add(d.listing.retailer.name);
    row(day)[d.listing.retailer.name] = price;
  }
  for (const b of bestSeries) {
    if (b.day >= since && b.best !== null) row(b.day)[BEST_SERIES] = b.best;
  }
  let hasMarket = false;
  for (const m of market) {
    const day = dayOf(m.date);
    if (day < since) continue;
    hasMarket = true;
    row(day)[MARKET_SERIES] = toNumber(m.price)!;
  }

  const qty = purchases.reduce((s, p) => s + p.quantity, 0);
  const avgPurchase = qty
    ? purchases.reduce((s, p) => s + p.quantity * toNumber(p.purchasePrice)!, 0) / qty
    : null;
  const lastQuote = market.at(-1);
  const lastMarket = lastQuote ? toNumber(lastQuote.price) : null;

  return {
    data: [...rows.values()].sort((a, b) => String(a.day).localeCompare(String(b.day))),
    retailers: [...retailers].sort(),
    hasBest: bestSeries.some((b) => b.best !== null && b.day >= since),
    hasMarket,
    outOfStock: outOfStockRanges(bestSeries.filter((b) => b.day >= since)),
    allTimeLow: lowestBest(bestSeries),
    low30: lowestBest(bestSeries, 30),
    avgPurchase,
    lastMarket,
    lastMarketMedian: lastQuote ? toNumber(lastQuote.median) : null,
    lastMarketListings: lastQuote?.listingCount ?? null,
    ratio: avgPurchase && lastMarket ? lastMarket / avgPurchase : null,
  };
}

/** Meilleur prix achetable par jour et par produit (tout l'historique). */
async function dailyBestByProduct(productIds?: string[]): Promise<Map<string, DailyBest[]>> {
  const rows = await prisma.listingDaily.findMany({
    where: productIds ? { listing: { productId: { in: productIds } } } : {},
    select: { date: true, minBuyablePrice: true, listing: { select: { productId: true } } },
    orderBy: { date: 'asc' },
  });
  const byProduct = new Map<string, Map<string, number | null>>();
  for (const r of rows) {
    const id = r.listing.productId;
    const days = byProduct.get(id) ?? new Map<string, number | null>();
    byProduct.set(id, days);
    const day = dayOf(r.date);
    const p = toNumber(r.minBuyablePrice);
    const cur = days.get(day);
    days.set(day, p === null ? (cur ?? null) : cur == null ? p : Math.min(cur, p));
  }
  return new Map(
    [...byProduct.entries()].map(([id, days]) => [
      id,
      [...days.entries()].map(([day, best]) => ({ day, best })),
    ]),
  );
}

/**
 * Pastille « plus bas depuis X jours » de la liste des produits : seulement si le meilleur
 * prix actuel n'a pas été battu depuis au moins `minDays` jours.
 */
export async function getLowSinceBadges(
  current: { id: string; best: number | null }[],
  minDays = 7,
): Promise<Map<string, { days: number; allTime: boolean }>> {
  const series = await dailyBestByProduct(current.map((c) => c.id));
  const out = new Map<string, { days: number; allTime: boolean }>();
  for (const c of current) {
    const s = lowSince(series.get(c.id) ?? [], c.best);
    if (s && s.days >= minDays) out.set(c.id, s);
  }
  return out;
}
