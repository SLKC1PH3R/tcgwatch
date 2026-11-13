'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { AdapterError, detectRetailer } from '@tcgwatch/adapters';
import { prisma, recordDaily, ProductType } from '@tcgwatch/db';
import { AVAILABILITIES, guessProductType, normalizeEan } from '@tcgwatch/shared';
import { requireUser } from '@/lib/auth';
import { getWebFetcher } from '@/lib/fetcher';
import {
  firstIssue,
  formToObject,
  optionalDate,
  optionalPrice,
  optionalText,
  slugify,
} from '@/lib/form';

// ─── Test d'une URL ──────────────────────────────────────

export interface TestedListing {
  title?: string;
  price: number | null;
  currency: string;
  availability: (typeof AVAILABILITIES)[number];
  releaseDate?: string;
  imageUrl?: string;
  images?: string[];
  description?: string;
  brand?: string;
  sku?: string;
  category?: string;
  ean?: string;
  stockAlertUrl?: string;
}

export interface TestUrlState {
  url?: string;
  error?: string;
  warning?: string;
  retailer?: {
    domain: string;
    name: string;
    adapterKey: string;
    adapterName: string;
    needsBrowser: boolean;
    known: boolean;
  };
  result?: TestedListing;
  suggestion?: { name: string; type: string; existingProductId?: string };
}

