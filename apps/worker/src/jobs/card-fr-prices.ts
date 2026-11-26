import { prisma } from '@tcgwatch/db';
import { EbayClient } from '@tcgwatch/market';
import {
  cardListingQuery,
  keepDominantNumber,
  relevantCardListing,
  reprintNumbering,
  todayUtc,
  toNumber,
} from '@tcgwatch/shared';
import type { WorkerContext } from '../context';
import { secondhandStats } from './secondhand';

/** Cartes à l'unité (catégorie eBay « Cartes à collectionner : cartes à l'unité »). */
const EBAY_SINGLES = '183454';
/** Recherches par passage (l'API eBay en accorde 5 000 par jour, partagées avec le scellé). */
const PER_RUN = 150;
/** Recherches par jour au plus : le reste du quota eBay va au scellé. */
const DAILY_MAX = 2500;
const PAUSE_MS = 1500;

/**
 * Prix français des cartes possédées (par au moins un utilisateur), puis des cartes manquantes
 * des extensions commencées : médiane des annonces eBay en français, prix hors port. Une fois par jour et par carte, les plus anciennes d'abord.
 * Ce sont des prix demandés, pas des ventes : eBay réserve l'historique des ventes à ses
 * partenaires.
 */
export async function runCardFrPrices(
  ctx: WorkerContext,
  limit = PER_RUN,
  /** Une ligne par carte (commande `fr-prices`) : recherche, annonces gardées, prix. */
  verbose = false,
  /** Relève aussi les cartes déjà relevées aujourd'hui. */
  force = false,
): Promise<void> {
  const { env } = ctx;
  if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) return;
  const client = new EbayClient(env.EBAY_CLIENT_ID, env.EBAY_CLIENT_SECRET);
  const today = todayUtc();
  const select = {
    id: true,
    name: true,
    localId: true,
    rarity: true,
    priceTrend: true,
    release: { select: { nameFr: true, tcgdexId: true, cardCountOfficial: true } },
  } as const;
  const stale = force ? {} : { OR: [{ frPriceAt: null }, { frPriceAt: { lt: today } }] };
  const owned = { owned: { some: { quantity: { gt: 0 } } } };
  const doneToday = await prisma.card.count({ where: { frPriceAt: { gte: today } } });
  if (!force && doneToday >= DAILY_MAX) return;
  limit = force ? limit : Math.min(limit, DAILY_MAX - doneToday);
  // Cartes possédées d'abord, puis celles qui manquent dans les extensions commencées
  // (coût pour compléter un set).
  const mine = await prisma.card.findMany({
    where: { ...owned, ...stale },
    select,
    orderBy: { frPriceAt: { sort: 'asc', nulls: 'first' } },
    take: limit,
  });
  const missing =
    mine.length < limit
      ? await prisma.card.findMany({
          where: {
            ...stale,
            owned: { none: { quantity: { gt: 0 } } },
            release: { cards: { some: owned } },
          },
          select,
          orderBy: { frPriceAt: { sort: 'asc', nulls: 'first' } },
          take: limit - mine.length,
        })
      : [];
  // Cartes de listes de recherche avec un prix cible, avant les manquantes des extensions.
  const wanted =
    mine.length < limit
      ? await prisma.card.findMany({
          where: {
            ...stale,
            owned: { none: { quantity: { gt: 0 } } },
            showcaseEntries: { some: { targetPrice: { not: null }, showcase: { wanted: true } } },
          },
          select,
          orderBy: { frPriceAt: { sort: 'asc', nulls: 'first' } },
          take: limit - mine.length,
        })
      : [];
  const seen = new Set([...mine, ...wanted].map((c) => c.id));
  const cards = [...mine, ...wanted, ...missing.filter((c) => !seen.has(c.id))].slice(0, limit);
  let priced = 0;
  if (verbose) ctx.logger.info({ cards: cards.length }, 'Prix français : cartes à relever');
  for (const [i, c] of cards.entries()) {
    try {
      const query = cardListingQuery(c);
      const listings = await client.search({
        query,
        condition: 'any',
        categoryId: EBAY_SINGLES,
        limit: 200,
      });
      const trend = toNumber(c.priceTrend);
      const relevant = listings
        .filter((l) => !l.auction && relevantCardListing(l.title, c))
        // Très en dessous de la cote toutes langues : faux, proxy ou carte abîmée.
        .filter((l) => trend === null || l.price >= trend * 0.3);
      // Réédition cherchée sans numéro : le numéro le plus cité désigne la carte.
      const kept = reprintNumbering(c) ? keepDominantNumber(relevant) : relevant;
      const prices = kept.map((l) => l.price);
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
      // Historique : un point par jour à côté des cotes Cardmarket.
      if (stats) {
        await prisma.cardPriceDaily.upsert({
          where: { cardId_date: { cardId: c.id, date: today } },
          create: { cardId: c.id, date: today, frPrice: stats.median },
          update: { frPrice: stats.median },
        });
      }
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
      if (verbose) {
        ctx.logger.info(
          {
            n: `${i + 1}/${cards.length}`,
            carte: `${c.name} ${c.localId} · ${c.release.nameFr}`,
            recherche: query,
            annonces: listings.length,
            gardees: prices.length,
            prix: stats?.median ?? null,
            cote: trend,
            exemples: kept.slice(0, 5).map((l) => `${l.price} € · ${l.title}`),
          },
          stats ? `${c.name} : ${stats.median} €` : `${c.name} : aucune annonce en français`,
        );
      }
    } catch (err) {
      ctx.logger.warn({ err, card: c.id }, 'Prix français eBay impossible');
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  if (cards.length) {
    ctx.logger.info({ cards: cards.length, priced }, 'Prix français des cartes relevés (eBay)');
  }
}
