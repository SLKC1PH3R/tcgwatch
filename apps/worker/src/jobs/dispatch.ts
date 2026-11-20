import { prisma, type AlertType } from '@tcgwatch/db';
import { formatPrice, toNumber } from '@tcgwatch/shared';
import type { WorkerContext } from '../context';
import type { Notification } from '../notify';

/** Fenêtre d'anti-doublon : une même alerte n'est pas renvoyée avant ce délai. */
export const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000;

export interface AlertToDispatch extends Notification {
  type: AlertType;
  dedupeKey: string;
  /** Produit concerné ; une alerte de carte porte `chaseCardId` à la place. */
  productId?: string;
  chaseCardId?: string;
  listingId?: string;
  price?: number | null;
}

/**
 * Journalise l'alerte (AlertEvent) puis l'envoie sur les canaux configurés,
 * sauf si une alerte identique a déjà été émise dans la fenêtre d'anti-doublon.
 */
export async function dispatchAlert(ctx: WorkerContext, alert: AlertToDispatch): Promise<boolean> {
  const recent = await prisma.alertEvent.findFirst({
    where: {
      dedupeKey: alert.dedupeKey,
      createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (recent) {
    ctx.logger.debug({ dedupeKey: alert.dedupeKey }, 'Alerte ignorée (doublon récent)');
    return false;
  }

  const event = await prisma.alertEvent.create({
    data: {
      type: alert.type,
      productId: alert.productId ?? null,
      chaseCardId: alert.chaseCardId ?? null,
      listingId: alert.listingId,
      title: alert.title,
      message: alert.message,
      url: alert.url,
      price: alert.price ?? null,
      dedupeKey: alert.dedupeKey,
      // Les alertes informatives (dates) ne restent pas « actives ».
      acknowledged: alert.type === 'RELEASE_DATE',
    },
  });

  const details = alert.details ?? (alert.productId ? await priceDetails(alert.productId) : []);
  const delivery = await ctx.notifier.send({ ...alert, details });
  await prisma.alertEvent.update({
    where: { id: event.id },
    data: { sentNtfy: delivery.ntfy, sentTelegram: delivery.telegram },
  });
  ctx.logger.info(
    { type: alert.type, productId: alert.productId, chaseCardId: alert.chaseCardId, ...delivery },
    'Alerte émise',
  );
  return true;
}

const MARKET_SOURCES: Record<string, string> = {
  cardmarket: 'Cardmarket',
  ebay: 'eBay',
  poketrace: 'PokeTrace',
  cardnexus: 'CardNexus',
};

/** Repères de prix d'un produit : prix de vente conseillé et dernière cote du marché secondaire. */
export async function priceDetails(productId: string): Promise<string[]> {
  const [product, quote] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, select: { msrp: true } }),
    prisma.marketPrice.findFirst({
      where: { productId },
      orderBy: { date: 'desc' },
      select: { price: true, source: true },
    }),
  ]);
  return marketLines(
    toNumber(product?.msrp ?? null),
    quote ? toNumber(quote.price) : null,
    quote?.source,
  );
}

export function marketLines(msrp: number | null, market: number | null, source?: string): string[] {
  const lines = [`Prix de vente conseillé : ${msrp !== null ? formatPrice(msrp) : 'inconnu'}`];
  if (market === null) {
    lines.push('Marché secondaire : pas encore de cote');
  } else {
    const gap =
      msrp !== null && msrp > 0
        ? ` (${market >= msrp ? '+' : '−'}${Math.round(Math.abs(market / msrp - 1) * 100)} % vs conseillé)`
        : '';
    const from = source ? ` · ${MARKET_SOURCES[source] ?? source}` : '';
    lines.push(`Marché secondaire : ${formatPrice(market)}${from}${gap}`);
  }
  return lines;
}
