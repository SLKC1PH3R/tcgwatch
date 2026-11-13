import { prisma } from '@tcgwatch/db';
import { mergeSetCards, TcgdexClient, type MergedCard } from '@tcgwatch/market';
import type { WorkerContext } from '../context';

/** Extensions récentes (ou à venir) dont la liste de cartes est relue chaque semaine. */
const REFRESH_RECENT_DAYS = 180;
const REFRESH_EVERY_DAYS = 7;

export interface CardImportSummary {
  sets: number;
  cards: number;
  failed: number;
}

/**
 * Import des cartes de toutes les extensions (TCGdex GraphQL, français puis anglais pour les
 * noms et images manquants). Première passe : toutes les extensions sans cartes ; ensuite,
 * une relecture hebdomadaire des extensions récentes. Les cotes ne sont pas importées ici
 * (lues à l'ouverture des pages, cache de 24 h).
 */
export async function importCards(
  ctx: Pick<WorkerContext, 'logger'>,
  client = new TcgdexClient(),
  limit = Infinity,
): Promise<CardImportSummary> {
  const now = Date.now();
  const recent = new Date(now - REFRESH_RECENT_DAYS * 86_400_000);
  const refreshed = new Date(now - REFRESH_EVERY_DAYS * 86_400_000);
  const releases = await prisma.release.findMany({
    where: {
      tcgdexId: { not: null },
      OR: [
        { cardsSyncedAt: null },
        {
          cardsSyncedAt: { lt: refreshed },
          OR: [{ releaseDate: null }, { releaseDate: { gte: recent } }],
        },
      ],
    },
    select: { id: true, tcgdexId: true, nameFr: true },
    orderBy: { releaseDate: { sort: 'desc', nulls: 'first' } },
  });

  const summary: CardImportSummary = { sets: 0, cards: 0, failed: 0 };
  for (const release of releases.slice(0, limit)) {
    try {
      // L'une après l'autre : TCGdex répond 503 quand les requêtes s'enchaînent trop vite.
      const fr = await client.setCards(release.tcgdexId!, 'fr');
      const en = await client.setCards(release.tcgdexId!, 'en').catch(() => []);
      const cards = mergeSetCards(fr, en);
      await upsertCards(release.id, cards);
      await prisma.release.update({
        where: { id: release.id },
        data: { cardsSyncedAt: new Date() },
      });
      summary.sets++;
      summary.cards += cards.length;
    } catch (err) {
      summary.failed++;
      ctx.logger.warn({ err, set: release.tcgdexId }, 'Import des cartes impossible');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  ctx.logger.info({ ...summary, pending: releases.length }, 'Import des cartes terminé');
  return summary;
}

/**
 * Écrit toutes les cartes d'une extension en une requête (INSERT … ON CONFLICT) : les cotes
 * en cache ne sont pas touchées.
 */
async function upsertCards(releaseId: string, cards: MergedCard[]) {
  if (cards.length === 0) return;
  await prisma.$executeRaw`
    INSERT INTO "Card" ("id", "releaseId", "localId", "number", "name", "nameMissing", "imageUrl",
      "rarity", "illustrator", "category", "types", "dexIds", "variants", "updatedAt")
    SELECT c.id, ${releaseId}, c."localId", c.number, c.name, c."nameMissing", c."imageUrl",
      c.rarity, c.illustrator, c.category,
      ARRAY(SELECT jsonb_array_elements_text(c.types)),
      ARRAY(SELECT jsonb_array_elements_text(c."dexIds")::int),
      ARRAY(SELECT jsonb_array_elements_text(c.variants)), NOW()
    FROM jsonb_to_recordset(${JSON.stringify(cards)}::jsonb) AS c(
      id text, "localId" text, number int, name text, "nameMissing" boolean, "imageUrl" text,
      rarity text, illustrator text, category text, types jsonb, "dexIds" jsonb, variants jsonb)
    ON CONFLICT ("id") DO UPDATE SET
      "releaseId" = EXCLUDED."releaseId", "localId" = EXCLUDED."localId",
      "number" = EXCLUDED."number", "name" = EXCLUDED."name",
      "nameMissing" = EXCLUDED."nameMissing", "imageUrl" = EXCLUDED."imageUrl",
      "rarity" = EXCLUDED."rarity", "illustrator" = EXCLUDED."illustrator",
      "category" = EXCLUDED."category", "types" = EXCLUDED."types",
      "dexIds" = EXCLUDED."dexIds", "variants" = EXCLUDED."variants", "updatedAt" = NOW()`;
}
