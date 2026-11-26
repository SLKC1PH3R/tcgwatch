import { compactSnapshots, prisma, purgeStale } from '@tcgwatch/db';
import cron, { type ScheduledTask } from 'node-cron';
import { EbayClient } from '@tcgwatch/market';
import { createContext, type WorkerContext } from './context';
import { startHealthServer } from './health';
import { checkDueListings } from './jobs/check-listings';
import { discoverListings, purgeAccessoryListings } from './jobs/discover-listings';
import { importCards } from './jobs/import-cards';
import { fillReleaseLogos } from './jobs/release-logos';
import { importPokecardex } from './jobs/import-pokecardex';
import { importTcgdex } from './jobs/import-tcgdex';
import { linkProductExtensions } from './jobs/link-extensions';
import { runMarketJob } from './jobs/market';
import { runMarketListings } from './jobs/market-listings';
import { runCardHashes } from './jobs/card-hashes';
import { runReleaseReminders } from './jobs/release-reminders';
import { runSecondhandPrices } from './jobs/secondhand';
import { runCardFrPrices } from './jobs/card-fr-prices';
import { runCardWatch } from './jobs/card-watch';
import { runNotificationQueue } from './jobs/notification-queue';
import { syncRetailers } from './jobs/sync-retailers';
import { recordApiCalls, startJobRun } from './usage';

/** Empêche deux exécutions simultanées d'une même tâche planifiée. */
function exclusive(ctx: WorkerContext, name: string, fn: () => Promise<unknown>) {
  let running = false;
  return async () => {
    if (running) {
      ctx.logger.debug({ job: name }, 'Tâche encore en cours, tick ignoré');
      return;
    }
    running = true;
    const finish = await startJobRun(name);
    const ebayBefore = EbayClient.calls;
    let failure: string | undefined;
    try {
      await fn();
    } catch (err) {
      failure = err instanceof Error ? err.message : String(err);
      ctx.status.lastError = `${name}: ${failure}`;
      ctx.logger.error({ err, job: name }, 'Échec de la tâche planifiée');
    } finally {
      running = false;
      await finish(failure);
      await recordApiCalls('ebay', EbayClient.calls - ebayBefore);
    }
  };
}

