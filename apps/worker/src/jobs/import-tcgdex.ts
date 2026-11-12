import { prisma } from '@tcgwatch/db';
import { setCodeFromId, tcgdexAsset, TcgdexClient } from '@tcgwatch/market';
import { parseFrenchDate } from '@tcgwatch/shared';
import type { WorkerContext } from '../context';

/** Sets ignorés : promos et énergies ne sont pas des sorties de produits scellés. */
const IGNORED_SET = /promo|[ée]nergie/i;

export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
}

/**
 * Import quotidien des extensions FR depuis TCGdex (séries configurées dans TCGDEX_SERIES).
 * Les releases validées à la main ne sont jamais écrasées (seule l'image manquante est complétée).
 */
export async function importTcgdex(
  ctx: WorkerContext,
  client = new TcgdexClient(),
): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, updated: 0, skipped: 0 };
  const series = ctx.env.TCGDEX_SERIES.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const serieId of series) {
    const serie = await client.getSerie(serieId);
    for (const brief of serie.sets) {
      if (IGNORED_SET.test(brief.name)) {
        summary.skipped++;
        continue;
      }
      const set = await client.getSet(brief.id);
      await new Promise((r) => setTimeout(r, 200));

      const releaseDate = set.releaseDate ? parseFrenchDate(set.releaseDate) : null;
      const imageUrl = tcgdexAsset(set.logo ?? brief.logo, '.png');
      const existing = await prisma.release.findUnique({ where: { tcgdexId: set.id } });

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
          },
        });
        summary.updated++;
      } else {
        if (!existing.imageUrl && imageUrl) {
          await prisma.release.update({ where: { id: existing.id }, data: { imageUrl } });
        }
        summary.skipped++;
      }
    }
  }

  ctx.status.lastTcgdexImport = new Date();
  ctx.logger.info(summary, 'Import TCGdex terminé');
  return summary;
}
