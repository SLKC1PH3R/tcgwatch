import 'server-only';
import { Prisma, prisma } from '@tcgwatch/db';
import { lowestBest, outOfStockRanges, todayUtc, toNumber, type DailyBest } from '@tcgwatch/shared';

/** Périodes proposées sur les graphiques (null = tout l'historique). */
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

/** Premier jour (AAAA-MM-JJ, jour de Paris) d'une période, '' pour tout l'historique. */
export function periodStart(days: number | null): string {
  return days ? dayOf(new Date(todayUtc().getTime() - days * 86_400_000)) : '';
}

export const BEST_SERIES = 'Meilleur prix achetable';
export const MARKET_SERIES = 'Marché';
/** Médiane quotidienne des annonces d'occasion (eBay, neuves, port compris). */
export const SECONDHAND_SERIES = 'Occasion (eBay)';

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/** Sources du prix marché, de la plus fiable à la moins fiable (un même jour). */
const MARKET_PRIORITY = ['cardmarket', 'cardnexus', 'poketrace', 'manual'];

/** Point du résumé quotidien d'une fiche, pour l'exclure ou le rétablir sur le graphique. */
export interface DayPoint {
  listingId: string;
  retailer: string;
  price: number | null;
  /** kept = compté ; suspect = mis de côté automatiquement ; excluded = exclu à la main. */
  state: 'kept' | 'suspect' | 'excluded';
}

/** Jours en stock d'une boutique (résumés quotidiens où le produit était achetable). */
export interface StockStat {
  listingId: string;
  retailer: string;
  in30: number;
  checked30: number;
  in90: number;
  checked90: number;
  lastBuyable: string | null;
}

const isKept = (d: { excluded: boolean | null; suspect: boolean }) =>
  d.excluded === null ? !d.suspect : !d.excluded;

/**
 * Historique d'un produit pour le graphique, à partir des résumés quotidiens des fiches :
 * dernier prix de chaque revendeur, meilleur prix achetable du jour (toutes boutiques),
 * prix marché, périodes de rupture et repères (plus bas historique, plus bas 30 j).
 * Les jours mis de côté (prix aberrant) ou exclus à la main ne comptent pas.
 */
