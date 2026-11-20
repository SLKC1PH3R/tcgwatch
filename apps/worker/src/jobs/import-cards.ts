import { prisma } from '@tcgwatch/db';
import { mergeSetCards, TcgdexClient, type MergedCard } from '@tcgwatch/market';
import type { WorkerContext } from '../context';
import { fillCardImages } from './card-images';

/** Extensions récentes (ou à venir) dont la liste de cartes est relue chaque semaine. */
const REFRESH_RECENT_DAYS = 180;
const REFRESH_EVERY_DAYS = 7;

export interface CardImportSummary {
  sets: number;
  cards: number;
  failed: number;
}

/** Extensions incomplètes (cartes sans image) reprises à chaque passage. */
const MISSING_IMAGES_PER_RUN = 10;

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
    select: { id: true, tcgdexId: true, nameFr: true, releaseDate: true },
    orderBy: { releaseDate: { sort: 'desc', nulls: 'first' } },
  });

  const summary: CardImportSummary = { sets: 0, cards: 0, failed: 0 };
  const imported: { id: string; recent: boolean }[] = [];
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
      imported.push({
        id: release.id,
        recent: !release.releaseDate || release.releaseDate >= recent,
      });
    } catch (err) {
      summary.failed++;
      ctx.logger.warn({ err, set: release.tcgdexId }, 'Import des cartes impossible');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  // Images absentes de TCGdex (ou annoncées mais pas encore publiées) : pokemontcg.io.
  const images =
    (await fillCardImages(
      ctx,
      imported.filter((r) => r.recent).map((r) => r.id),
      { probe: true },
    )) +
    (await fillCardImages(
      ctx,
      imported.filter((r) => !r.recent).map((r) => r.id),
    )) +
    // Extensions non réimportées aujourd'hui mais encore incomplètes (rapprochement amélioré
    // depuis) : quelques-unes à chaque passage, les plus récentes d'abord.
    (await fillCardImages(
      ctx,
      (
        await prisma.release.findMany({
          where: {
            id: { notIn: imported.map((r) => r.id) },
            tcgdexId: { not: null },
            cards: { some: { imageUrl: null } },
          },
          orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } },
          take: MISSING_IMAGES_PER_RUN,
          select: { id: true },
        })
      ).map((r) => r.id),
    ));
  ctx.logger.info({ ...summary, images, pending: releases.length }, 'Import des cartes terminé');
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
      "nameMissing" = EXCLUDED."nameMissing",
      -- Image d'une autre source (TCGdex n'en a pas) : gardée tant que TCGdex n'en donne pas.
      "imageUrl" = CASE WHEN EXCLUDED."imageUrl" IS NULL
        AND "Card"."imageUrl" NOT LIKE 'https://assets.tcgdex.net/%'
        THEN "Card"."imageUrl" ELSE EXCLUDED."imageUrl" END,
      "rarity" = EXCLUDED."rarity", "illustrator" = EXCLUDED."illustrator",
      "category" = EXCLUDED."category", "types" = EXCLUDED."types",
      "dexIds" = EXCLUDED."dexIds", "variants" = EXCLUDED."variants", "updatedAt" = NOW()`;
}
