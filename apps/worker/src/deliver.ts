import { prisma } from '@tcgwatch/db';
import { parsePausedUntil, telegramDecision, TELEGRAM_SETTINGS } from '@tcgwatch/shared';
import type { WorkerContext } from './context';
import type { Notification } from './notify';

export interface UserDelivery {
  ntfy: boolean;
  telegram: boolean;
  push: boolean;
}

/** Pause globale de Telegram (réglage administrateur), ou null. */
export async function telegramGlobalPause(): Promise<Date | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: TELEGRAM_SETTINGS.pausedUntil },
  });
  return parsePausedUntil(row?.value);
}

/**
 * Envoie une notification à un utilisateur sur tous ses canaux :
 * - administrateur : ntfy et conversation Telegram du serveur ;
 * - Telegram personnel s'il est relié (réglages de l'utilisateur et de l'administrateur) ;
 * - notifications du navigateur.
 */
export async function deliverToUser(
  ctx: WorkerContext,
  userId: string,
  admin: boolean,
  n: Notification,
): Promise<UserDelivery> {
  const [user, globalPause] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        telegramChatId: true,
        telegramEnabled: true,
        telegramAdminMode: true,
        telegramPausedUntil: true,
      },
    }),
    telegramGlobalPause(),
  ]);
  const now = new Date();
  const telegramOpen = !(globalPause && globalPause > now);
  const server = admin
    ? await ctx.notifier.send(n, { telegram: telegramOpen })
    : { ntfy: false, telegram: false };
  let telegram = server.telegram;
  if (user) {
    const decision = telegramDecision(user, globalPause, now);
    // Conversation personnelle = celle du serveur : déjà envoyée ci-dessus.
    const duplicate = admin && server.telegram && user.telegramChatId === ctx.notifier.serverChatId;
    if (decision.send && !duplicate) {
      const sent = await ctx.notifier.sendTelegramTo(user.telegramChatId!, {
        ...n,
        silent: n.silent || decision.silent,
      });
      telegram ||= sent;
    }
  }
  const push = ctx.push ? (await ctx.push.sendToUser(userId, n)) > 0 : false;
  return { ntfy: server.ntfy, telegram, push };
}
