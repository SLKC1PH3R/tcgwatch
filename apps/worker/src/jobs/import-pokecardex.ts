import { prisma, type ProductType } from '@tcgwatch/db';
import {
  parsePokecardexCalendar,
  parsePokecardexForumCalendar,
  POKECARDEX_CALENDAR_URL,
  POKECARDEX_FORUM_TOPICS,
  pokecardexForumUrl,
  type PokecardexRelease,
} from '@tcgwatch/market';
import type { WorkerContext } from '../context';
import type { ImportSummary } from './import-tcgdex';

/** Produits d'exemple des premières versions du seed, remplacés par le catalogue réel. */
export const SEED_EXAMPLE_SLUGS = [
  'etb-regne-delta-me06',
  'display-regne-delta-me06',
  'tripack-regne-delta-me06',
  'upc-30e-anniversaire',
  'collection-autocollant-30-ans-lucario',
];

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export interface PokecardexImportSummary extends ImportSummary {
  /** Années passées relues depuis les sujets du forum. */
  forumYears: number[];
  productsCreated: number;
  productsUpdated: number;
  examplesRemoved: number;
}

/**
 * Import quotidien du calendrier des sorties FR de Pokécardex (produits scellés :
 * displays, ETB, coffrets, tripacks…), en complément des extensions venues de TCGdex.
 *
 * Chaque sortie alimente :
 * - le calendrier (Release) : une sortie validée à la main n'est jamais modifiée ;
 * - le catalogue produits (Product), suivi ensuite chez les revendeurs : nom, type, image,
 *   prix conseillé et date ne sont mis à jour que s'ils n'ont pas été saisis à la main.
 * Une sortie disparue du calendrier n'est pas supprimée.
 */
export async function importPokecardex(
  ctx: Pick<WorkerContext, 'fetcher' | 'logger' | 'status'>,
): Promise<PokecardexImportSummary> {
  const html = await ctx.fetcher.fetchHtml(POKECARDEX_CALENDAR_URL);
  const releases = parsePokecardexCalendar(html);
  if (releases.length === 0) {
    // Page modifiée ou indisponible : on ne touche à rien plutôt que d'effacer le calendrier.
    throw new Error('Calendrier Pokécardex vide ou illisible (structure de page modifiée ?)');
  }

  const summary: PokecardexImportSummary = {
    forumYears: [],
    created: 0,
    updated: 0,
    skipped: 0,
    productsCreated: 0,
    productsUpdated: 0,
    examplesRemoved: 0,
  };
  const past = await forumReleases(ctx, summary);
  for (const r of [...past, ...releases]) {
    const releaseId = await upsertRelease(r, summary);
    await upsertProduct(r, releaseId, summary);
  }
  summary.examplesRemoved = await removeSeedExamples();

  ctx.status.lastPokecardexImport = new Date();
  ctx.logger.info({ ...summary, total: releases.length }, 'Import Pokécardex terminé');
  return summary;
}

/**
 * Sorties des années passées (sujets annuels du forum) : prix conseillés d'époque.
 * Ces sujets ne bougent presque plus : relus le lundi, ou si une année manque encore.
 */
async function forumReleases(
  ctx: Pick<WorkerContext, 'fetcher' | 'logger'>,
  summary: PokecardexImportSummary,
): Promise<PokecardexRelease[]> {
  const out: PokecardexRelease[] = [];
  const weekly = new Date().getUTCDay() === 1;
  for (const [year, topic] of Object.entries(POKECARDEX_FORUM_TOPICS)) {
    const known = await prisma.product.count({
      where: { externalId: { startsWith: `pokecardex-forum:${year}:` } },
    });
    if (known > 0 && !weekly) continue;
    try {
      const url = pokecardexForumUrl(topic);
      const parsed = parsePokecardexForumCalendar(
        await ctx.fetcher.fetchHtml(url),
        Number(year),
        url,
      );
      if (parsed.length === 0) throw new Error('aucun produit lu (format du sujet modifié ?)');
      out.push(...parsed);
      summary.forumYears.push(Number(year));
    } catch (err) {
      ctx.logger.warn({ err, year }, 'Sujet du forum Pokécardex illisible : année ignorée');
    }
  }
  return out;
}

async function upsertRelease(r: PokecardexRelease, summary: ImportSummary): Promise<string> {
  const existing = await prisma.release.findUnique({ where: { externalId: r.externalId } });
  if (!existing) {
    const created = await prisma.release.create({
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
    return created.id;
  }
  if (existing.status === 'AUTO') {
    await prisma.release.update({
      where: { id: existing.id },
      data: {
        nameFr: r.name,
        releaseDate: r.releaseDate,
        productType: existing.productType ?? r.productType,
        imageUrl: r.imageUrl ?? existing.imageUrl,
        msrp: r.msrp ?? existing.msrp,
        source: 'POKECARDEX',
      },
    });
    summary.updated++;
  } else {
    if ((!existing.imageUrl && r.imageUrl) || (existing.msrp === null && r.msrp !== null)) {
      await prisma.release.update({
        where: { id: existing.id },
        data: { imageUrl: existing.imageUrl ?? r.imageUrl, msrp: existing.msrp ?? r.msrp },
      });
    }
    summary.skipped++;
  }
  return existing.id;
}

async function upsertProduct(
  r: PokecardexRelease,
  releaseId: string,
  summary: PokecardexImportSummary,
): Promise<void> {
  const existing = await prisma.product.findUnique({ where: { externalId: r.externalId } });
  if (!existing) {
    const id = r.externalId.split(':')[1] ?? '';
    await prisma.product.create({
      data: {
        externalId: r.externalId,
        name: r.name,
        slug: `${slugify(r.name) || 'produit'}-${id}`,
        type: r.productType as ProductType,
        imageUrl: r.imageUrl,
        images: r.imageUrl ? [r.imageUrl] : [],
        msrp: r.msrp,
        releaseDate: r.releaseDate,
        releaseDateSource: 'POKECARDEX',
        releaseId,
      },
    });
    summary.productsCreated++;
    return;
  }
  const dateIsManual = existing.releaseDateSource === 'MANUAL';
  await prisma.product.update({
    where: { id: existing.id },
    data: {
      msrp: existing.msrp ?? r.msrp,
      imageUrl: existing.imageUrl ?? r.imageUrl,
      images:
        r.imageUrl && !existing.images.includes(r.imageUrl)
          ? [...existing.images, r.imageUrl]
          : undefined,
      releaseDate: dateIsManual ? undefined : r.releaseDate,
      releaseDateSource: dateIsManual ? undefined : 'POKECARDEX',
      releaseId: existing.releaseId ?? releaseId,
    },
  });
  summary.productsUpdated++;
}

/**
 * Retire les produits d'exemple des anciennes versions du seed, s'ils ne sont pas dans la
 * collection (leurs fiches sont retrouvées par la découverte automatique), ainsi que les
 * sorties d'exemple sans date ni produit.
 */
async function removeSeedExamples(): Promise<number> {
  const { count } = await prisma.product.deleteMany({
    where: { slug: { in: SEED_EXAMPLE_SLUGS }, externalId: null, collection: { none: {} } },
  });
  await prisma.release.deleteMany({
    where: { source: 'SEED', releaseDate: null, products: { none: {} } },
  });
  return count;
}
