import { prisma, type ProductType } from '@tcgwatch/db';
import {
  matchProduct,
  parsePokecardexCalendar,
  parsePokecardexForumCalendar,
  POKECARDEX_CALENDAR_URL,
  POKECARDEX_FORUM_TOPICS,
  pokecardexForumUrl,
  randomIllustrationBoosters,
  type PokecardexRelease,
} from '@tcgwatch/market';
import { normalizeEan } from '@tcgwatch/shared';
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
  /** Produits ajoutés à la main fusionnés dans leur fiche du catalogue. */
  duplicatesMerged: number;
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
    failed: 0,
    productsCreated: 0,
    productsUpdated: 0,
    examplesRemoved: 0,
    duplicatesMerged: 0,
  };
  const past = await forumReleases(ctx, summary);
  const all = [...past, ...releases];
  const releaseIds = new Map<string, string>();
  for (const r of all) {
    const releaseId = await upsertRelease(r, summary);
    releaseIds.set(r.externalId, releaseId);
    await upsertProduct(r, releaseId, summary);
  }
  // Booster sans choix d'illustration : rattaché à la sortie du premier booster illustré,
  // sans entrée supplémentaire au calendrier.
  for (const r of randomIllustrationBoosters(all)) {
    const variantId = `pokecardex:${r.externalId.split(':').pop()}`;
    const releaseId =
      releaseIds.get(variantId) ??
      [...releaseIds.entries()].find(([id]) =>
        id.endsWith(`:${r.externalId.split(':').pop()}`),
      )?.[1];
    if (releaseId) await upsertProduct(r, releaseId, summary);
  }
  summary.duplicatesMerged = await mergeManualDuplicates(ctx);
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

/**
 * Produits ajoutés à la main (« Suivre une URL », anciens exemples) qui existent aussi dans le
 * catalogue Pokécardex : même EAN, ou même produit selon le rapprochement des intitulés.
 * Fiches revendeurs, collection, alertes et prix marché passent sur la fiche du catalogue,
 * puis le doublon est supprimé. Sans correspondance sûre, le produit est laissé tel quel.
 */
async function mergeManualDuplicates(ctx: Pick<WorkerContext, 'logger'>): Promise<number> {
  const manual = await prisma.product.findMany({ where: { externalId: null } });
  if (manual.length === 0) return 0;
  const catalog = await prisma.product.findMany({
    where: { externalId: { not: null } },
    select: { id: true, name: true, type: true, ean: true, images: true },
  });
  let merged = 0;
  for (const dup of manual) {
    const ean = normalizeEan(dup.ean);
    const byEan = ean ? catalog.filter((p) => normalizeEan(p.ean) === ean) : [];
    const match =
      byEan.length === 1 ? { productId: byEan[0]!.id } : matchProduct(dup.name, catalog);
    const target = match && catalog.find((p) => p.id === match.productId);
    if (!target || target.type !== dup.type) continue;
    try {
      await prisma.$transaction(async (tx) => {
        // Prix marché : un relevé par jour et par source, celui du catalogue est gardé.
        const kept = await tx.marketPrice.findMany({
          where: { productId: target.id },
          select: { source: true, date: true },
        });
        for (const k of kept) {
          await tx.marketPrice.deleteMany({
            where: { productId: dup.id, source: k.source, date: k.date },
          });
        }
        await tx.marketPrice.updateMany({
          where: { productId: dup.id },
          data: { productId: target.id },
        });
        await tx.listing.updateMany({
          where: { productId: dup.id },
          data: { productId: target.id },
        });
        await tx.collectionItem.updateMany({
          where: { productId: dup.id },
          data: { productId: target.id },
        });
        await tx.alertEvent.updateMany({
          where: { productId: dup.id },
          data: { productId: target.id },
        });
        // Suivis du doublon reportés sur le produit gardé (sans écraser un suivi existant).
        for (const f of await tx.productFollow.findMany({ where: { productId: dup.id } })) {
          await tx.productFollow.upsert({
            where: { userId_productId: { userId: f.userId, productId: target.id } },
            create: {
              userId: f.userId,
              productId: target.id,
              targetPrice: f.targetPrice,
              mutedAlerts: f.mutedAlerts,
            },
            update: {},
          });
        }
        // Le doublon d’abord : l’EAN est unique.
        await tx.product.delete({ where: { id: dup.id } });
        await tx.product.update({
          where: { id: target.id },
          data: {
            ean: target.ean ?? dup.ean,
            images: [...new Set([...target.images, ...dup.images])].slice(0, 12),
            targetPrice: dup.targetPrice ?? undefined,
            notes: dup.notes ?? undefined,
          },
        });
      });
    } catch (err) {
      ctx.logger.warn({ err, product: dup.name }, 'Fusion du doublon impossible');
      continue;
    }
    ctx.logger.info({ from: dup.name, to: target.name }, 'Doublon fusionné dans le catalogue');
    merged++;
  }
  return merged;
}
