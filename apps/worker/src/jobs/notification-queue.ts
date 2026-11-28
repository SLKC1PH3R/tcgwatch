import { prisma } from '@tcgwatch/db';
import type { WorkerContext } from '../context';
import { deliverToUser } from '../deliver';
import { inQuietHours, minutesOfDay } from '../quiet-hours';

const DAY_MS = 86_400_000;
/** Lignes listées dans un récapitulatif (le reste est résumé en « + N autres »). */
const MAX_LINES = 8;

/** Lignes d'un récapitulatif : titres des alertes, les plus récentes d'abord. */
export function summaryLines(titles: string[]): string[] {
  const lines = titles.slice(0, MAX_LINES);
  if (titles.length > MAX_LINES) lines.push(`+ ${titles.length - MAX_LINES} autres`);
  return lines;
}

/**
 * Faut-il envoyer le résumé quotidien maintenant ? À l'heure choisie (heure de Paris), une fois
 * par jour : pas de résumé déjà envoyé depuis 20 h.
 */
export function digestDue(now: Date, hour: number, sentAt: Date | null): boolean {
  if (Math.floor(minutesOfDay(now) / 60) !== hour) return false;
  return sentAt === null || now.getTime() - sentAt.getTime() > 20 * 60 * 60 * 1000;
}

/**
 * File des notifications, toutes les 10 minutes :
 * - alertes retenues la nuit (mode « rien la nuit ») : un récapitulatif à la fin de la plage ;
 * - résumé quotidien à l'heure choisie (alertes des dernières 24 h), qui libère aussi les
 *   alertes retenues en mode « résumé seulement ».
 */
export async function runNotificationQueue(ctx: WorkerContext, now = new Date()): Promise<void> {
  const settings = await prisma.alertSettings.findMany({
    where: {
      OR: [
        { quietMode: 'hold' },
        { digest: true },
        { digestOnly: true },
        // Alertes encore retenues après un changement de réglage (« Résumé seulement » décoché).
        { user: { alerts: { some: { held: true, muted: false } } } },
      ],
    },
    select: {
      userId: true,
      quietStart: true,
      quietEnd: true,
      quietMode: true,
      digest: true,
      digestHour: true,
      digestOnly: true,
      digestSentAt: true,
      user: { select: { role: true } },
    },
  });
  const appUrl = ctx.env.APP_URL.replace(/\/$/, '');
  for (const s of settings) {
    const admin = s.user.role === 'ADMIN';
    const quiet = inQuietHours(now, s.quietStart, s.quietEnd);
    try {
      // Résumé quotidien (le mode « résumé seulement » l'impose).
      if ((s.digest || s.digestOnly) && digestDue(now, s.digestHour, s.digestSentAt)) {
        const since = new Date(Math.max(now.getTime() - DAY_MS, s.digestSentAt?.getTime() ?? 0));
        const events = await prisma.alertEvent.findMany({
          where: { userId: s.userId, muted: false, createdAt: { gte: since } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, title: true },
        });
        if (events.length > 0) {
          const sent = await deliverToUser(ctx, s.userId, admin, {
            title: `☀️ Résumé : ${events.length} alerte${events.length > 1 ? 's' : ''} en 24 h`,
            message: 'Les alertes des dernières 24 heures.',
            details: summaryLines(events.map((e) => e.title)),
            url: `${appUrl}/alertes`,
            linkLabel: 'Voir les alertes',
            priority: 'default',
            silent: quiet,
            tags: ['sunny'],
          });
          await prisma.alertEvent.updateMany({
            where: { id: { in: events.map((e) => e.id) }, held: true },
            data: { held: false, sentPush: sent.push, sentTelegram: sent.telegram },
          });
        }
        await prisma.alertSettings.update({
          where: { userId: s.userId },
          data: { digestSentAt: now },
        });
        continue;
      }
      // Fin de la nuit, ou mode « résumé seulement » désactivé : récapitulatif des alertes
      // retenues.
      if (!s.digestOnly && !(quiet && s.quietMode === 'hold')) {
        const held = await prisma.alertEvent.findMany({
          where: {
            userId: s.userId,
            held: true,
            muted: false,
            createdAt: { gte: new Date(now.getTime() - DAY_MS) },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true, title: true, url: true },
        });
        if (held.length === 0) continue;
        const one = held.length === 1 ? held[0]! : null;
        const sent = await deliverToUser(ctx, s.userId, admin, {
          title: one ? one.title : `🌙 ${held.length} alertes pendant les heures silencieuses`,
          message: one ? 'Alerte retenue, envoyée maintenant.' : 'Alertes retenues :',
          details: one ? undefined : summaryLines(held.map((e) => e.title)),
          url: one?.url ?? `${appUrl}/alertes`,
          linkLabel: one ? undefined : 'Voir les alertes',
          priority: 'default',
          tags: ['crescent_moon'],
        });
        await prisma.alertEvent.updateMany({
          where: { id: { in: held.map((e) => e.id) } },
          data: { held: false, sentPush: sent.push, sentTelegram: sent.telegram },
        });
      }
    } catch (err) {
      ctx.logger.warn({ err, userId: s.userId }, 'File des notifications : envoi impossible');
    }
  }
}
