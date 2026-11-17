'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@tcgwatch/db';
import { requireUser } from '@/lib/auth';
import { firstIssue, formToObject, optionalText } from '@/lib/form';

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
  await requireUser();
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
            where: { cardId_variant: { cardId: id, variant } },
            update: { quantity: quantities[id]! },
            create: { cardId: id, variant, quantity: quantities[id]! },
          })
        : prisma.ownedCard.deleteMany({ where: { cardId: id, variant } }),
    ),
  );
  revalidatePath(BASE, 'layout');
  return { saved: cards.length };
}

/** +1 / −1 sur une carte (fiche carte, classeurs). */
export async function adjustOwnedCardAction(cardId: string, delta: 1 | -1, variant = 'normal') {
  await requireUser();
  if (!VARIANTS.includes(variant as never)) return;
  const current = await prisma.ownedCard.findUnique({
    where: { cardId_variant: { cardId, variant } },
  });
  const next = (current?.quantity ?? 0) + delta;
  if (next <= 0) {
    if (current) await prisma.ownedCard.delete({ where: { id: current.id } });
  } else if (current) {
    await prisma.ownedCard.update({ where: { id: current.id }, data: { quantity: next } });
  } else {
    await prisma.ownedCard.create({ data: { cardId, variant, quantity: next } });
  }
  revalidatePath(BASE, 'layout');
  revalidatePath(`/cartes/${cardId}`);
}

// ─── Classeurs ───────────────────────────────────────────

const binderSchema = z.object({
  name: optionalText,
  description: optionalText,
  release: optionalText,
});

export async function createBinderAction(formData: FormData) {
  await requireUser();
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
      name: name ?? release!.nameFr,
      description: description ?? null,
      releaseId: release?.id ?? null,
    },
  });
  redirect(`${BASE}/classeurs/${binder.id}`);
}

export async function updateBinderAction(id: string, formData: FormData) {
  await requireUser();
  const parsed = binderSchema.safeParse(formToObject(formData));
  if (!parsed.success || !parsed.data.name) return;
  await prisma.cardBinder.update({
    where: { id },
    data: { name: parsed.data.name, description: parsed.data.description ?? null },
  });
  revalidatePath(`${BASE}/classeurs/${id}`);
}

export async function deleteBinderAction(id: string) {
  await requireUser();
  await prisma.cardBinder.delete({ where: { id } });
  redirect(`${BASE}/classeurs`);
}

export async function addBinderCardAction(binderId: string, cardId: string) {
  await requireUser();
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
  await requireUser();
  await prisma.binderCard.deleteMany({ where: { binderId, cardId } });
  revalidatePath(`${BASE}/classeurs/${binderId}`);
}

// ─── Vitrines ────────────────────────────────────────────

const showcaseSchema = z.object({
  title: z.string().trim().min(1, 'Donne un titre à la vitrine').max(120),
  description: optionalText,
});

export async function createShowcaseAction(formData: FormData) {
  await requireUser();
  const parsed = showcaseSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    redirect(`${BASE}/vitrines?erreur=${encodeURIComponent(firstIssue(parsed.error))}`);
  }
  const showcase = await prisma.showcase.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      slug: randomBytes(9).toString('base64url'),
    },
  });
  redirect(`${BASE}/vitrines/${showcase.id}`);
}

export async function updateShowcaseAction(id: string, formData: FormData) {
  await requireUser();
  const data = formToObject(formData);
  const parsed = showcaseSchema.safeParse(data);
  if (!parsed.success) {
    redirect(`${BASE}/vitrines/${id}?erreur=${encodeURIComponent(firstIssue(parsed.error))}`);
  }
  await prisma.showcase.update({
    where: { id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      public: data.public === 'on',
      showPrices: data.showPrices === 'on',
    },
  });
  revalidatePath(`${BASE}/vitrines/${id}`);
  revalidatePath(`${BASE}/vitrines`);
}

/** Nouveau lien public (l'ancien ne fonctionne plus). */
export async function renewShowcaseLinkAction(id: string) {
  await requireUser();
  await prisma.showcase.update({
    where: { id },
    data: { slug: randomBytes(9).toString('base64url') },
  });
  revalidatePath(`${BASE}/vitrines/${id}`);
}

export async function deleteShowcaseAction(id: string) {
  await requireUser();
  await prisma.showcase.delete({ where: { id } });
  redirect(`${BASE}/vitrines`);
}

export async function addShowcaseCardAction(showcaseId: string, cardId: string) {
  await requireUser();
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
  await requireUser();
  await prisma.showcaseCard.deleteMany({ where: { showcaseId, cardId } });
  revalidatePath(`${BASE}/vitrines/${showcaseId}`);
}
