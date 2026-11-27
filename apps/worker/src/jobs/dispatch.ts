import { prisma, type AlertType } from '@tcgwatch/db';
import { formatPrice, toNumber } from '@tcgwatch/shared';
import type { WorkerContext } from '../context';
import { deliverToUser } from '../deliver';
import type { Notification } from '../notify';
import { inQuietHours } from '../quiet-hours';

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
  /** Destinataires imposés (sinon déduits du produit et des suivis). */
  recipients?: string[];
}

/** Types d'alerte réservés aux suiveurs dont le bon prix est atteint. */
const PRICE_TYPES = new Set<AlertType>(['PRICE_TARGET', 'MARKET_DEAL']);

interface Recipient {
  userId: string;
  admin: boolean;
  /** Types coupés pour ce produit par cet utilisateur. */
  productMuted: AlertType[];
}

/**
 * Destinataires d'une alerte :
 * - alerte de carte suivie : les administrateurs ;
 * - alerte de prix (prix cible, bonne affaire) : les suiveurs dont le bon prix est atteint ;
 * - autre alerte produit : les administrateurs (toutes les fiches suivies) et les suiveurs ;
 * - `recipients` explicite (rappels de sortie, préparés par utilisateur).
 */
export async function alertRecipients(alert: AlertToDispatch): Promise<Recipient[]> {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  const adminIds = new Set(admins.map((a) => a.id));
  const follows = alert.productId
    ? await prisma.productFollow.findMany({
        where: { productId: alert.productId },
        select: { userId: true, targetPrice: true, mutedAlerts: true },
      })
    : [];
  const byUser = new Map(follows.map((f) => [f.userId, f]));
  const make = (userId: string): Recipient => ({
    userId,
    admin: adminIds.has(userId),
    productMuted: byUser.get(userId)?.mutedAlerts ?? [],
  });

  if (alert.recipients) return alert.recipients.map(make);
  if (!alert.productId) return [...adminIds].map(make);
  if (PRICE_TYPES.has(alert.type)) {
    const price = alert.price ?? null;
    return follows
      .filter((f) => {
        const target = toNumber(f.targetPrice);
        return target !== null && (price === null || price <= target);
      })
      .map((f) => make(f.userId));
  }
  return [...new Set([...adminIds, ...follows.map((f) => f.userId)])].map(make);
}

/**
 * Journalise l'alerte (AlertEvent, une par destinataire) puis l'envoie : canaux du serveur
 * (ntfy, Telegram) pour les administrateurs, Telegram personnel et navigateur pour chacun. Une
 * alerte identique déjà émise à un destinataire dans la fenêtre d'anti-doublon est ignorée.
 */
export async function dispatchAlert(ctx: WorkerContext, alert: AlertToDispatch): Promise<boolean> {
  const recipients = await alertRecipients(alert);
  let emitted = false;
  let details: string[] | undefined = alert.details;
  for (const r of recipients) {
    const recent = await prisma.alertEvent.findFirst({
      where: {
        userId: r.userId,
        dedupeKey: alert.dedupeKey,
        createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (recent) continue;

    const settings = await prisma.alertSettings.findUnique({ where: { userId: r.userId } });
    const muted =
      (settings?.mutedTypes ?? []).includes(alert.type) || r.productMuted.includes(alert.type);
    const quiet = inQuietHours(new Date(), settings?.quietStart, settings?.quietEnd);
    // Retenue : mode « résumé seulement », ou nuit en mode « rien la nuit ».
    const held =
      !muted && (Boolean(settings?.digestOnly) || (quiet && settings?.quietMode === 'hold'));
    const silent = !muted && !held && quiet;
    const event = await prisma.alertEvent.create({
      data: {
        userId: r.userId,
        type: alert.type,
        productId: alert.productId ?? null,
        chaseCardId: alert.chaseCardId ?? null,
        listingId: alert.listingId,
        title: alert.title,
        message: alert.message,
        url: alert.url,
        price: alert.price ?? null,
        dedupeKey: alert.dedupeKey,
        muted,
        silent,
        held,
        // Les alertes informatives (dates) ne restent pas « actives ».
        acknowledged: alert.type === 'RELEASE_DATE',
      },
    });
    emitted = true;
    if (muted || held) continue;

    details ??= alert.productId ? await priceDetails(alert.productId) : [];
    const notification = { ...alert, details, silent };
    const delivery = await deliverToUser(ctx, r.userId, r.admin, notification);
    await prisma.alertEvent.update({
      where: { id: event.id },
      data: {
        sentNtfy: delivery.ntfy,
        sentTelegram: delivery.telegram,
        sentPush: delivery.push,
      },
    });
  }
  if (emitted) {
    ctx.logger.info(
      {
        type: alert.type,
        productId: alert.productId,
        chaseCardId: alert.chaseCardId,
        recipients: recipients.length,
      },
      'Alerte émise',
    );
  } else {
    ctx.logger.debug({ dedupeKey: alert.dedupeKey }, 'Alerte sans destinataire ou déjà émise');
  }
  return emitted;
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