async function main() {
  const ctx = createContext();
  const { env, logger } = ctx;
  logger.info(
    {
      listingsCron: env.LISTINGS_CRON,
      tcgdexCron: env.TCGDEX_CRON,
      pokecardexCron: env.POKECARDEX_ENABLED ? env.POKECARDEX_CRON : 'désactivé',
      discoveryCron: env.DISCOVERY_ENABLED ? env.DISCOVERY_CRON : 'désactivé',
      marketCron: env.MARKET_CRON,
      historyCron: env.HISTORY_CRON,
      ebayCron: env.EBAY_CLIENT_ID ? env.EBAY_CRON : 'désactivé (pas de clés)',
      playwright: env.PLAYWRIGHT_ENABLED,
      notifications: ctx.notifier.enabled,
    },
    'Démarrage du worker TCGWatch',
  );

  const health = startHealthServer(ctx);
  const timezone = process.env.TZ ?? 'Europe/Paris';

  const listingsJob = exclusive(ctx, 'listings', () => checkDueListings(ctx));
  // Extensions, puis leurs cartes (première passe : toutes ; ensuite les récentes), puis
  // rattachement des produits à leur extension.
  const tcgdexJob = exclusive(ctx, 'tcgdex', async () => {
    await importTcgdex(ctx);
    await fillReleaseLogos(ctx);
    await importCards(ctx);
    await linkProductExtensions(ctx);
  });
  const marketJob = exclusive(ctx, 'market', async () => {
    await runMarketJob(ctx);
    await runCardWatch(ctx);
  });
  const pokecardexJob = exclusive(ctx, 'pokecardex', async () => {
    await importPokecardex(ctx);
    await linkProductExtensions(ctx);
  });
  const discoveryJob = exclusive(ctx, 'discovery', () => discoverListings(ctx));
  const historyJob = exclusive(ctx, 'history', async () => {
    const removed = await compactSnapshots(new Date(), env.SNAPSHOT_RETENTION_DAYS);
    const purged = await purgeStale(new Date(), env.ALERT_RETENTION_DAYS);
    // Passages des tâches : un mois suffit au tableau de bord des sources.
    await prisma.jobRun.deleteMany({
      where: { startedAt: { lt: new Date(Date.now() - 30 * 86_400_000) } },
    });
    await prisma.workerError.deleteMany({
      where: { lastAt: { lt: new Date(Date.now() - 30 * 86_400_000) } },
    });
    logger.info(
      { removed, ...purged },
      'Relevés anciens regroupés dans le résumé quotidien, alertes et sessions périmées supprimées',
    );
  });

  const releaseReminderJob = exclusive(ctx, 'release-reminders', async () => {
    await runReleaseReminders(ctx);
  });

  const notifyQueueJob = exclusive(ctx, 'notify-queue', () => runNotificationQueue(ctx));

  const cardHashJob = exclusive(ctx, 'card-hashes', async () => {
    await runCardHashes(ctx);
  });

  const tasks: ScheduledTask[] = [
    cron.schedule(env.LISTINGS_CRON, listingsJob, { timezone, name: 'listings' }),
    cron.schedule(env.TCGDEX_CRON, tcgdexJob, { timezone, name: 'tcgdex' }),
    cron.schedule(env.MARKET_CRON, marketJob, { timezone, name: 'market' }),
    cron.schedule(env.HISTORY_CRON, historyJob, { timezone, name: 'history' }),
    cron.schedule(env.CARD_HASH_CRON, cardHashJob, { timezone, name: 'card-hashes' }),
    cron.schedule(env.NOTIFY_QUEUE_CRON, notifyQueueJob, { timezone, name: 'notify-queue' }),
    cron.schedule(env.RELEASE_REMINDER_CRON, releaseReminderJob, {
      timezone,
      name: 'release-reminders',
    }),
  ];
  if (env.POKECARDEX_ENABLED) {
    tasks.push(cron.schedule(env.POKECARDEX_CRON, pokecardexJob, { timezone, name: 'pokecardex' }));
  }
  if (env.DISCOVERY_ENABLED) {
    tasks.push(cron.schedule(env.DISCOVERY_CRON, discoveryJob, { timezone, name: 'discovery' }));
  }
  // Annonces eBay de « Mes produits » (API officielle, seulement si les clés sont fournies).
  if (env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET) {
    // Après les annonces : la médiane d'occasion du jour (une fois par produit et par jour).
    const ebayJob = exclusive(ctx, 'ebay', async () => {
      await runMarketListings(ctx);
      await runSecondhandPrices(ctx);
      await runCardFrPrices(ctx);
      await runCardWatch(ctx);
    });
    tasks.push(cron.schedule(env.EBAY_CRON, ebayJob, { timezone, name: 'ebay' }));
  }

  // Annuaire des revendeurs : nouveaux sites et métadonnées à jour à chaque démarrage.
  await exclusive(ctx, 'retailers', () => syncRetailers(ctx))();
  // Fiches d'accessoires rapprochées à tort d'un produit : retirées dès le démarrage.
  await exclusive(ctx, 'accessories', () => purgeAccessoryListings(ctx))();
  // Empreintes du scanner : rattrapage dès le démarrage, sans attendre le passage horaire.
  void cardHashJob();

  // Premier démarrage (ou encyclopédie pas encore importée) → import TCGdex immédiat.
  const [imported, series, cards] = await Promise.all([
    prisma.release.count({ where: { source: 'TCGDEX' } }),
    prisma.serie.count(),
    prisma.card.count(),
  ]);
  if (imported === 0 || series === 0 || cards === 0) void tcgdexJob();
  // Premier démarrage du catalogue : produits Pokécardex, puis découverte de leurs fiches.
  const catalogProducts = await prisma.product.count({ where: { externalId: { not: null } } });
  const discovered = await prisma.listing.count({ where: { discovered: true } });
  const chaseCards = await prisma.chaseCard.count();
  void (async () => {
    if (env.POKECARDEX_ENABLED && catalogProducts === 0) await pokecardexJob();
    if (env.DISCOVERY_ENABLED && discovered === 0) await discoveryJob();
    if (chaseCards === 0) await marketJob();
  })();
  void listingsJob();

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'Arrêt du worker');
    for (const t of tasks) await t.stop();
    health.close();
    await ctx.browser?.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error('Échec du démarrage du worker', err);
  process.exit(1);
});
