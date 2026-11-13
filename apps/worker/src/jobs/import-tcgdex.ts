import { prisma } from '@tcgwatch/db';
import { setCodeFromId, tcgdexAsset, TcgdexClient } from '@tcgwatch/market';
import { parseFrenchDate } from '@tcgwatch/shared';
import type { WorkerContext } from '../context';

/** Séries non importées : TCG Pocket n'est pas un jeu de cartes physique. */
const IGNORED_SERIES = new Set(['tcgp']);
/** Extensions relues chaque jour (récentes ou à venir) ; les autres seulement le lundi. */
const RECENT_DAYS = 365;

export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
}

/** Séries à importer : TCGDEX_SERIES (liste d'ids) ou toutes (`*` ou vide). */
export function wantedSeries(setting: string): ((id: string) => boolean) | null {
  const ids = setting
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0 || ids.includes('*')) return null;
  return (id) => ids.includes(id);
}

/**
 * Import quotidien des séries et extensions FR depuis TCGdex : toutes les générations
 * (Wizards, EX… jusqu'à Méga-Évolution), promos et kits compris. Les extensions anciennes
 * ne sont relues que le lundi. Les releases validées à la main ne sont jamais écrasées
 * (seuls l'image, la série et les nombres de cartes manquants sont complétés).
 */
export async function importTcgdex(
  ctx: WorkerContext,
  client = new TcgdexClient(),
): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, updated: 0, skipped: 0 };
  const wanted = wantedSeries(ctx.env.TCGDEX_SERIES);
  const weekly = new Date().getUTCDay() === 1;
  const recent = new Date(Date.now() - RECENT_DAYS * 86_400_000);

  const all = await client.listSeries();
  for (const [order, brief] of all.entries()) {
    if (IGNORED_SERIES.has(brief.id) || (wanted && !wanted(brief.id))) continue;
    const serie = await client.getSerie(brief.id);
    await prisma.serie.upsert({
      where: { id: serie.id },
      update: { name: serie.name, logoUrl: tcgdexAsset(brief.logo, '.png') ?? null, order },
      create: {
        id: serie.id,
        name: serie.name,
        logoUrl: tcgdexAsset(brief.logo, '.png') ?? null,
        order,
      },
    });

    for (const setBrief of serie.sets) {
      const existing = await prisma.release.findUnique({ where: { tcgdexId: setBrief.id } });
      const stale =
        !existing ||
        existing.cardCountTotal === null ||
        !existing.releaseDate ||
        existing.releaseDate >= recent;
      if (!stale && !weekly) {
        summary.skipped++;
        continue;
      }
      const set = await client.getSet(setBrief.id);
      await new Promise((r) => setTimeout(r, 200));

      const releaseDate = set.releaseDate ? parseFrenchDate(set.releaseDate) : null;
      const imageUrl = tcgdexAsset(set.logo ?? setBrief.logo, '.png') ?? null;
      const details = {
        serieId: serie.id,
        symbolUrl: tcgdexAsset(set.symbol, '.png') ?? null,
        cardCountOfficial: set.cardCount?.official ?? null,
        cardCountTotal: set.cardCount?.total ?? null,
      };

      if (!existing) {
        await prisma.release.create({
          data: {
            tcgdexId: set.id,
            nameFr: set.name,
            setCode: setCodeFromId(set.id),
            serie: set.serie?.name ?? serie.name,
            releaseDate,
            imageUrl,
            source: 'TCGDEX',
            sourceUrl: `https://api.tcgdex.net/v2/fr/sets/${set.id}`,
            status: 'AUTO',
            ...details,
          },
        });
        summary.created++;
      } else if (existing.status === 'AUTO') {
        await prisma.release.update({
          where: { id: existing.id },
          data: {
            nameFr: set.name,
            serie: set.serie?.name ?? serie.name,
            imageUrl: imageUrl ?? existing.imageUrl,
            // Une date venue d'un revendeur (plus précise) n'est pas écrasée par TCGdex.
            releaseDate:
              existing.source === 'RETAILER'
                ? existing.releaseDate
                : (releaseDate ?? existing.releaseDate),
            source: existing.source === 'RETAILER' ? 'RETAILER' : 'TCGDEX',
            ...details,
          },
        });
        summary.updated++;
      } else {
        await prisma.release.update({
          where: { id: existing.id },
          data: { imageUrl: existing.imageUrl ?? imageUrl, ...details },
        });
        summary.skipped++;
      }
    }
  }

  ctx.status.lastTcgdexImport = new Date();
  ctx.logger.info(summary, 'Import TCGdex terminé');
  return summary;
}
