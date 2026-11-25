'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@tcgwatch/db';
import { parseCollectionCsv } from '@tcgwatch/shared';
import { requireUser } from '@/lib/auth';
import { previewImport } from '@/lib/data/collection-import';
import {
  firstIssue,
  formToObject,
  optionalDate,
  optionalPrice,
  optionalText,
  requiredPrice,
} from '@/lib/form';

const BASE = '/collection/cartes';
const VARIANTS = ['normal', 'reverse', 'holo', 'firstEdition'] as const;

// ─── Ajout rapide / quantités ────────────────────────────

const quickSchema = z.object({
  variant: z.enum(VARIANTS),
  quantities: z.record(z.string(), z.number().int().min(0).max(999)),
});

/**
 * Ajout rapide : quantités d'une variante pour les cartes d'une extension (0 = retirée).
 * Seules les cartes de cette extension sont modifiées.
 */
export async function saveQuickAddAction(
  code: string,
  payload: { variant: string; quantities: Record<string, number> },
): Promise<{ saved: number; error?: string }> {
  const user = await requireUser();
  const parsed = quickSchema.safeParse(payload);
  if (!parsed.success) return { saved: 0, error: firstIssue(parsed.error) };
  const { variant, quantities } = parsed.data;
  const cards = await prisma.card.findMany({
    where: { id: { in: Object.keys(quantities) }, release: { tcgdexId: code } },
    select: { id: true },
  });
  await prisma.$transaction(
    cards.map(({ id }) =>
      quantities[id]! > 0
        ? prisma.ownedCard.upsert({
            where: { userId_cardId_variant: { userId: user.id, cardId: id, variant } },
            update: { quantity: quantities[id]! },
            create: { userId: user.id, cardId: id, variant, quantity: quantities[id]! },
          })
        : prisma.ownedCard.deleteMany({ where: { userId: user.id, cardId: id, variant } }),
    ),
  );
  revalidatePath(BASE, 'layout');
  return { saved: cards.length };
}

/** +1 / −1 sur une carte (fiche carte, classeurs). */
export async function adjustOwnedCardAction(cardId: string, delta: 1 | -1, variant = 'normal') {
  const user = await requireUser();
  if (!VARIANTS.includes(variant as never)) return;
  const current = await prisma.ownedCard.findUnique({
    where: { userId_cardId_variant: { userId: user.id, cardId, variant } },
  });
  const next = (current?.quantity ?? 0) + delta;
  if (next <= 0) {
    if (current) await prisma.ownedCard.delete({ where: { id: current.id } });
  } else if (current) {
    await prisma.ownedCard.update({ where: { id: current.id }, data: { quantity: next } });
  } else {
    await prisma.ownedCard.create({ data: { userId: user.id, cardId, variant, quantity: next } });
  }
  revalidatePath(BASE, 'layout');
  revalidatePath(`/cartes/${cardId}`);
}

const pileSchema = z
  .array(
    z.object({
      cardId: z.string().min(1).max(80),
      variant: z.enum(VARIANTS),
      quantity: z.number().int().min(1).max(99),
    }),
  )
  .min(1)
  .max(500);

/** Scanner en rafale : ajoute d'un coup les cartes de la pile (exemplaires en plus). */
export async function addOwnedCardsAction(
  items: { cardId: string; variant: string; quantity: number }[],
): Promise<{ saved: number; error?: string }> {
  const user = await requireUser();
  const parsed = pileSchema.safeParse(items);
  if (!parsed.success) return { saved: 0, error: firstIssue(parsed.error) };
  const known = new Set(
    (
      await prisma.card.findMany({
        where: { id: { in: parsed.data.map((i) => i.cardId) } },
        select: { id: true },
      })
    ).map((c) => c.id),
  );
  const rows = parsed.data.filter((i) => known.has(i.cardId));
  await prisma.$transaction(
    rows.map((i) =>
      prisma.ownedCard.upsert({
        where: {
          userId_cardId_variant: { userId: user.id, cardId: i.cardId, variant: i.variant },
        },
        update: { quantity: { increment: i.quantity } },
        create: { userId: user.id, cardId: i.cardId, variant: i.variant, quantity: i.quantity },
      }),
    ),
  );
  revalidatePath(BASE, 'layout');
  return { saved: rows.reduce((n, i) => n + i.quantity, 0) };
}

// ─── Classeurs ───────────────────────────────────────────

const binderSchema = z.object({
  name: optionalText,
  description: optionalText,
  release: optionalText,
});

