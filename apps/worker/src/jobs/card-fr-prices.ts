import { prisma } from '@tcgwatch/db';
import { EbayClient } from '@tcgwatch/market';
import { cardListingQuery, relevantCardListing, todayUtc, toNumber } from '@tcgwatch/shared';
import type { WorkerContext } from '../context';
import { secondhandStats } from './secondhand';

/** Cartes à l'unité (catégorie eBay « Cartes à collectionner : cartes à l'unité »). */
const EBAY_SINGLES = '183454';
/** Recherches par passage (l'API eBay en accorde 5 000 par jour, partagées avec le scellé). */
const PER_RUN = 150;
const PAUSE_MS = 1500;

/**
 * Prix français des cartes possédées (par au moins un utilisateur) : médiane des annonces
 * eBay en français, prix hors port. Une fois par jour et par carte, les plus anciennes d'abord.
 * Ce sont des prix demandés, pas des ventes : eBay réserve l'historique des ventes à ses
 * partenaires.
 */
export async function runCardFrPrices(ctx: WorkerContext, limit = PER_RUN): Promise<void> {
  const { env } = ctx;
  if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) return;
  const client = new EbayClient(env.EBAY_CLIENT_ID, env.EBAY_CLIENT_SECRET);
  const today = todayUtc();
  const cards = await prisma.card.findMany({
    where: {
      owned: { some: { quantity: { gt: 0 } } },
      OR: [{ frPriceAt: null }, { frPriceAt: { lt: today } }],
    },
    select: {
      id: true,
      name: true,
      localId: true,
      rarity: true,
      priceTrend: true,
      release: { select: { nameFr: true, tcgdexId: true, cardCountOfficial: true } },
    },
    orderBy: { frPriceAt: { sort: 'asc', nulls: 'first' } },
    take: limit,
  });

  let priced = 0;
  for (const c of cards) {
    try {
      const listings = await client.search({
        query: cardListingQuery(c),
        condition: 'any',
        categoryId: EBAY_SINGLES,
        limit: 200,
      });
      const trend = toNumber(c.priceTrend);
      const prices = listings
        .filter((l) => !l.auction && relevantCardListing(l.title, c))
        .map((l) => l.price)
        // Très en dessous de la cote toutes langues : faux, proxy ou carte abîmée.
        .filter((p) => trend === null || p >= trend * 0.3);
      // Peu d'annonces (carte rare en français) : prix gardé quand même, avec leur nombre.
      const sorted = [...prices].sort((a, b) => a - b);
      const stats =
        secondhandStats(prices) ??
        (sorted.length
          ? {
              median: sorted[Math.floor((sorted.length - 1) / 2)]!,
              low: sorted[0]!,
              count: sorted.length,
            }
          : null);
      await prisma.card.update({
        where: { id: c.id },
        data: {
          frPrice: stats?.median ?? null,
          frPriceLow: stats?.low ?? null,
          frPriceCount: stats?.count ?? prices.length,
          frPriceAt: new Date(),
        },
      });
      if (stats) priced++;
    } catch (err) {
      ctx.logger.warn({ err, card: c.id }, 'Prix français eBay impossible');
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  if (cards.length) {
    ctx.logger.info({ cards: cards.length, priced }, 'Prix français des cartes relevés (eBay)');
  }
}