export async function testUrlAction(
  _prev: TestUrlState,
  formData: FormData,
): Promise<TestUrlState> {
  await requireUser();
  const raw = String(formData.get('url') ?? '').trim();
  const parsedUrl = z.string().url().safeParse(raw);
  if (!parsedUrl.success || !/^https?:\/\//.test(raw)) return { url: raw, error: 'URL invalide.' };
  const url = raw;

  let detected;
  try {
    detected = detectRetailer(url);
  } catch (err) {
    return { url, error: err instanceof Error ? err.message : String(err) };
  }

  const existing = await prisma.listing.findUnique({ where: { url }, select: { productId: true } });
  if (existing) {
    return {
      url,
      error: 'Cette URL est déjà suivie.',
      suggestion: { name: '', type: '', existingProductId: existing.productId },
    };
  }

  const known = await prisma.retailer.findUnique({ where: { domain: detected.domain } });
  const retailer = {
    domain: detected.domain,
    name: known?.name ?? detected.suggestedName,
    adapterKey: known?.adapterKey ?? detected.adapter.key,
    adapterName: detected.adapter.name,
    needsBrowser: Boolean(detected.adapter.needsBrowser),
    known: Boolean(known),
  };

  try {
    const r = await detected.adapter.fetchListing(url, getWebFetcher());
    const result: TestedListing = {
      title: r.title,
      price: r.price,
      currency: r.currency,
      availability: r.availability,
      releaseDate: r.releaseDate?.toISOString().slice(0, 10),
      imageUrl: r.imageUrl,
      images: r.images,
      description: r.description,
      brand: r.brand,
      sku: r.sku,
      category: r.category,
      ean: r.ean,
      stockAlertUrl: r.stockAlertUrl,
    };
    const byEan = r.ean
      ? await prisma.product.findUnique({ where: { ean: r.ean }, select: { id: true } })
      : null;
    return {
      url,
      retailer,
      result,
      warning:
        r.availability === 'UNKNOWN' && r.price === null
          ? 'Aucune donnée produit détectée : vérifiez que l’URL est bien une fiche produit.'
          : undefined,
      suggestion: {
        name: r.title ?? '',
        type: r.title ? guessProductType(r.title) : 'AUTRE',
        existingProductId: byEan?.id,
      },
    };
  } catch (err) {
    const blocked =
      err instanceof AdapterError && (err.code === 'BLOCKED' || err.code === 'TIMEOUT');
    return {
      url,
      retailer,
      warning: blocked
        ? `${err.message}. Le test immédiat n’a pas abouti ; le worker réessaiera${retailer.needsBrowser ? ' via Chromium' : ''}.`
        : undefined,
      error: blocked ? undefined : err instanceof Error ? err.message : String(err),
      suggestion: { name: '', type: 'AUTRE' },
    };
  }
}

// ─── Ajout du suivi ──────────────────────────────────────

const testedSchema = z.object({
  title: z.string().optional(),
  price: z.number().nullable(),
  currency: z.string().default('EUR'),
  availability: z.enum(AVAILABILITIES),
  releaseDate: z.string().optional(),
  imageUrl: z.string().url().optional(),
  images: z.array(z.string().url()).max(12).optional(),
  description: z.string().max(2000).optional(),
  brand: z.string().max(120).optional(),
  sku: z.string().max(120).optional(),
  category: z.string().max(200).optional(),
  ean: z.string().optional(),
  stockAlertUrl: z.string().url().optional(),
});

const addSchema = z.object({
  url: z.string().url(),
  productId: z.string().min(1, 'Choisissez un produit ou créez-en un'),
  newName: optionalText,
  newType: z.enum(ProductType).optional(),
  releaseId: optionalText,
  targetPrice: optionalPrice,
  checkIntervalMin: z.coerce.number().int().min(5, 'Intervalle minimal : 5 min').max(1440),
  tested: optionalText,
});

export interface AddListingState {
  error?: string;
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || 'produit';
  const taken = await prisma.product.findUnique({ where: { slug: base } });
  return taken ? `${base}-${randomBytes(3).toString('hex')}` : base;
}

export async function addListingAction(
  _prev: AddListingState,
  formData: FormData,
): Promise<AddListingState> {
  await requireUser();
  const parsed = addSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const input = parsed.data;

  let detected;
  try {
    detected = detectRetailer(input.url);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  if (await prisma.listing.findUnique({ where: { url: input.url } })) {
    return { error: 'Cette URL est déjà suivie.' };
  }

  let tested: z.infer<typeof testedSchema> | undefined;
  if (input.tested) {
    try {
      const t = testedSchema.safeParse(JSON.parse(input.tested));
      if (t.success) tested = t.data;
    } catch {
      /* résultat de test illisible : le worker fera le premier relevé */
    }
  }

  // Produit : existant ou nouveau
  let productId = input.productId;
  if (productId === '__new') {
    if (!input.newName) return { error: 'Nom du nouveau produit requis.' };
    const eanFree = tested?.ean
      ? !(await prisma.product.findUnique({ where: { ean: tested.ean } }))
      : false;
    const product = await prisma.product.create({
      data: {
        name: input.newName,
        slug: await uniqueSlug(input.newName),
        type: input.newType ?? 'AUTRE',
        releaseId: input.releaseId ?? null,
        imageUrl: tested?.imageUrl,
        images: tested?.images ?? (tested?.imageUrl ? [tested.imageUrl] : []),
        description: tested?.description,
        brand: tested?.brand,
        ean: eanFree ? tested?.ean : undefined,
      },
    });
    productId = product.id;
  } else {
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) return { error: 'Produit introuvable.' };
    // Complète un produit existant sans écraser ce qui est déjà renseigné.
    if (tested) {
      const images = [
        ...new Set([
          ...existing.images,
          ...(tested.images ?? []),
          ...(tested.imageUrl ? [tested.imageUrl] : []),
        ]),
      ].slice(0, 12);
      await prisma.product.update({
        where: { id: productId },
        data: {
          imageUrl: existing.imageUrl ?? tested.imageUrl,
          images,
          description: existing.description ?? tested.description,
          brand: existing.brand ?? tested.brand,
        },
      });
    }
  }

  // Revendeur : existant ou créé à la volée
  const retailer = await prisma.retailer.upsert({
    where: { domain: detected.domain },
    update: {},
    create: {
      domain: detected.domain,
      name: detected.suggestedName,
      slug: `${slugify(detected.domain)}`,
      adapterKey: detected.adapter.key,
    },
  });

  const now = new Date();
  const listing = await prisma.listing.create({
    data: {
      productId,
      retailerId: retailer.id,
      url: input.url,
      targetPrice: input.targetPrice,
      checkIntervalMin: input.checkIntervalMin,
      // Le test immédiat compte comme premier relevé ; le worker reprendra à l'intervalle prévu.
      ...(tested
        ? {
            lastCheckedAt: now,
            nextCheckAt: new Date(now.getTime() + input.checkIntervalMin * 60_000),
            lastTitle: tested.title,
            lastImageUrl: tested.imageUrl,
            sku: tested.sku,
            category: tested.category,
            lastPrice: tested.price,
            lastCurrency: tested.currency,
            lastAvailability: tested.availability,
            lastInStockAt: tested.availability === 'IN_STOCK' ? now : null,
            stockAlertUrl: tested.stockAlertUrl,
          }
        : { nextCheckAt: now }),
    },
  });
  if (tested) {
    await recordDaily({
      listingId: listing.id,
      price: tested.price ?? null,
      availability: tested.availability,
      at: now,
    });
    await prisma.snapshot.create({
      data: {
        listingId: listing.id,
        price: tested.price,
        currency: tested.currency,
        availability: tested.availability,
        releaseDate: tested.releaseDate ? new Date(`${tested.releaseDate}T00:00:00Z`) : null,
      },
    });
    // Date « Sortie prévue le » : renseigne le produit s'il n'a pas de date saisie à la main.
    if (tested.releaseDate) {
      // (en SQL, NULL <> 'MANUAL' est faux : d'où le OR explicite)
      await prisma.product.updateMany({
        where: {
          id: productId,
          OR: [{ releaseDateSource: null }, { releaseDateSource: { not: 'MANUAL' } }],
        },
        data: {
          releaseDate: new Date(`${tested.releaseDate}T00:00:00Z`),
          releaseDateSource: 'RETAILER',
        },
      });
    }
  }

  revalidatePath('/produits');
  redirect(`/produits/${productId}`);
}

// ─── Produit ─────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(200),
  type: z.enum(ProductType),
  releaseId: optionalText,
  ean: optionalText.transform((v, ctx) => {
    if (v === undefined) return undefined;
    const ean = normalizeEan(v);
    if (!ean) {
      ctx.addIssue({ code: 'custom', message: 'EAN invalide (8 à 14 chiffres).' });
      return z.NEVER;
    }
    return ean;
  }),
  imageUrl: optionalText.pipe(z.string().url('URL d’image invalide').optional()),
  brand: optionalText.pipe(z.string().max(120).optional()),
  description: optionalText.pipe(z.string().max(2000, 'Description trop longue').optional()),
  msrp: optionalPrice,
  targetPrice: optionalPrice,
  releaseDate: optionalDate,
  notes: optionalText,
});