export async function getPriceHistory(productId: string, days: number | null) {
  const [daily, market, purchases, secondhand] = await Promise.all([
    prisma.listingDaily.findMany({
      where: { listing: { productId } },
      select: {
        date: true,
        lastPrice: true,
        minBuyablePrice: true,
        wasBuyable: true,
        suspect: true,
        excluded: true,
        listingId: true,
        listing: { select: { retailer: { select: { name: true } } } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.marketPrice.findMany({
      where: { productId },
      select: {
        date: true,
        price: true,
        median: true,
        listingCount: true,
        source: true,
        low: true,
        trend: true,
        avg1: true,
        avg7: true,
        avg30: true,
      },
      orderBy: { date: 'asc' },
    }),
    prisma.collectionItem.findMany({
      where: { productId },
      select: { quantity: true, purchasePrice: true },
    }),
    prisma.secondhandDaily.findMany({
      where: { productId, source: 'ebay' },
      select: { date: true, median: true, low: true, count: true },
      orderBy: { date: 'asc' },
    }),
  ]);
  const kept = daily.filter(isKept);
  // Même jour, plusieurs sources : la plus fiable est écrite en dernier (elle l'emporte).
  market.sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      MARKET_PRIORITY.indexOf(b.source) - MARKET_PRIORITY.indexOf(a.source),
  );

  // Meilleur prix achetable par jour, sur tout l'historique (repères).
  const bestByDay = new Map<string, number | null>();
  for (const d of kept) {
    const day = dayOf(d.date);
    const p = toNumber(d.minBuyablePrice);
    const cur = bestByDay.get(day);
    if (p === null) bestByDay.set(day, cur ?? null);
    else bestByDay.set(day, cur === undefined || cur === null ? p : Math.min(cur, p));
  }
  const bestSeries: DailyBest[] = [...bestByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, best]) => ({ day, best }));

  const since = periodStart(days);
  const rows = new Map<string, Record<string, number | string>>();
  const row = (day: string) => {
    const r = rows.get(day) ?? { day };
    rows.set(day, r);
    return r;
  };
  const retailers = new Set<string>();
  const points: Record<string, DayPoint[]> = {};
  for (const d of daily) {
    const day = dayOf(d.date);
    if (day < since) continue;
    const price = toNumber(d.lastPrice) ?? toNumber(d.minBuyablePrice);
    const state = d.excluded === true ? 'excluded' : isKept(d) ? 'kept' : 'suspect';
    (points[day] ??= []).push({
      listingId: d.listingId,
      retailer: d.listing.retailer.name,
      price,
      state,
    });
    if (state !== 'kept' || price === null) continue;
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

  let hasSecondhand = false;
  for (const s of secondhand) {
    const day = dayOf(s.date);
    if (day < since) continue;
    hasSecondhand = true;
    row(day)[SECONDHAND_SERIES] = toNumber(s.median)!;
  }
  const lastSecondhand = secondhand.at(-1);

  const qty = purchases.reduce((s, p) => s + p.quantity, 0);
  const avgPurchase = qty
    ? purchases.reduce((s, p) => s + p.quantity * toNumber(p.purchasePrice)!, 0) / qty
    : null;
  const lastQuote = market.at(-1);
  const guide = market.filter((m) => m.source === 'cardmarket').at(-1);
  const lastMarket = lastQuote ? toNumber(lastQuote.price) : null;

  return {
    data: [...rows.values()].sort((a, b) => String(a.day).localeCompare(String(b.day))),
    retailers: [...retailers].sort(),
    points,
    setAside: Object.values(points)
      .flat()
      .filter((p) => p.state !== 'kept').length,
    hasBest: bestSeries.some((b) => b.best !== null && b.day >= since),
    hasMarket,
    hasSecondhand,
    outOfStock: outOfStockRanges(bestSeries.filter((b) => b.day >= since)),
    allTimeLow: lowestBest(bestSeries),
    low30: lowestBest(bestSeries, 30, todayUtc()),
    avgPurchase,
    /** Exemplaires dans la collection. */
    owned: qty,
    lastMarket,
    lastMarketMedian: lastQuote ? toNumber(lastQuote.median) : null,
    lastMarketListings: lastQuote?.listingCount ?? null,
    lastMarketSource: lastQuote?.source ?? null,
    /** Dernière médiane d'occasion (eBay) : prix, plus bas et nombre d'annonces. */
    secondhand: lastSecondhand
      ? {
          date: lastSecondhand.date,
          median: toNumber(lastSecondhand.median)!,
          low: toNumber(lastSecondhand.low)!,
          count: lastSecondhand.count,
        }
      : null,
    /** Dernier relevé du guide des prix Cardmarket. */
    cardmarket: guide
      ? {
          date: guide.date,
          low: toNumber(guide.low),
          trend: toNumber(guide.trend),
          avg1: toNumber(guide.avg1),
          avg7: toNumber(guide.avg7),
          avg30: toNumber(guide.avg30),
        }
      : null,
    ratio: avgPurchase && lastMarket ? lastMarket / avgPurchase : null,
    stock: stockStats(daily),
  };
}

/** Jours en stock par boutique sur 30 et 90 jours (pour savoir où guetter un réassort). */
function stockStats(
  daily: {
    date: Date;
    wasBuyable: boolean;
    listingId: string;
    listing: { retailer: { name: string } };
  }[],
): StockStat[] {
  const d30 = periodStart(30);
  const d90 = periodStart(90);
  const by = new Map<string, StockStat>();
  for (const d of daily) {
    const day = dayOf(d.date);
    const s = by.get(d.listingId) ?? {
      listingId: d.listingId,
      retailer: d.listing.retailer.name,
      in30: 0,
      checked30: 0,
      in90: 0,
      checked90: 0,
      lastBuyable: null,
    };
    by.set(d.listingId, s);
    if (d.wasBuyable) s.lastBuyable = day;
    if (day >= d90) {
      s.checked90++;
      if (d.wasBuyable) s.in90++;
    }
    if (day >= d30) {
      s.checked30++;
      if (d.wasBuyable) s.in30++;
    }
  }
  return [...by.values()]
    .filter((s) => s.checked90 > 0)
    .sort((a, b) => b.in90 / b.checked90 - a.in90 / a.checked90 || b.in90 - a.in90);
}

/**
 * Pastille « plus bas depuis X jours » de la liste des produits : seulement si le meilleur
 * prix actuel n'a pas été battu depuis au moins `minDays` jours. Calculé en SQL (une ligne
 * par produit), sans charger l'historique quotidien dans l'application.
 */
export async function getLowSinceBadges(
  current: { id: string; best: number | null }[],
  minDays = 7,
): Promise<Map<string, { days: number; allTime: boolean }>> {
  const priced = current.filter((c): c is { id: string; best: number } => c.best !== null);
  const out = new Map<string, { days: number; allTime: boolean }>();
  if (priced.length === 0) return out;
  const values = Prisma.join(priced.map((c) => Prisma.sql`(${c.id}, ${c.best}::numeric)`));
  const rows = await prisma.$queryRaw<
    { id: string; lastLower: Date | null; firstDay: Date; days: bigint }[]
  >`
    WITH cur(id, best) AS (VALUES ${values}),
    daily AS (
      SELECT l."productId" AS id, d."date", MIN(d."minBuyablePrice") AS best
      FROM "ListingDaily" d
      JOIN "Listing" l ON l."id" = d."listingId"
      WHERE l."productId" IN (SELECT id FROM cur)
        AND d."minBuyablePrice" IS NOT NULL
        AND NOT COALESCE(d."excluded", d."suspect")
      GROUP BY l."productId", d."date"
    )
    SELECT daily.id,
      MAX(daily."date") FILTER (WHERE daily.best < cur.best - 0.005) AS "lastLower",
      MIN(daily."date") AS "firstDay",
      COUNT(*) AS days
    FROM daily JOIN cur ON cur.id = daily.id
    GROUP BY daily.id`;
  const today = todayUtc().getTime();
  for (const r of rows) {
    if (Number(r.days) < 2) continue;
    const since = r.lastLower ?? r.firstDay;
    const days = Math.round((today - since.getTime()) / 86_400_000);
    if (days >= minDays) out.set(r.id, { days, allTime: r.lastLower === null });
  }
  return out;
}
