import {
  AdapterError,
  detectSealCut,
  getAdapterByKey,
  type FetchContext,
  type ListingResult,
} from '@tcgwatch/adapters';
import {
  isSuspectPrice,
  prisma,
  recordDaily,
  referencePrice,
  shouldKeepSnapshot,
  type Prisma,
} from '@tcgwatch/db';
import { AVAILABILITY_LABELS, formatPrice, toNumber, type Availability } from '@tcgwatch/shared';
import { detectAlerts, effectiveTarget, type DetectedAlert } from '../alerts';
import type { WorkerContext } from '../context';
import { enrichReleaseDate } from '../enrich';
import { productDetailsPatch } from '../product-details';
import { ERROR_STATE_THRESHOLD, nextCheckAfterError, nextCheckAfterSuccess } from '../scheduling';
import { checkNewLow } from './price-alerts';
import { dispatchAlert } from './dispatch';

const BATCH_SIZE = 25;
const inProgress = new Set<string>();

const listingInclude = {
  retailer: true,
  product: { include: { release: true } },
} satisfies Prisma.ListingInclude;

export type ListingWithRelations = Prisma.ListingGetPayload<{ include: typeof listingInclude }>;

/** Tick : relève tous les listings arrivés à échéance (en parallèle, sérialisés par domaine). */
export async function checkDueListings(ctx: WorkerContext): Promise<number> {
  const due = await prisma.listing.findMany({
    where: {
      state: { in: ['ACTIVE', 'ERROR'] },
      nextCheckAt: { lte: new Date() },
      retailer: { enabled: true },
      id: { notIn: [...inProgress] },
    },
    include: listingInclude,
    orderBy: { nextCheckAt: 'asc' },
    take: BATCH_SIZE,
  });
  ctx.status.lastListingsTick = new Date();
  if (due.length === 0) return 0;

  ctx.logger.info({ count: due.length }, 'Relevé des listings à échéance');
  await Promise.allSettled(due.map((l) => checkListing(ctx, l)));
  return due.length;
}

export async function checkListing(ctx: WorkerContext, listing: ListingWithRelations) {
  if (inProgress.has(listing.id)) return;
  inProgress.add(listing.id);
  const log = ctx.logger.child({ listingId: listing.id, retailer: listing.retailer.slug });
  try {
    const adapter = getAdapterByKey(listing.retailer.adapterKey);
    // Sites qui refusent les requêtes HTTP simples : Chromium d'emblée, sans requête refusée avant.
    const browserFirst = listing.retailer.access === 'BROWSER';
    // Page de la fiche gardée pour les avertissements (film incisé…), quel que soit l'adaptateur.
    let pageHtml: string | undefined;
    const scoped: FetchContext = {
      fetchHtml: async (url, options) => {
        const html = await ctx.fetcher.fetchHtml(url, {
          ...options,
          browser: options?.browser || browserFirst,
          minDelayMs: listing.retailer.minDelayMs,
        });
        if (url === listing.url && pageHtml === undefined) pageHtml = html;
        return html;
      },
    };
    let result: ListingResult;
    try {
      result = await adapter.fetchListing(listing.url, scoped);
      if (result.sealCut === undefined && pageHtml) result.sealCut = detectSealCut(pageHtml);
    } catch (err) {
      await recordFailure(ctx, listing, err);
      return;
    }
    await recordSuccess(ctx, listing, result);
    log.info(
      { price: result.price, availability: result.availability, releaseDate: result.releaseDate },
      'Listing relevé',
    );
  } catch (err) {
    log.error({ err }, 'Erreur inattendue pendant le relevé');
  } finally {
    inProgress.delete(listing.id);
  }
}