export interface SimpleState {
  error?: string;
  success?: string;
}

export async function createProductAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireUser();
  const parsed = productSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const d = parsed.data;
  const product = await prisma.product.create({
    data: {
      ...d,
      slug: await uniqueSlug(d.name),
      releaseId: d.releaseId ?? null,
      releaseDateSource: d.releaseDate ? 'MANUAL' : null,
    },
  });
  redirect(`/produits/${product.id}`);
}

export async function updateProductAction(
  id: string,
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireUser();
  const parsed = productSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const d = parsed.data;
  const current = await prisma.product.findUnique({ where: { id } });
  if (!current) return { error: 'Produit introuvable.' };
  if (
    d.ean &&
    d.ean !== current.ean &&
    (await prisma.product.findUnique({ where: { ean: d.ean } }))
  ) {
    return { error: 'Cet EAN est déjà associé à un autre produit.' };
  }
  const dateChanged =
    (d.releaseDate?.getTime() ?? null) !== (current.releaseDate?.getTime() ?? null);
  await prisma.product.update({
    where: { id },
    data: {
      ...d,
      releaseId: d.releaseId ?? null,
      ean: d.ean ?? null,
      imageUrl: d.imageUrl ?? null,
      brand: d.brand ?? null,
      description: d.description ?? null,
      notes: d.notes ?? null,
      // Une date saisie à la main n'est plus écrasée par les revendeurs.
      releaseDateSource: dateChanged
        ? d.releaseDate
          ? 'MANUAL'
          : null
        : current.releaseDateSource,
    },
  });
  revalidatePath(`/produits/${id}`);
  return { success: 'Produit enregistré.' };
}

