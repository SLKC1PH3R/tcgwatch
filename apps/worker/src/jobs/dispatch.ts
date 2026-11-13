import { prisma, type AlertType } from '@tcgwatch/db';
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

  const delivery = await ctx.notifier.send(alert);
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
