import { prisma } from '@tcgwatch/db';
import { cardmarketQuote, tcgdexAsset, TcgdexClient, type CardmarketQuote } from '@tcgwatch/market';
import { todayUtc } from '@tcgwatch/shared';
import type { WorkerContext } from '../context';

/** Cartes phares retenues par extension. */
export const CHASE_CARDS_PER_SET = 6;
/** Extensions sorties concernées (les plus récentes). */
const RECENT_SETS = 4;

/**
 * Choisit automatiquement les cartes phares des dernières extensions FR sorties :
 * parmi les cartes « secrètes » (numéro au-delà du nombre officiel : illustrations rares,
 * hyper rares…), les mieux cotées sur Cardmarket via TCGdex. Une extension qui a déjà
 * ses cartes phares n'est pas réexaminée ; les cartes ajoutées à la main sont conservées.
 */
export async function selectChaseCards(
  ctx: Pick<WorkerContext, 'logger'>,
  client = new TcgdexClient(),
): Promise<number> {
  const today = todayUtc();
  const releases = await prisma.release.findMany({
    where: {
      tcgdexId: { not: null },
      releaseDate: { lte: today, gte: new Date(today.getTime() - 365 * 86_400_000) },
    },
    include: { _count: { select: { chaseCards: true } } },
    orderBy: { releaseDate: 'desc' },
    take: RECENT_SETS,
  });

  let added = 0;
  for (const release of releases) {
    if (release._count.chaseCards >= CHASE_CARDS_PER_SET) continue;
    try {
      const set = await client.getSet(release.tcgdexId!);
      const official = set.cardCount?.official ?? 0;
      const secret = (set.cards ?? []).filter((c) => Number(c.localId) > official);
      const priced: ({
        id: string;
        name: string;
        rarity?: string;
        image?: string;
      } & CardmarketQuote)[] = [];
      for (const brief of secret) {
        const card = await client.getCard(brief.id);
        const quote = cardmarketQuote(card);
        if (quote) priced.push({ ...card, ...quote, image: card.image ?? brief.image });
        await new Promise((r) => setTimeout(r, 200));
      }
      priced.sort((a, b) => b.price - a.price);
      for (const card of priced.slice(0, CHASE_CARDS_PER_SET - release._count.chaseCards)) {
        const chase = await prisma.chaseCard.upsert({
          where: { tcgdexId: card.id },
          update: {},
          create: {
            tcgdexId: card.id,
            releaseId: release.id,
            name: card.name,
            rarity: card.rarity ?? null,
            imageUrl: tcgdexAsset(card.image, '/low.webp') ?? null,
          },
        });
        await prisma.cardPrice.upsert({
          where: {
            chaseCardId_source_date: {
              chaseCardId: chase.id,
              source: 'tcgdex-cardmarket',
              date: today,
            },
          },
          update: {
            price: card.price,
            trend: card.trend,
            low: card.low,
            avg7: card.avg7,
            avg30: card.avg30,
          },
          create: {
            chaseCardId: chase.id,
            source: 'tcgdex-cardmarket',
            price: card.price,
            trend: card.trend,
            low: card.low,
            avg7: card.avg7,
            avg30: card.avg30,
            currency: 'EUR',
            date: today,
          },
        });
        added++;
      }
    } catch (err) {
      ctx.logger.warn({ err, set: release.tcgdexId }, 'Sélection des cartes phares impossible');
    }
  }
  ctx.logger.info({ added, sets: releases.length }, 'Cartes phares sélectionnées');
  return added;
}
