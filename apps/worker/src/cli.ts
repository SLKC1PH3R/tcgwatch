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
 *   pnpm --filter @tcgwatch/worker check-once ebay       # annonces eBay de « Mes produits »
 *   pnpm --filter @tcgwatch/worker check-once all-now    # force le relevé de TOUS les listings
 *   pnpm --filter @tcgwatch/worker check-once retailers  # synchronise l'annuaire des revendeurs
 *   pnpm --filter @tcgwatch/worker check-once telegram   # identifiant du chat Telegram du bot
 *   pnpm --filter @tcgwatch/worker check-once notify-test  # notification de test (ntfy, Telegram)
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
import { runCardHashes } from './jobs/card-hashes';
import { fillCardImages } from './jobs/card-images';
import { runMarketListings } from './jobs/market-listings';
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
          cardmarketName: true,
          cardmarketCategory: true,
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
    case 'card-hashes': {
      // Empreintes pour le scanner : enchaîne les lots jusqu'à tout traiter (50 min au plus).
      const n = await runCardHashes(ctx);
      ctx.logger.info({ hashed: n }, 'Empreintes des cartes calculées');
      break;
    }
    case 'ebay':
      if (!ctx.env.EBAY_CLIENT_ID) ctx.logger.warn('EBAY_CLIENT_ID / EBAY_CLIENT_SECRET absents');
      await runMarketListings(ctx);
      break;
    case 'retailers':
      await syncRetailers(ctx);
      break;
    case 'telegram': {
      if (!ctx.env.TELEGRAM_BOT_TOKEN) {
        ctx.logger.error('TELEGRAM_BOT_TOKEN absent : crée le bot avec @BotFather');
        process.exitCode = 1;
        break;
      }
      const chats = await ctx.notifier.telegramChats();
      if (chats.length === 0) {
        ctx.logger.warn(
          'Aucune conversation : envoie un message (/start) à ton bot dans Telegram, puis relance',
        );
      }
      for (const c of chats) {
        ctx.logger.info({ type: c.type, chat: c.name }, `TELEGRAM_CHAT_ID=${c.id}`);
      }
      break;
    }
    case 'notify-test': {
      const sent = await ctx.notifier.send({
        title: '🔔 Test TCGWatch',
        message: 'Les alertes arrivent bien ici : retours en stock, bons prix, annonces.',
        url: ctx.env.APP_URL,
        linkLabel: 'Ouvrir TCGWatch',
        tags: ['bell'],
      });
      ctx.logger.info(sent, 'Notification de test');
      if (!sent.ntfy && !sent.telegram) process.exitCode = 1;
      break;
    }
    default:
      ctx.logger.error(
        { command },
        'Commande inconnue (listings | all-now | tcgdex | cards | link | pokecardex | discover | market | card-prices | sealed-prices | card-images | ebay | retailers | telegram | notify-test)',
      );
      process.exitCode = 1;
  }
} finally {
  await ctx.browser?.close();
  await prisma.$disconnect();
}
