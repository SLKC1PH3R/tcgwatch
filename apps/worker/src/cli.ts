/**
 * Commandes ponctuelles (debug / maintenance) :
 *
 *   pnpm --filter @tcgwatch/worker check-once listings   # relève les listings à échéance
 *   pnpm --filter @tcgwatch/worker check-once tcgdex     # import TCGdex
 *   pnpm --filter @tcgwatch/worker check-once pokecardex # import du calendrier Pokécardex
 *   pnpm --filter @tcgwatch/worker check-once market     # relevé du marché secondaire
 *   pnpm --filter @tcgwatch/worker check-once all-now    # force le relevé de TOUS les listings
 *   pnpm --filter @tcgwatch/worker check-once retailers  # synchronise l'annuaire des revendeurs
 */
import { prisma } from '@tcgwatch/db';
import { createContext } from './context';
import { checkDueListings } from './jobs/check-listings';
import { importPokecardex } from './jobs/import-pokecardex';
import { importTcgdex } from './jobs/import-tcgdex';
import { runMarketJob } from './jobs/market';
import { syncRetailers } from './jobs/sync-retailers';

const command = process.argv[2] ?? 'listings';
const ctx = createContext();

try {
  switch (command) {
    case 'listings':
      await checkDueListings(ctx);
      break;
    case 'all-now':
      await prisma.listing.updateMany({ data: { nextCheckAt: new Date() } });
      while ((await checkDueListings(ctx)) > 0) {
        /* lots successifs */
      }
      break;
    case 'tcgdex':
      await importTcgdex(ctx);
      break;
    case 'pokecardex':
      await importPokecardex(ctx);
      break;
    case 'market':
      await runMarketJob(ctx);
      break;
    case 'retailers':
      await syncRetailers(ctx);
      break;
    default:
      ctx.logger.error(
        { command },
        'Commande inconnue (listings | all-now | tcgdex | pokecardex | market | retailers)',
      );
      process.exitCode = 1;
  }
} finally {
  await ctx.browser?.close();
  await prisma.$disconnect();
}