export async function createBinderAction(formData: FormData) {
  const user = await requireUser();
  const parsed = binderSchema.safeParse(formToObject(formData));
  if (!parsed.success)
    redirect(`${BASE}/classeurs?erreur=${encodeURIComponent(firstIssue(parsed.error))}`);
  const { name, description, release: code } = parsed.data;
  const release = code
    ? await prisma.release.findUnique({
        where: { tcgdexId: code },
        select: { id: true, nameFr: true },
      })
    : null;
  if (code && !release)
    redirect(`${BASE}/classeurs?erreur=${encodeURIComponent('Extension inconnue')}`);
  if (!release && !name) {
    redirect(`${BASE}/classeurs?erreur=${encodeURIComponent('Donne un nom au classeur')}`);
  }
  const binder = await prisma.cardBinder.create({
    data: {
      userId: user.id,
      name: name ?? release!.nameFr,
      description: description ?? null,
      releaseId: release?.id ?? null,
    },
  });
  redirect(`${BASE}/classeurs/${binder.id}`);
}

export async function updateBinderAction(id: string, formData: FormData) {
  const user = await requireUser();
  const parsed = binderSchema.safeParse(formToObject(formData));
  if (!parsed.success || !parsed.data.name) return;
  await prisma.cardBinder.updateMany({
    where: { id, userId: user.id },
    data: { name: parsed.data.name, description: parsed.data.description ?? null },
  });
  revalidatePath(`${BASE}/classeurs/${id}`);
}

export async function deleteBinderAction(id: string) {
  const user = await requireUser();
  await prisma.cardBinder.deleteMany({ where: { id, userId: user.id } });
  redirect(`${BASE}/classeurs`);
}

export async function addBinderCardAction(binderId: string, cardId: string) {
  const user = await requireUser();
  if (!(await prisma.cardBinder.count({ where: { id: binderId, userId: user.id } }))) return;
  const last = await prisma.binderCard.aggregate({ where: { binderId }, _max: { position: true } });
  await prisma.binderCard.upsert({
    where: { binderId_cardId: { binderId, cardId } },
    update: {},
    create: { binderId, cardId, position: (last._max.position ?? -1) + 1 },
  });
  await prisma.cardBinder.update({ where: { id: binderId }, data: { updatedAt: new Date() } });
  revalidatePath(`${BASE}/classeurs/${binderId}`);
}

export async function removeBinderCardAction(binderId: string, cardId: string) {
  const user = await requireUser();
  await prisma.binderCard.deleteMany({ where: { binderId, cardId, binder: { userId: user.id } } });
  revalidatePath(`${BASE}/classeurs/${binderId}`);
}

// ─── Vitrines ────────────────────────────────────────────

const showcaseSchema = z.object({
  title: z.string().trim().min(1, 'Donne un titre à la vitrine').max(120),
  description: optionalText,
});

export async function createShowcaseAction(formData: FormData) {
  const user = await requireUser();
  const parsed = showcaseSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    redirect(`${BASE}/vitrines?erreur=${encodeURIComponent(firstIssue(parsed.error))}`);
  }
  const showcase = await prisma.showcase.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      slug: randomBytes(9).toString('base64url'),
      wanted: formData.get('wanted') === 'on',
    },
  });
  redirect(`${BASE}/vitrines/${showcase.id}`);
}

export async function updateShowcaseAction(id: string, formData: FormData) {
  const user = await requireUser();
  const data = formToObject(formData);
  const parsed = showcaseSchema.safeParse(data);
  if (!parsed.success) {
    redirect(`${BASE}/vitrines/${id}?erreur=${encodeURIComponent(firstIssue(parsed.error))}`);
  }
  await prisma.showcase.updateMany({
    where: { id, userId: user.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      public: data.public === 'on',
      showPrices: data.showPrices === 'on',
      wanted: data.wanted === 'on',
    },
  });
  revalidatePath(`${BASE}/vitrines/${id}`);
  revalidatePath(`${BASE}/vitrines`);
}

/** Nouveau lien public (l'ancien ne fonctionne plus). */
export async function renewShowcaseLinkAction(id: string) {
  const user = await requireUser();
  await prisma.showcase.updateMany({
    where: { id, userId: user.id },
    data: { slug: randomBytes(9).toString('base64url') },
  });
  revalidatePath(`${BASE}/vitrines/${id}`);
}

export async function deleteShowcaseAction(id: string) {
  const user = await requireUser();
  await prisma.showcase.deleteMany({ where: { id, userId: user.id } });
  redirect(`${BASE}/vitrines`);
}

