import { prisma } from '@tcgwatch/db';
import { parsePausedUntil, TELEGRAM_SETTINGS } from '@tcgwatch/shared';
import type { WorkerContext } from './context';
import type { Notification } from './notify';

export interface UserDelivery {
  ntfy: boolean;
  telegram: boolean;
  push: boolean;
}

/** Bot Telegram en pause (réglage administrateur) ? */
export async function telegramPaused(now = new Date()): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({
    where: { key: TELEGRAM_SETTINGS.pausedUntil },
  });
  const until = parsePausedUntil(row?.value);
  return until !== null && until > now;
}

/**
 * Envoie une notification à un utilisateur : canaux du serveur (ntfy, groupe Telegram) pour
 * les administrateurs, sauf bot en pause ; notifications du navigateur pour chacun.
 */
export async function deliverToUser(
  ctx: WorkerContext,
  userId: string,
  admin: boolean,
  n: Notification,
): Promise<UserDelivery> {
  let server = { ntfy: false, telegram: false };
  if (admin) {
    // Une base injoignable ne doit pas bloquer l'envoi : la pause est alors ignorée.
    const paused = await telegramPaused().catch(() => false);
    server = await ctx.notifier.send(n, { telegram: !paused });
  }
  const push = ctx.push ? (await ctx.push.sendToUser(userId, n)) > 0 : false;
  return { ...server, push };
}
