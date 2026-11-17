'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@tcgwatch/db';
import { requireUser } from '@/lib/auth';
import { firstIssue, formToObject, optionalText, requiredPrice } from '@/lib/form';

const PATH = '/produits/mes-produits';

const schema = z.object({
  targetPrice: requiredPrice.refine((v) => v > 0, 'Le bon prix doit être positif'),
  marketQuery: optionalText,
});

function fail(message: string): never {
  redirect(`${PATH}?erreur=${encodeURIComponent(message)}`);
}

/**
 * Ajoute un produit à « Mes produits » ou modifie son bon prix et ses mots-clés : le bon prix
 * est aussi le prix cible des alertes boutiques, eBay et Cardmarket.
 */
export async function saveMyProductAction(formData: FormData) {
  await requireUser();
  const data = formToObject(formData);
  const parsed = schema.safeParse(data);
  if (!parsed.success) fail(firstIssue(parsed.error));
  const product = await prisma.product.findUnique({
    where: { id: data.productId ?? '' },
    select: { id: true },
  });
  if (!product) fail('Produit introuvable');
  await prisma.product.update({
    where: { id: product.id },
    data: {
      targetPrice: parsed.data.targetPrice,
      marketQuery: parsed.data.marketQuery ?? null,
    },
  });
  revalidatePath(PATH);
  revalidatePath(`/produits/${product.id}`);
  redirect(`${PATH}#p-${product.id}`);
}

/** Retire un produit de « Mes produits » (plus de bon prix, annonces eBay effacées). */
export async function removeMyProductAction(productId: string) {
  await requireUser();
  await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: { targetPrice: null, marketQuery: null },
    }),
    prisma.marketListing.deleteMany({ where: { productId } }),
  ]);
  revalidatePath(PATH);
  revalidatePath(`/produits/${productId}`);
}
