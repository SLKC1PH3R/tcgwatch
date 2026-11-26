import { prisma } from '@tcgwatch/db';
import { formatPercent, formatPrice, todayUtc, toNumber } from '@tcgwatch/shared';
import type { WorkerContext } from '../context';
import { dispatchAlert } from './dispatch';

const DAY_MS = 86_400_000;
/** Cote minimale pour une alerte de hausse (en dessous, quelques centimes font +50 %). */
export const RISE_MIN_PRICE = 2;
/** Une alerte de hausse par carte et par semaine au plus, et 5 par utilisateur et par jour. */
const RISE_COOLDOWN_DAYS = 7;
const RISE_MAX_PER_DAY = 5;
/** Prix français pris en compte s'il a moins de 3 jours. */
const FR_FRESH_MS = 3 * DAY_MS;

/** Prix comparé au prix cible : prix français (eBay) récent, sinon tendance Cardmarket. */
export function wantedPrice(
  card: { frPrice: number | null; frPriceAt: Date | null; trend: number | null },
  now: Date,
): { price: number; source: 'eBay FR' | 'Cardmarket' } | null {
  if (
    card.frPrice !== null &&
    card.frPriceAt &&
    now.getTime() - card.frPriceAt.getTime() < FR_FRESH_MS
  ) {
    return { price: card.frPrice, source: 'eBay FR' };
  }
  return card.trend !== null ? { price: card.trend, source: 'Cardmarket' } : null;
}

/** Hausse sur 30 jours (fraction) si la carte vaut au moins RISE_MIN_PRICE, sinon null. */
export function riseOver30Days(now: number | null, before: number | null): number | null {
  if (now === null || before === null || before <= 0 || now < RISE_MIN_PRICE) return null;
  return now / before - 1;
}

/**
 * Alertes sur les cartes, propres à chaque utilisateur :
 * - liste de recherche : carte passée sous son prix cible (une fois par jour et par prix) ;
 * - cartes possédées en hausse de plus de X % en 30 jours (réglage de l'utilisateur).
 */
export async function runCardWatch(ctx: WorkerContext, now = new Date()): Promise<number> {
  const appUrl = ctx.env.APP_URL.replace(/\/$/, '');
  const day = todayUtc(now).toISOString().slice(0, 10);
  let sent = 0;

  const wanted = await prisma.showcaseCard.findMany({
    where: { targetPrice: { not: null }, showcase: { wanted: true } },
    select: {
      id: true,
      targetPrice: true,
      showcase: { select: { userId: true, title: true } },
      card: {
        select: {
          id: true,
          name: true,
          localId: true,
          frPrice: true,
          frPriceAt: true,
          priceTrend: true,
          release: { select: { nameFr: true } },
        },
      },
    },
  });
  for (const w of wanted) {
    const target = toNumber(w.targetPrice)!;
    const quote = wantedPrice(
      {
        frPrice: toNumber(w.card.frPrice),
        frPriceAt: w.card.frPriceAt,
        trend: toNumber(w.card.priceTrend),
      },
      now,
    );
    if (!quote || quote.price > target) continue;
    const ok = await dispatchAlert(ctx, {
      type: 'WANTED_PRICE',
      dedupeKey: `WANTED_PRICE:${w.id}:${target}:${day}`,
      recipients: [w.showcase.userId],
      price: quote.price,
      title: `🎯 ${w.card.name} à ${formatPrice(quote.price)}`,
      message: `${w.card.release.nameFr} ${w.card.localId} : ${quote.source} sous votre prix cible de ${formatPrice(target)} (liste « ${w.showcase.title} »).`,
      url: `${appUrl}/cartes/${encodeURIComponent(w.card.id)}`,
      priority: 'high',
      tags: ['dart'],
    });
    if (ok) sent++;
  }

  const watchers = await prisma.alertSettings.findMany({
    where: { cardRisePercent: { gt: 0 } },
    select: { userId: true, cardRisePercent: true },
  });
  const past = todayUtc(new Date(now.getTime() - 30 * DAY_MS));
  for (const u of watchers) {
    const threshold = u.cardRisePercent! / 100;
    const owned = await prisma.ownedCard.findMany({
      where: { userId: u.userId, card: { priceTrend: { gte: RISE_MIN_PRICE } } },
      select: {
        quantity: true,
        card: {
          select: {
            id: true,
            name: true,
            localId: true,
            priceTrend: true,
            release: { select: { nameFr: true } },
            // Cote la plus proche d'il y a 30 jours (au plus 5 jours plus tôt).
            dailyPrices: {
              where: {
                date: { lte: past, gte: new Date(past.getTime() - 5 * DAY_MS) },
                trend: { not: null },
              },
              orderBy: { date: 'desc' },
              take: 1,
              select: { trend: true },
            },
          },
        },
      },
    });
    const recent = await prisma.alertEvent.findMany({
      where: {
        userId: u.userId,
        type: 'CARD_RISE',
        createdAt: { gte: new Date(now.getTime() - RISE_COOLDOWN_DAYS * DAY_MS) },
      },
      select: { dedupeKey: true, createdAt: true },
    });
    const cooled = new Set(recent.map((r) => r.dedupeKey.split(':')[2]));
    const sentToday = recent.filter((r) => r.createdAt >= todayUtc(now)).length;
    const risers = owned
      .map((o) => {
        const nowPrice = toNumber(o.card.priceTrend);
        const before = toNumber(o.card.dailyPrices[0]?.trend ?? null);
        return { ...o, nowPrice, before, rise: riseOver30Days(nowPrice, before) };
      })
      .filter((o) => o.rise !== null && o.rise >= threshold && !cooled.has(o.card.id))
      .sort((a, b) => b.rise! - a.rise!)
      .slice(0, Math.max(0, RISE_MAX_PER_DAY - sentToday));
    for (const r of risers) {
      const ok = await dispatchAlert(ctx, {
        type: 'CARD_RISE',
        dedupeKey: `CARD_RISE:${u.userId}:${r.card.id}:${day}`,
        recipients: [u.userId],
        price: r.nowPrice,
        title: `📈 ${r.card.name} ${formatPercent(r.rise!)} en 30 j`,
        message: `${r.card.release.nameFr} ${r.card.localId} : ${formatPrice(r.before!)} → ${formatPrice(r.nowPrice!)} (tendance Cardmarket)${r.quantity > 1 ? `, vous en avez ${r.quantity}` : ''}.`,
        url: `${appUrl}/cartes/${encodeURIComponent(r.card.id)}`,
        priority: 'default',
        tags: ['chart_with_upwards_trend'],
      });
      if (ok) sent++;
    }
  }
  if (sent) ctx.logger.info({ sent }, 'Alertes sur les cartes envoyées');
  return sent;
}
