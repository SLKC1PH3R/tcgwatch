'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { RETAILER_DIRECTORY } from '@tcgwatch/adapters';
import { prisma } from '@tcgwatch/db';
import { requireAdmin } from '@/lib/auth';
import { firstIssue, formToObject, optionalPrice } from '@/lib/form';

export interface ShippingState {
  error?: string;
  success?: string;
}

const shippingSchema = z.object({ cost: optionalPrice, freeFrom: optionalPrice });

/** Frais de port saisis à la main : prioritaires sur l'annuaire, utilisés pour le prix livré. */
export async function saveRetailerShippingAction(
  id: string,
  _prev: ShippingState,
  formData: FormData,
): Promise<ShippingState> {
  await requireAdmin();
  const parsed = shippingSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await prisma.retailer.update({
    where: { id },
    data: {
      shippingCost: parsed.data.cost,
      freeShippingFrom: parsed.data.freeFrom,
      shippingManual: true,
    },
  });
  revalidatePath('/', 'layout');
  return { success: 'Frais de port enregistrés.' };
}

/** Revient aux frais de port de l'annuaire (mis à jour avec le code). */
export async function resetRetailerShippingAction(id: string) {
  await requireAdmin();
  const retailer = await prisma.retailer.findUnique({ where: { id }, select: { domain: true } });
  if (!retailer) return;
  const info = RETAILER_DIRECTORY.find((d) => d.domain === retailer.domain);
  await prisma.retailer.update({
    where: { id },
    data: {
      shippingCost: info?.shipping?.cost ?? null,
      freeShippingFrom: info?.shipping?.freeFrom ?? null,
      shippingManual: false,
    },
  });
  revalidatePath('/', 'layout');
}
