import { prisma } from '@tcgwatch/db';
import { parsePokecardexCalendar, POKECARDEX_CALENDAR_URL } from '@tcgwatch/market';
import type { WorkerContext } from '../context';
import type { ImportSummary } from './import-tcgdex';

/**
 * Import quotidien du calendrier des sorties FR de Pokécardex (produits scellés :
 * displays, ETB, coffrets, tripacks…), en complément des extensions venues de TCGdex.
 *
 * - Une sortie validée à la main n'est jamais modifiée (image et prix complétés s'ils manquent).
 * - Une sortie AUTO suit les mises à jour de Pokécardex (date décalée, nom précisé…).
 * - Une sortie disparue du calendrier n'est pas supprimée.
 */
export async function importPokecardex(
  ctx: Pick<WorkerContext, 'fetcher' | 'logger' | 'status'>,
): Promise<ImportSummary> {
  const html = await ctx.fetcher.fetchHtml(POKECARDEX_CALENDAR_URL);
  const releases = parsePokecardexCalendar(html);
  if (releases.length === 0) {
    // Page modifiée ou indisponible : on ne touche à rien plutôt que d'effacer le calendrier.
    throw new Error('Calendrier Pokécardex vide ou illisible (structure de page modifiée ?)');
  }

  const summary: ImportSummary = { created: 0, updated: 0, skipped: 0 };
  for (const r of releases) {
    const existing = await prisma.release.findUnique({ where: { externalId: r.externalId } });
    if (!existing) {
      await prisma.release.create({
        data: {
          externalId: r.externalId,
          nameFr: r.name,
          releaseDate: r.releaseDate,
          productType: r.productType,
          imageUrl: r.imageUrl,
          msrp: r.msrp,
          source: 'POKECARDEX',
          sourceUrl: r.sourceUrl,
          status: 'AUTO',
        },
      });
      summary.created++;
    } else if (existing.status === 'AUTO') {
      await prisma.release.update({
        where: { id: existing.id },
        data: {
          nameFr: r.name,
          releaseDate: r.releaseDate,
          productType: existing.productType ?? r.productType,
          imageUrl: r.imageUrl ?? existing.imageUrl,
          msrp: r.msrp ?? existing.msrp,
        },
      });
      summary.updated++;
    } else {
      if ((!existing.imageUrl && r.imageUrl) || (existing.msrp === null && r.msrp !== null)) {
        await prisma.release.update({
          where: { id: existing.id },
          data: {
            imageUrl: existing.imageUrl ?? r.imageUrl,
            msrp: existing.msrp ?? r.msrp,
          },
        });
      }
      summary.skipped++;
    }
  }

  ctx.status.lastPokecardexImport = new Date();
  ctx.logger.info({ ...summary, total: releases.length }, 'Import Pokécardex terminé');
  return summary;
}
