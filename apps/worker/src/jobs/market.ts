import { prisma } from '@tcgwatch/db';
import { createMarketProviders, TcgdexChaseCardProvider } from '@tcgwatch/market';
import { todayUtc } from '@tcgwatch/shared';
import type { WorkerContext } from '../context';
import { selectChaseCards } from './chase-cards';
import { checkMarketMoves } from './price-alerts';

/**
 * Relevé quotidien du marché secondaire :
 * - providers automatiques configurés (PokeTrace : prix de revente Cardmarket des ventes FR)
 *   → MarketPrice (1 relevé/jour/source) ;
 * - cartes phares (choisies automatiquement pour les dernières extensions, ou ajoutées à la
 *   main) → CardPrice via TCGdex (cotations Cardmarket agrégées).
 */
export async function runMarketJob(ctx: WorkerContext) {
  const date = todayUtc();
  const providers = createMarketProviders(ctx.env).filter((p) => p.isEnabled());
  const products = await prisma.product.findMany({
    select: { id: true, name: true, ean: true, type: true },
  });
  const sets = (
    await prisma.release.findMany({
      where: { tcgdexId: { not: null } },
      select: { tcgdexId: true, nameFr: true },
    })
  ).map((r) => ({ tcgdexId: r.tcgdexId!, nameFr: r.nameFr }));

  let quotes = 0;
  for (const provider of providers) {
    try {
      const results = await provider.fetchQuotes(products, { sets });
      for (const q of results) {
        await prisma.marketPrice.upsert({
          where: {
            productId_source_date: { productId: q.productId, source: q.source, date: q.date },
          },
          update: {
            price: q.price,
            currency: q.currency,
            median: q.median ?? null,
            listingCount: q.listingCount ?? null,
          },
          create: q,
        });
      }
      quotes += results.length;
    } catch (err) {
      ctx.logger.error({ err, provider: provider.key }, 'Échec du provider de prix marché');
    }
  }

  // Alertes de variation du prix marché sur 7 jours (MARKET_MOVE_ALERT_PCT, 0 = désactivées).
  const moves = await checkMarketMoves(ctx, date, ctx.env.MARKET_MOVE_ALERT_PCT);

  await selectChaseCards(ctx);
  const cards = await prisma.chaseCard.findMany({ select: { id: true, tcgdexId: true } });
  let cardQuotes = 0;
  if (cards.length) {
    try {
      const results = await new TcgdexChaseCardProvider().fetchCardQuotes(cards, date);
      for (const q of results) {
        await prisma.cardPrice.upsert({
          where: {
            chaseCardId_source_date: { chaseCardId: q.chaseCardId, source: q.source, date: q.date },
          },
          update: { price: q.price, trend: q.trend, low: q.low, avg7: q.avg7, avg30: q.avg30 },
          create: q,
        });
      }
      cardQuotes = results.length;
    } catch (err) {
      ctx.logger.error({ err }, 'Échec du relevé des cartes phares (TCGdex)');
    }
  }

  ctx.status.lastMarketRun = new Date();
  ctx.logger.info({ quotes, cardQuotes, moves }, 'Relevé du marché secondaire terminé');
}
