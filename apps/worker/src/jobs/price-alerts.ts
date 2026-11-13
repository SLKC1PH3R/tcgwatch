import { KEPT_DAILY, prisma } from '@tcgwatch/db';
import {
  formatPercent,
  formatPrice,
  isBuyable,
  parisDayKey,
  relativeChange,
  todayUtc,
  toNumber,
  type Availability,
} from '@tcgwatch/shared';
import type { WorkerContext } from '../context';
import { dispatchAlert } from './dispatch';

/** Historique minimal avant de parler de « plus bas historique » (évite le bruit au départ). */
export const NEW_LOW_MIN_HISTORY_DAYS = 14;
/** Nombre d'annonces minimal (jour même et jour de référence) pour une alerte de marché. */
export const MARKET_MOVE_MIN_LISTINGS = 3;
const DAY_MS = 86_400_000;

/**
 * Nouveau plus bas historique : le prix achetable relevé est inférieur à tous les prix
 * achetables connus du produit, toutes boutiques et tous jours confondus.
 *
 * Garde-fous contre un prix mal lu ou une mauvaise fiche :
 * - le prix doit être confirmé par 2 relevés de suite (le précédent au même prix, achetable) ;
 * - un prix mis de côté (aberrant) ne déclenche rien ;
 * - les jours mis de côté ou exclus à la main ne comptent pas dans les plus bas connus.
 * Une alerte au plus par produit, prix et jour.
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
  observation: { price: number | null; availability: Availability; suspect: boolean },
  previous: { price: number | null; availability: Availability; lastCheckedAt: Date | null },
  now: Date,
): Promise<boolean> {
  const { price, availability, suspect } = observation;
  if (price === null || suspect || !isBuyable(availability)) return false;
  // Premier relevé à ce prix : on attend la confirmation du suivant.
  if (
    previous.lastCheckedAt === null ||
    previous.price === null ||
    Math.abs(previous.price - price) > 0.005 ||
    !isBuyable(previous.availability)
  ) {
    return false;
  }

  // Les jours de cette fiche depuis le relevé précédent portent déjà ce prix : exclus.
  const since = todayUtc(previous.lastCheckedAt);
  const where = {
    AND: [
      KEPT_DAILY,
      { listing: { productId: listing.productId } },
      { minBuyablePrice: { not: null } },
      { NOT: { listingId: listing.id, date: { gte: since } } },
    ],
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
    dedupeKey: `NEW_LOW:${listing.productId}:${price.toFixed(2)}:${parisDayKey(now)}`,
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
 * (entre 5 et 10 jours). Avec peu d'annonces, une seule mise en vente fait bouger le prix :
 * il en faut au moins MARKET_MOVE_MIN_LISTINGS le jour même et le jour de référence (quand
 * la source donne ce nombre). Une alerte par produit, source et jour au plus.
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
      select: {
        productId: true,
        source: true,
        price: true,
        listingCount: true,
        product: { select: { name: true } },
      },
    }),
    prisma.marketPrice.findMany({
      where: { date: { gte: from, lte: to } },
      select: { productId: true, source: true, price: true, listingCount: true, date: true },
    }),
  ]);
  const target = date.getTime() - 7 * DAY_MS;
  const refs = new Map<string, { price: number; date: Date; listingCount: number | null }>();
  for (const r of references) {
    const key = `${r.productId}|${r.source}`;
    const cur = refs.get(key);
    if (!cur || Math.abs(r.date.getTime() - target) < Math.abs(cur.date.getTime() - target)) {
      refs.set(key, { price: toNumber(r.price)!, date: r.date, listingCount: r.listingCount });
    }
  }
  const thin = (n: number | null) => n !== null && n < MARKET_MOVE_MIN_LISTINGS;

  let sent = 0;
  for (const q of todays) {
    const ref = refs.get(`${q.productId}|${q.source}`);
    if (!ref || thin(q.listingCount) || thin(ref.listingCount)) continue;
    const price = toNumber(q.price)!;
    const change = relativeChange(ref.price, price);
    if (change === null || Math.abs(change) * 100 < thresholdPct) continue;
    const up = change > 0;
    const ok = await dispatchAlert(ctx, {
      type: 'MARKET_MOVE',
      dedupeKey: `MARKET_MOVE:${q.productId}:${q.source}:${date.toISOString().slice(0, 10)}`,
      productId: q.productId,
      price,
      title: `${up ? '📈' : '📉'} Marché ${formatPercent(change)} en 7 j : ${q.product.name}`,
      message: `Prix marché (${q.source}) : ${formatPrice(ref.price)} → ${formatPrice(price)}${
        q.listingCount !== null ? ` (${q.listingCount} annonces)` : ''
      }.`,
      priority: 'default',
      tags: [up ? 'chart_with_upwards_trend' : 'chart_with_downwards_trend'],
    });
    if (ok) sent++;
  }
  return sent;
}

/**
 * Seuils des cartes suivies : alerte quand la tendance Cardmarket du jour passe sous
 * `alertBelow` ou au-dessus de `alertAbove` (une fois par carte, seuil et jour).
 */
export async function checkCardThresholds(ctx: WorkerContext, date: Date): Promise<number> {
  const cards = await prisma.chaseCard.findMany({
    where: { OR: [{ alertBelow: { not: null } }, { alertAbove: { not: null } }] },
    select: {
      id: true,
      tcgdexId: true,
      name: true,
      alertBelow: true,
      alertAbove: true,
      release: { select: { nameFr: true } },
      prices: { where: { date }, select: { trend: true, price: true }, take: 1 },
    },
  });
  let sent = 0;
  for (const c of cards) {
    const quote = c.prices[0];
    const trend = quote ? (toNumber(quote.trend) ?? toNumber(quote.price)) : null;
    if (trend === null) continue;
    const below = toNumber(c.alertBelow);
    const above = toNumber(c.alertAbove);
    const hit =
      below !== null && trend <= below
        ? { dir: 'sous', limit: below, emoji: '📉' }
        : above !== null && trend >= above
          ? { dir: 'au-dessus de', limit: above, emoji: '📈' }
          : null;
    if (!hit) continue;
    const ok = await dispatchAlert(ctx, {
      type: 'CARD_PRICE',
      dedupeKey: `CARD_PRICE:${c.id}:${hit.dir}:${hit.limit}:${date.toISOString().slice(0, 10)}`,
      chaseCardId: c.id,
      price: trend,
      title: `${hit.emoji} ${c.name} ${hit.dir} ${formatPrice(hit.limit)}`,
      message: `Tendance Cardmarket ${formatPrice(trend)} (${c.release.nameFr}).`,
      url: `${ctx.env.APP_URL.replace(/\/$/, '')}/cartes/${encodeURIComponent(c.tcgdexId)}`,
      priority: 'high',
      tags: ['flower_playing_cards'],
    });
    if (ok) sent++;
  }
  return sent;
}
