import { prisma } from '@tcgwatch/db';
import { TELEGRAM_SETTINGS, type NotifyTestResult } from '@tcgwatch/shared';
import type { WorkerContext } from '../context';
import { telegramPaused } from '../deliver';

/** Message de test, identique à la commande `notify-test`. */
export async function sendNotifyTest(ctx: WorkerContext, opts: { telegram?: boolean } = {}) {
  return ctx.notifier.send(
    {
      title: '🔔 Test TCGWatch',
      message: 'Les alertes arrivent bien ici : retours en stock, bons prix, annonces.',
      url: ctx.env.APP_URL,
      linkLabel: 'Ouvrir TCGWatch',
      tags: ['bell'],
    },
    opts,
  );
}

/**
 * Test demandé depuis la page Membres : envoyé dans la minute (le site n'a pas les jetons
 * ntfy et Telegram), résultat enregistré pour la page.
 */
export async function runRequestedNotifyTest(ctx: WorkerContext): Promise<boolean> {
  const request = await prisma.appSetting.findUnique({
    where: { key: TELEGRAM_SETTINGS.testRequestedAt },
  });
  if (!request) return false;
  await prisma.appSetting.delete({ where: { key: TELEGRAM_SETTINGS.testRequestedAt } });
  const paused = await telegramPaused().catch(() => false);
  const sent = await sendNotifyTest(ctx, { telegram: !paused });
  const result: NotifyTestResult = { at: new Date().toISOString(), ...sent, paused };
  await prisma.appSetting.upsert({
    where: { key: TELEGRAM_SETTINGS.testResult },
    create: { key: TELEGRAM_SETTINGS.testResult, value: JSON.stringify(result) },
    update: { value: JSON.stringify(result) },
  });
  ctx.logger.info(result, 'Notification de test (demandée depuis le site)');
  return true;
}
