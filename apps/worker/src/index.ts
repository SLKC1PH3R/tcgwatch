import { compactSnapshots, prisma } from '@tcgwatch/db';
import cron, { type ScheduledTask } from 'node-cron';
import { createContext, type WorkerContext } from './context';
import { startHealthServer } from './health';
import { checkDueListings } from './jobs/check-listings';
import { discoverListings } from './jobs/discover-listings';
import { importPokecardex } from './jobs/import-pokecardex';
import { importTcgdex } from './jobs/import-tcgdex';
import { runMarketJob } from './jobs/market';
import { syncRetailers } from './jobs/sync-retailers';

/** Empêche deux exécutions simultanées d'une même tâche planifiée. */
function exclusive(ctx: WorkerContext, name: string, fn: () => Promise<unknown>) {
  let running = false;
  return async () => {
    if (running) {
      ctx.logger.debug({ job: name }, 'Tâche encore en cours, tick ignoré');
      return;
    }
    running = true;
    try {
      await fn();
    } catch (err) {
      ctx.status.lastError = `${name}: ${err instanceof Error ? err.message : String(err)}`;
      ctx.logger.error({ err, job: name }, 'Échec de la tâche planifiée');
    } finally {
      running = false;
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
      playwright: env.PLAYWRIGHT_ENABLED,
      notifications: ctx.notifier.enabled,
    },
    'Démarrage du worker TCGWatch',
  );

  const health = startHealthServer(ctx);
  const timezone = process.env.TZ ?? 'Europe/Paris';

  const listingsJob = exclusive(ctx, 'listings', () => checkDueListings(ctx));
  const tcgdexJob = exclusive(ctx, 'tcgdex', () => importTcgdex(ctx));
  const marketJob = exclusive(ctx, 'market', () => runMarketJob(ctx));
  const pokecardexJob = exclusive(ctx, 'pokecardex', () => importPokecardex(ctx));
  const discoveryJob = exclusive(ctx, 'discovery', () => discoverListings(ctx));
  const historyJob = exclusive(ctx, 'history', async () => {
    const removed = await compactSnapshots();
    logger.info({ removed }, 'Relevés anciens regroupés dans le résumé quotidien');
  });

  const tasks: ScheduledTask[] = [
    cron.schedule(env.LISTINGS_CRON, listingsJob, { timezone, name: 'listings' }),
    cron.schedule(env.TCGDEX_CRON, tcgdexJob, { timezone, name: 'tcgdex' }),
    cron.schedule(env.MARKET_CRON, marketJob, { timezone, name: 'market' }),
    cron.schedule(env.HISTORY_CRON, historyJob, { timezone, name: 'history' }),
  ];
  if (env.POKECARDEX_ENABLED) {
    tasks.push(cron.schedule(env.POKECARDEX_CRON, pokecardexJob, { timezone, name: 'pokecardex' }));
  }
  if (env.DISCOVERY_ENABLED) {
    tasks.push(cron.schedule(env.DISCOVERY_CRON, discoveryJob, { timezone, name: 'discovery' }));
  }

  // Annuaire des revendeurs : nouveaux sites et métadonnées à jour à chaque démarrage.
  await exclusive(ctx, 'retailers', () => syncRetailers(ctx))();

  // Premier démarrage : calendrier vide → import TCGdex immédiat.
  const imported = await prisma.release.count({ where: { source: 'TCGDEX' } });
  if (imported === 0) void tcgdexJob();
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
