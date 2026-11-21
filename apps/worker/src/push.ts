import { prisma } from '@tcgwatch/db';
import type { Env } from '@tcgwatch/shared/env';
import webpush from 'web-push';
import type { Logger } from '@tcgwatch/shared/logger';
import type { Notification } from './notify';

/** Contenu lu par le service worker du site (public/sw.js). */
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  silent?: boolean;
}

export function toPushPayload(n: Notification & { dedupeKey?: string }): PushPayload {
  return {
    title: n.title,
    body: [n.message, ...(n.details ?? [])].join('\n'),
    url: n.url,
    tag: n.dedupeKey,
    silent: n.silent,
  };
}

/**
 * Notifications du navigateur (Web Push, clés VAPID). Les abonnements expirés (404 / 410)
 * sont supprimés au passage.
 */
export class PushSender {
  constructor(
    env: Env,
    private readonly logger: Logger,
  ) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
  }

  static fromEnv(env: Env, logger: Logger): PushSender | undefined {
    return env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY ? new PushSender(env, logger) : undefined;
  }

  /** Envoie à tous les appareils de l'utilisateur ; renvoie le nombre d'envois réussis. */
  async sendToUser(userId: string, n: Notification & { dedupeKey?: string }): Promise<number> {
    const devices = await prisma.pushSubscription.findMany({ where: { userId } });
    const payload = JSON.stringify(toPushPayload(n));
    let ok = 0;
    for (const d of devices) {
      try {
        await webpush.sendNotification(
          { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
          payload,
          { TTL: 6 * 3600, urgency: n.silent ? 'low' : 'high' },
        );
        ok++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: d.id } }).catch(() => undefined);
        } else {
          this.logger.warn({ err, userId }, 'Notification du navigateur impossible');
        }
      }
    }
    return ok;
  }
}