export async function addShowcaseCardAction(showcaseId: string, cardId: string) {
  const user = await requireUser();
  if (!(await prisma.showcase.count({ where: { id: showcaseId, userId: user.id } }))) return;
  const last = await prisma.showcaseCard.aggregate({
    where: { showcaseId },
    _max: { position: true },
  });
  await prisma.showcaseCard.upsert({
    where: { showcaseId_cardId: { showcaseId, cardId } },
    update: {},
    create: { showcaseId, cardId, position: (last._max.position ?? -1) + 1 },
  });
  await prisma.showcase.update({ where: { id: showcaseId }, data: { updatedAt: new Date() } });
  revalidatePath(`${BASE}/vitrines/${showcaseId}`);
}

export async function removeShowcaseCardAction(showcaseId: string, cardId: string) {
  const user = await requireUser();
  await prisma.showcaseCard.deleteMany({
    where: { showcaseId, cardId, showcase: { userId: user.id } },
  });
  revalidatePath(`${BASE}/vitrines/${showcaseId}`);
}

// ─── Prix d'achat ────────────────────────────────────────

export interface LotState {
  error?: string;
  success?: string;
}

const lotSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Donne un nom au lot').max(80),
  price: requiredPrice,
  purchasedAt: optionalDate.refine((d) => d !== null, 'Date d’achat requise'),
  notes: optionalText,
});

/** Crée ou modifie un lot d'achat (prix payé, extensions couvertes). */
export async function saveCardLotAction(_prev: LotState, formData: FormData): Promise<LotState> {
  const user = await requireUser();
  const parsed = lotSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const releases = [...new Set(formData.getAll('releases').map(String))].filter(Boolean);
  if (releases.length === 0) return { error: 'Coche au moins une extension' };
  const data = {
    name: parsed.data.name,
    price: parsed.data.price,
    purchasedAt: parsed.data.purchasedAt!,
    notes: parsed.data.notes,
    releases,
  };
  if (parsed.data.id) {
    await prisma.cardLot.updateMany({ where: { id: parsed.data.id, userId: user.id }, data });
  } else {
    await prisma.cardLot.create({ data: { ...data, userId: user.id } });
  }
  revalidatePath(BASE, 'layout');
  return { success: parsed.data.id ? 'Lot modifié' : 'Lot ajouté' };
}

export async function deleteCardLotAction(id: string) {
  const user = await requireUser();
  await prisma.cardLot.deleteMany({ where: { id, userId: user.id } });
  revalidatePath(BASE, 'layout');
}

const purchaseSchema = z.object({
  purchasePrice: optionalPrice,
  purchasedAt: optionalDate,
});

/** Prix d'achat par exemplaire d'une carte possédée (vide : prix inconnu, lot ou booster). */
export async function setCardPurchaseAction(
  cardId: string,
  variant: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const parsed = purchaseSchema.safeParse(formToObject(formData));
  if (!parsed.success) redirect(`/cartes/${encodeURIComponent(cardId)}?erreur=achat`);
  await prisma.ownedCard.updateMany({
    where: { userId: user.id, cardId, variant },
    data: {
      purchasePrice: parsed.data.purchasePrice,
      purchasedAt: parsed.data.purchasePrice === null ? null : parsed.data.purchasedAt,
    },
  });
  revalidatePath(`/cartes/${encodeURIComponent(cardId)}`);
  revalidatePath(BASE, 'layout');
}

// ─── Import de collection ────────────────────────────────

/** Analyse d'un fichier CSV : colonnes reconnues et carte trouvée pour chaque ligne. */
export async function previewImportAction(text: string) {
  await requireUser();
  if (text.length > 2_000_000) return { error: 'Fichier trop gros (2 Mo au plus)' } as const;
  const { columns, rows } = parseCollectionCsv(text);
  if (rows.length === 0) {
    return {
      error:
        'Aucune ligne lisible : il faut au moins une colonne « Numéro » ou « Nom » dans la première ligne.',
    } as const;
  }
  if (rows.length > 5000) return { error: '5 000 lignes au plus par import' } as const;
  return { columns, rows: await previewImport(rows) } as const;
}

const importSchema = z
  .array(
    z.object({
      cardId: z.string().min(1).max(80),
      variant: z.enum(VARIANTS),
      quantity: z.number().int().min(1).max(999),
      price: z.number().min(0).max(100_000).nullable(),
    }),
  )
  .min(1)
  .max(5000);

