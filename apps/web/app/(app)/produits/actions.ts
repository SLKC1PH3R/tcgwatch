'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@tcgwatch/db';
import { requireAdmin, requireUser } from '@/lib/auth';
import { setFollowTarget, unfollow } from '@/lib/follows';
import { firstIssue, formToObject, optionalPrice } from '@/lib/form';

/*
 * Le catalogue, les fiches revendeurs et les prix sont entièrement automatiques : seules
 * restent les préférences (prix cible, alertes lues, points exclus du graphique).
 */

// ─── Alertes ─────────────────────────────────────────────

export async function acknowledgeAlertAction(id: string) {
  const user = await requireUser();
  await prisma.alertEvent.updateMany({
    where: { id, userId: user.id },
    data: { acknowledged: true },
  });
  revalidatePath('/');
}

export async function acknowledgeAllAlertsAction() {
  const user = await requireUser();
  await prisma.alertEvent.updateMany({
    where: { userId: user.id, acknowledged: false },
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
  await requireAdmin();
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
  const user = await requireUser();
  const parsed = targetSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    redirect(`/produits/${productId}?erreur=${encodeURIComponent(firstIssue(parsed.error))}`);
  }
  if (parsed.data.targetPrice === null) await unfollow(user.id, productId);
  else await setFollowTarget(user.id, productId, parsed.data.targetPrice);
  revalidatePath(`/produits/${productId}`);
}