async function recordSuccess(
  ctx: WorkerContext,
  listing: ListingWithRelations,
  result: ListingResult,
) {
  const now = new Date();
  const prev = {
    availability: listing.lastAvailability as Availability,
    price: toNumber(listing.lastPrice),
  };
  const next = { availability: result.availability, price: result.price };
  const target = effectiveTarget(
    toNumber(listing.targetPrice),
    toNumber(listing.product.targetPrice),
  );
  const isFirstCheck = listing.lastCheckedAt === null;
  const alerts = detectAlerts(listing.id, prev, next, target, isFirstCheck);

  // Historique : relevé détaillé seulement si le prix ou le stock change (et une fois par
  // jour pour confirmer), résumé du jour mis à jour à chaque passage. Un prix aberrant
  // (moitié de la médiane 30 j ou du prix conseillé) est mis de côté dans le résumé.
  const price = result.price ?? null;
  const suspect =
    price !== null &&
    isSuspectPrice(
      price,
      await referencePrice(listing.productId, toNumber(listing.product.msrp), now),
    );
  if (suspect) log(ctx, listing).warn({ price }, 'Prix aberrant mis de côté dans l’historique');
  const observation = {
    listingId: listing.id,
    price,
    availability: result.availability,
    at: now,
    suspect,
  };
  const keepSnapshot = await shouldKeepSnapshot(
    { ...prev, lastCheckedAt: listing.lastCheckedAt },
    observation,
  );
  await recordDaily(observation);
  await prisma.$transaction([
    ...(keepSnapshot
      ? [
          prisma.snapshot.create({
            data: {
              listingId: listing.id,
              price: result.price,
              currency: result.currency,
              availability: result.availability,
              releaseDate: result.releaseDate,
            },
          }),
        ]
      : []),
    prisma.listing.update({
      where: { id: listing.id },
      data: {
        state: 'ACTIVE',
        lastCheckedAt: now,
        lastSuccessAt: now,
        nextCheckAt: nextCheckAfterSuccess(now, listing.checkIntervalMin),
        lastTitle: result.title ?? listing.lastTitle,
        lastImageUrl: result.imageUrl ?? listing.lastImageUrl,
        sku: result.sku ?? listing.sku,
        category: result.category ?? listing.category,
        lastPrice: result.price,
        lastCurrency: result.currency,
        lastAvailability: result.availability,
        lastInStockAt: result.availability === 'IN_STOCK' ? now : listing.lastInStockAt,
        consecutiveErrors: 0,
        lastError: null,
        stockAlertUrl: listing.stockAlertUrl ?? result.stockAlertUrl,
      },
    }),
  ]);

  // Complète la fiche produit (images, description, marque, EAN) sans écraser la saisie.
  const productPatch: Prisma.ProductUpdateInput = productDetailsPatch(listing.product, result);
  if (!listing.product.ean && result.ean) {
    const taken = await prisma.product.findUnique({ where: { ean: result.ean } });
    if (!taken) productPatch.ean = result.ean;
  }
  if (Object.keys(productPatch).length) {
    await prisma.product.update({ where: { id: listing.productId }, data: productPatch });
  }

  if (result.releaseDate) {
    const changed = await enrichReleaseDate(listing.product, result.releaseDate);
    if (changed) {
      await dispatchAlert(ctx, {
        type: 'RELEASE_DATE',
        dedupeKey: `RELEASE_DATE:${listing.productId}:${result.releaseDate.toISOString().slice(0, 10)}`,
        productId: listing.productId,
        listingId: listing.id,
        title: `📅 Date de sortie : ${listing.product.name}`,
        message: `${listing.retailer.name} annonce une sortie le ${result.releaseDate.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}.`,
        url: listing.url,
        priority: 'low',
        tags: ['calendar'],
      });
    }
  }

  for (const alert of alerts) {
    await dispatchAlert(ctx, buildAlert(listing, alert, result));
  }
  // Après le résumé du jour : le prix relevé bat-il tous les prix achetables connus ?
  // Le prix doit avoir été lu au même niveau au relevé précédent (confirmation).
  await checkNewLow(
    ctx,
    listing,
    { price, availability: result.availability, suspect },
    { ...prev, lastCheckedAt: listing.lastCheckedAt },
    now,
  );
}

const log = (ctx: WorkerContext, listing: ListingWithRelations) =>
  ctx.logger.child({ listingId: listing.id, retailer: listing.retailer.slug });

function buildAlert(listing: ListingWithRelations, alert: DetectedAlert, result: ListingResult) {
  const price =
    result.price !== null ? formatPrice(result.price, result.currency) : 'prix non affiché';
  const where = listing.retailer.name;
  const name = listing.product.name;
  const base = {
    type: alert.type,
    dedupeKey: alert.dedupeKey,
    productId: listing.productId,
    listingId: listing.id,
    url: listing.url,
    price: result.price,
  };
  // Avertissement de la boutique, en tête du message pour qu'il saute aux yeux.
  const warning = result.sealCut
    ? '⚠️ !!! Film plastique des boîtes incisé sur ce produit !!!\n'
    : '';
  switch (alert.type) {
    case 'BACK_IN_STOCK':
      return {
        ...base,
        title: `✅ Retour en stock : ${name}`,
        message: `${warning}${where} — ${price}`,
        priority: 'high' as const,
        tags: ['white_check_mark'],
      };
    case 'PREORDER_OPEN':
      return {
        ...base,
        title: `🆕 Précommande ouverte : ${name}`,
        message: `${warning}${where} — ${price}`,
        priority: 'high' as const,
        tags: ['new'],
      };
    case 'PRICE_TARGET':
      return {
        ...base,
        title: `💶 Prix cible atteint : ${name}`,
        message: `${warning}${where} — ${price} (${AVAILABILITY_LABELS[result.availability].toLowerCase()})`,
        priority: 'urgent' as const,
        tags: ['moneybag'],
      };
  }
}

async function recordFailure(ctx: WorkerContext, listing: ListingWithRelations, err: unknown) {
  const now = new Date();
  const message = err instanceof Error ? err.message : String(err);
  const log = ctx.logger.child({ listingId: listing.id, url: listing.url });

  if (err instanceof AdapterError && err.code === 'ROBOTS') {
    log.warn('Listing interdit par robots.txt : mis en pause');
    await prisma.listing.update({
      where: { id: listing.id },
      data: { state: 'BLOCKED_BY_ROBOTS', lastError: message, lastCheckedAt: now },
    });
    return;
  }

  const errors = listing.consecutiveErrors + 1;
  log.warn(
    { err: message, code: err instanceof AdapterError ? err.code : undefined, errors },
    'Échec du relevé',
  );
  await prisma.listing.update({
    where: { id: listing.id },
    data: {
      consecutiveErrors: errors,
      lastError: message.slice(0, 500),
      lastCheckedAt: now,
      state: errors >= ERROR_STATE_THRESHOLD ? 'ERROR' : listing.state,
      nextCheckAt: nextCheckAfterError(now, listing.checkIntervalMin, errors),
    },
  });
}