export async function deleteProductAction(id: string) {
  await requireUser();
  const owned = await prisma.collectionItem.count({ where: { productId: id } });
  if (owned > 0) {
    redirect(
      `/produits/${id}?erreur=${encodeURIComponent('Ce produit figure dans votre collection : supprimez d’abord ces lignes.')}`,
    );
  }
  await prisma.product.delete({ where: { id } });
  revalidatePath('/produits');
  redirect('/produits');
}

// ─── Listings ────────────────────────────────────────────

const listingSchema = z.object({
  targetPrice: optionalPrice,
  checkIntervalMin: z.coerce.number().int().min(5).max(1440),
  stockAlertUrl: optionalText.pipe(z.string().url('URL d’alerte invalide').optional()),
});

export async function updateListingAction(
  id: string,
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireUser();
  const parsed = listingSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const listing = await prisma.listing.update({
    where: { id },
    data: { ...parsed.data, stockAlertUrl: parsed.data.stockAlertUrl ?? null },
  });
  revalidatePath(`/produits/${listing.productId}`);
  return { success: 'Enregistré.' };
}

export async function toggleListingAction(id: string) {
  await requireUser();
  const listing = await prisma.listing.findUniqueOrThrow({ where: { id } });
  const resume = listing.state !== 'ACTIVE';
  await prisma.listing.update({
    where: { id },
    data: resume
      ? { state: 'ACTIVE', consecutiveErrors: 0, lastError: null, nextCheckAt: new Date() }
      : { state: 'PAUSED' },
  });
  revalidatePath(`/produits/${listing.productId}`);
  revalidatePath('/produits');
}

/** Demande au worker de relever le listing au prochain tick (≤ 1 min). */
export async function checkNowAction(id: string) {
  await requireUser();
  const listing = await prisma.listing.update({
    where: { id },
    data: { nextCheckAt: new Date(), state: 'ACTIVE' },
  });
  revalidatePath(`/produits/${listing.productId}`);
}

export async function deleteListingAction(id: string) {
  await requireUser();
  const listing = await prisma.listing.delete({ where: { id } });
  revalidatePath(`/produits/${listing.productId}`);
  revalidatePath('/produits');
}

// ─── Alertes ─────────────────────────────────────────────

export async function acknowledgeAlertAction(id: string) {
  await requireUser();
  await prisma.alertEvent.update({ where: { id }, data: { acknowledged: true } });
  revalidatePath('/');
}

export async function acknowledgeAllAlertsAction() {
  await requireUser();
  await prisma.alertEvent.updateMany({
    where: { acknowledged: false },
    data: { acknowledged: true },
  });
  revalidatePath('/');
}

// ─── Historique : exclure / rétablir un point ────────────

/**
 * Exclut (true) ou rétablit (false) le résumé du jour d'une fiche dans l'historique ; null
 * revient au choix automatique (prix aberrant mis de côté ou non).
 */
export async function setDailyExclusionAction(
  listingId: string,
  day: string,
  excluded: boolean | null,
) {
  await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { productId: true },
  });
  if (!listing) return;
  await prisma.listingDaily.updateMany({
    where: { listingId, date: new Date(`${day}T00:00:00Z`) },
    data: { excluded },
  });
  revalidatePath(`/produits/${listing.productId}`);
  revalidatePath('/produits');
}

const targetSchema = z.object({ targetPrice: optionalPrice });

/** Prix cible du produit, modifié directement depuis l'en-tête de la fiche (vide = aucun). */
export async function setProductTargetAction(productId: string, formData: FormData) {
  await requireUser();
  const parsed = targetSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    redirect(`/produits/${productId}?erreur=${encodeURIComponent(firstIssue(parsed.error))}`);
  }
  await prisma.product.update({
    where: { id: productId },
    data: { targetPrice: parsed.data.targetPrice },
  });
  revalidatePath(`/produits/${productId}`);
}
