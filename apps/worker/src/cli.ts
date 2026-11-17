/**
 * Commandes ponctuelles (debug / maintenance) :
 *
 *   pnpm --filter @tcgwatch/worker check-once listings   # relève les listings à échéance
 *   pnpm --filter @tcgwatch/worker check-once tcgdex     # import TCGdex (séries, extensions)
 *   pnpm --filter @tcgwatch/worker check-once cards [n]  # import des cartes (n extensions)
 *   pnpm --filter @tcgwatch/worker check-once link       # rattache les produits aux extensions
 *   pnpm --filter @tcgwatch/worker check-once pokecardex # import du calendrier Pokécardex
 *   pnpm --filter @tcgwatch/worker check-once discover [slug]  # découverte des fiches revendeurs
 *   pnpm --filter @tcgwatch/worker check-once market     # relevé du marché secondaire
 *   pnpm --filter @tcgwatch/worker check-once card-prices [n]  # cotes des cartes (n ids cherchés)
 *   pnpm --filter @tcgwatch/worker check-once sealed-prices  # scellés reliés à Cardmarket + cotes
 *   pnpm --filter @tcgwatch/worker check-once card-images [set]  # images manquantes (pokemontcg.io)
 *   pnpm --filter @tcgwatch/worker check-once all-now    # force le relevé de TOUS les listings
 *   pnpm --filter @tcgwatch/worker check-once retailers  # synchronise l'annuaire des revendeurs
 */
import { prisma } from '@tcgwatch/db';
import { createContext } from './context';
import { checkDueListings } from './jobs/check-listings';
import { discoverListings } from './jobs/discover-listings';
import { importCards } from './jobs/import-cards';
import { importPokecardex } from './jobs/import-pokecardex';
import { importTcgdex } from './jobs/import-tcgdex';
import { linkProductExtensions } from './jobs/link-extensions';
import { applyCardPrices, resolveCardmarketIds, snapshotMarketIndex } from './jobs/card-prices';
import { runMarketJob, saveQuotes } from './jobs/market';
import { linkSealedProducts } from './jobs/sealed-links';
import { fillCardImages } from './jobs/card-images';
import { CardmarketGuideProvider } from '@tcgwatch/market';
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
    case 'cards':
      await importCards(ctx, undefined, process.argv[3] ? Number(process.argv[3]) : Infinity);
      break;
    case 'link':
      await linkProductExtensions(ctx);
      break;
    case 'pokecardex':
      await importPokecardex(ctx);
      break;
    case 'discover':
      await discoverListings(ctx, process.argv[3]);
      break;
    case 'market':
      await runMarketJob(ctx);
      break;
    case 'card-prices': {
      const ids = await resolveCardmarketIds(ctx, Number(process.argv[3] ?? 3000));
      const guide = new CardmarketGuideProvider(true, ctx.env.CARDMARKET_PRICE_GUIDE_URL);
      const priced = await applyCardPrices(await guide.priceGuide(), await guide.singlesList());
      await snapshotMarketIndex();
      ctx.logger.info({ ...ids, priced }, 'Cotes des cartes mises à jour');
      break;
    }
    case 'sealed-prices': {
      const guide = new CardmarketGuideProvider(true, ctx.env.CARDMARKET_PRICE_GUIDE_URL);
      const products = await prisma.product.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          ean: true,
          cardmarketId: true,
          releaseDate: true,
          extensionId: true,
        },
      });
      const linked = await linkSealedProducts(guide, products);
      const quotes = await guide.fetchQuotes(products);
      await saveQuotes(quotes);
      ctx.logger.info({ linked, quotes: quotes.length }, 'Cotes Cardmarket des produits scellés');
      break;
    }
    case 'card-images': {
      // Toutes les extensions avec des cartes sans image, ou une seule (vérifiée sur TCGdex).
      const set = process.argv[3];
      const releases = await prisma.release.findMany({
        where: set ? { tcgdexId: set } : { cards: { some: { imageUrl: null } } },
        select: { id: true },
      });
      const filled = await fillCardImages(
        ctx,
        releases.map((r) => r.id),
        { probe: Boolean(set) },
      );
      ctx.logger.info({ releases: releases.length, filled }, 'Images des cartes complétées');
      break;
    }
    case 'retailers':
      await syncRetailers(ctx);
      break;
    default:
      ctx.logger.error(
        { command },
        'Commande inconnue (listings | all-now | tcgdex | cards | link | pokecardex | discover | market | card-prices | sealed-prices | card-images | retailers)',
      );
      process.exitCode = 1;
  }
} finally {
  await ctx.browser?.close();
  await prisma.$disconnect();
}