/**
 * Import confirmé : exemplaires ajoutés à ceux déjà possédés ; le prix d'achat du fichier est
 * gardé quand la carte n'en a pas encore.
 */
export async function importCardsAction(
  items: { cardId: string; variant: string; quantity: number; price: number | null }[],
): Promise<{ saved: number; error?: string }> {
  const user = await requireUser();
  const parsed = importSchema.safeParse(items);
  if (!parsed.success) return { saved: 0, error: firstIssue(parsed.error) };
  // Lignes identiques regroupées (même carte, même version).
  const merged = new Map<
    string,
    { cardId: string; variant: string; quantity: number; price: number | null }
  >();
  for (const i of parsed.data) {
    const k = `${i.cardId}:${i.variant}`;
    const prev = merged.get(k);
    merged.set(
      k,
      prev
        ? { ...prev, quantity: prev.quantity + i.quantity, price: prev.price ?? i.price }
        : { ...i },
    );
  }
  const rows = [...merged.values()];
  const known = new Set(
    (
      await prisma.card.findMany({
        where: { id: { in: rows.map((r) => r.cardId) } },
        select: { id: true },
      })
    ).map((c) => c.id),
  );
  const valid = rows.filter((r) => known.has(r.cardId));
  for (let i = 0; i < valid.length; i += 200) {
    await prisma.$transaction(
      valid.slice(i, i + 200).map((r) =>
        prisma.ownedCard.upsert({
          where: {
            userId_cardId_variant: { userId: user.id, cardId: r.cardId, variant: r.variant },
          },
          update: { quantity: { increment: r.quantity } },
          create: {
            userId: user.id,
            cardId: r.cardId,
            variant: r.variant,
            quantity: r.quantity,
            purchasePrice: r.price,
          },
        }),
      ),
    );
    // Prix d'achat pour les cartes qui n'en avaient pas.
    for (const r of valid.slice(i, i + 200).filter((x) => x.price !== null)) {
      await prisma.ownedCard.updateMany({
        where: { userId: user.id, cardId: r.cardId, variant: r.variant, purchasePrice: null },
        data: { purchasePrice: r.price },
      });
    }
  }
  revalidatePath(BASE, 'layout');
  return { saved: valid.reduce((n, r) => n + r.quantity, 0) };
}

// ─── Page publique de collectionneur ─────────────────────

const RESERVED_SLUGS = new Set(['admin', 'tcgwatch', 'moderation', 'support', 'contact']);
const profileSchema = z.object({
  profileSlug: z
    .string()
    .trim()
    .toLowerCase()
    .transform((s) =>
      s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[\s_]+/g, '-'),
    )
    .pipe(
      z
        .string()
        .regex(
          /^(|[a-z0-9][a-z0-9-]{1,28}[a-z0-9])$/,
          'Adresse : 3 à 30 caractères, lettres, chiffres et tirets',
        ),
    ),
  profileName: z.string().trim().max(40, 'Pseudo : 40 caractères au plus').optional(),
  profileBio: z.string().trim().max(300, 'Présentation : 300 caractères au plus').optional(),
});

export async function saveProfileAction(formData: FormData) {
  const user = await requireUser();
  const data = formToObject(formData);
  const parsed = profileSchema.safeParse(data);
  const back = (q: string) => redirect(`${BASE}/vitrines?${q}`);
  if (!parsed.success) back(`erreur=${encodeURIComponent(firstIssue(parsed.error))}`);
  const { profileSlug, profileName, profileBio } = parsed.data!;
  const publish = data.profilePublic === 'on';
  if (publish && !profileSlug)
    back(`erreur=${encodeURIComponent('Choisis une adresse pour ta page')}`);
  if (RESERVED_SLUGS.has(profileSlug))
    back(`erreur=${encodeURIComponent('Cette adresse est réservée')}`);
  if (
    profileSlug &&
    (await prisma.user.count({ where: { profileSlug, id: { not: user.id } } })) > 0
  ) {
    back(`erreur=${encodeURIComponent('Cette adresse est déjà prise')}`);
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      profilePublic: publish,
      profileSlug: profileSlug || null,
      profileName: profileName || null,
      profileBio: profileBio || null,
      profileBinders: data.profileBinders === 'on',
      profileDoubles: data.profileDoubles === 'on',
      profilePrices: data.profilePrices === 'on',
    },
  });
  revalidatePath(`${BASE}/vitrines`);
  if (profileSlug) revalidatePath(`/collectionneur/${profileSlug}`);
  back('profil=enregistre');
}
