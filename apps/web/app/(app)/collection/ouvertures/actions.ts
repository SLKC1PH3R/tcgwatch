'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@tcgwatch/db';
import { requireUser } from '@/lib/auth';
import { firstIssue, formToObject, optionalDate, optionalText, requiredPrice } from '@/lib/form';

const BASE = '/collection/ouvertures';

export interface OpeningState {
  error?: string;
}

const openingSchema = z.object({
  productId: z.string().min(1, 'Choisissez le produit ouvert'),
  price: requiredPrice,
  openedAt: optionalDate.refine((d) => d !== null, 'Date d’ouverture requise'),
  notes: optionalText,
});

/** Nouvelle ouverture : produit, prix payé et date ; les cartes se saisissent ensuite. */
export async function createOpeningAction(
  _prev: OpeningState,
  formData: FormData,
): Promise<OpeningState> {
  const user = await requireUser();
  const parsed = openingSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { releaseId: true, extensionId: true },
  });
  if (!product?.extensionId && !product?.releaseId) {
    return { error: 'Ce produit n’est lié à aucune extension.' };
  }
  const opening = await prisma.productOpening.create({
    data: {
      userId: user.id,
      productId: parsed.data.productId,
      price: parsed.data.price,
      openedAt: parsed.data.openedAt!,
      notes: parsed.data.notes,
    },
  });
  revalidatePath(BASE);
  redirect(`${BASE}/${opening.id}`);
}

const cardsSchema = z.object({
  normal: z.record(z.string(), z.number().int().min(0).max(999)),
  reverse: z.record(z.string(), z.number().int().min(0).max(999)),
  addToCollection: z.boolean(),
});

/**
 * Cartes tirées d'une ouverture (remplacent la saisie précédente). Avec « ajouter à ma
 * collection », seule la différence avec la saisie précédente est reportée sur la collection.
 */
export async function saveOpeningCardsAction(
  id: string,
  payload: z.infer<typeof cardsSchema>,
): Promise<{ saved: number; error?: string }> {
  const user = await requireUser();
  const parsed = cardsSchema.safeParse(payload);
  if (!parsed.success) return { saved: 0, error: firstIssue(parsed.error) };
  const opening = await prisma.productOpening.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      product: { select: { releaseId: true, extensionId: true } },
      cards: { select: { cardId: true, variant: true, quantity: true } },
    },
  });
  const cardRelease = opening?.product.extensionId ?? opening?.product.releaseId;
  if (!opening || !cardRelease) return { saved: 0, error: 'Ouverture introuvable' };
  const wanted = (['normal', 'reverse'] as const).flatMap((variant) =>
    Object.entries(parsed.data[variant])
      .filter(([, q]) => q > 0)
      .map(([cardId, quantity]) => ({ cardId, variant, quantity })),
  );
  // Cartes de l'extension du produit seulement.
  const valid = new Set(
    (
      await prisma.card.findMany({
        where: {
          id: { in: wanted.map((w) => w.cardId) },
          releaseId: cardRelease,
        },
        select: { id: true },
      })
    ).map((c) => c.id),
  );
  const rows = wanted.filter((w) => valid.has(w.cardId));
  const key = (c: { cardId: string; variant: string }) => `${c.cardId}:${c.variant}`;
  const before = new Map(opening.cards.map((c) => [key(c), c.quantity]));
  const after = new Map(rows.map((c) => [key(c), c.quantity]));
  const deltas = [...new Set([...before.keys(), ...after.keys()])]
    .map((k) => {
      const [cardId, variant] = k.split(':') as [string, string];
      return { cardId, variant, delta: (after.get(k) ?? 0) - (before.get(k) ?? 0) };
    })
    .filter((d) => d.delta !== 0);

  await prisma.$transaction(async (tx) => {
    await tx.openingCard.deleteMany({ where: { openingId: id } });
    if (rows.length) {
      await tx.openingCard.createMany({ data: rows.map((r) => ({ openingId: id, ...r })) });
    }
    if (!parsed.data.addToCollection) return;
    for (const d of deltas) {
      const current = await tx.ownedCard.findUnique({
        where: {
          userId_cardId_variant: { userId: user.id, cardId: d.cardId, variant: d.variant },
        },
      });
      const next = Math.max(0, (current?.quantity ?? 0) + d.delta);
      if (current && next === 0) await tx.ownedCard.delete({ where: { id: current.id } });
      else if (current) {
        await tx.ownedCard.update({ where: { id: current.id }, data: { quantity: next } });
      } else if (next > 0) {
        await tx.ownedCard.create({
          data: { userId: user.id, cardId: d.cardId, variant: d.variant, quantity: next },
        });
      }
    }
  });
  revalidatePath(BASE, 'layout');
  revalidatePath('/collection/cartes', 'layout');
  return { saved: rows.reduce((n, r) => n + r.quantity, 0) };
}

/** Supprime l'ouverture (les cartes restent dans la collection). */
export async function deleteOpeningAction(id: string) {
  const user = await requireUser();
  await prisma.productOpening.deleteMany({ where: { id, userId: user.id } });
  revalidatePath(BASE);
  redirect(BASE);
}
