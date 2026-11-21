'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma, SealCondition } from '@tcgwatch/db';
import { requireUser } from '@/lib/auth';
import {
  firstIssue,
  formToObject,
  optionalDate,
  optionalPrice,
  optionalText,
  requiredPrice,
} from '@/lib/form';
import { deleteUpload, saveCollectionPhoto } from '@/lib/uploads';

export interface CollectionState {
  error?: string;
  success?: string;
}

const itemSchema = z.object({
  productId: z.string().min(1, 'Choisissez un produit'),
  quantity: z.coerce.number().int().min(1, 'Quantité minimale : 1').max(10_000),
  purchasePrice: requiredPrice,
  purchaseDate: optionalDate.refine((d) => d !== null, 'Date d’achat requise'),
  store: optionalText,
  shipping: optionalPrice,
  condition: z.enum(SealCondition),
  notes: optionalText,
});

export async function addCollectionItemAction(
  _prev: CollectionState,
  formData: FormData,
): Promise<CollectionState> {
  const user = await requireUser();
  const parsed = itemSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  let photoPath: string | undefined;
  const photo = formData.get('photo');
  if (photo instanceof File && photo.size > 0) {
    try {
      photoPath = await saveCollectionPhoto(photo);
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Photo invalide.' };
    }
  }

  const d = parsed.data;
  await prisma.collectionItem.create({
    data: {
      userId: user.id,
      productId: d.productId,
      quantity: d.quantity,
      purchasePrice: d.purchasePrice,
      purchaseDate: d.purchaseDate!,
      store: d.store,
      shipping: d.shipping,
      condition: d.condition,
      notes: d.notes,
      photoPath,
    },
  });
  revalidatePath('/collection');
  revalidatePath('/');
  return { success: 'Ajouté à la collection.' };
}

export async function deleteCollectionItemAction(id: string) {
  const user = await requireUser();
  const item = await prisma.collectionItem.findFirst({ where: { id, userId: user.id } });
  if (!item) return;
  await prisma.collectionItem.delete({ where: { id: item.id } });
  await deleteUpload(item.photoPath);
  revalidatePath('/collection');
  revalidatePath('/');
}

const saleSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().int().min(1, 'Quantité minimale : 1'),
  salePrice: requiredPrice,
  saleFees: optionalPrice,
  soldAt: optionalDate.refine((d) => d !== null, 'Date de vente requise'),
  saleChannel: optionalText,
});

/**
 * Revente de tout ou partie d'une ligne. Vente partielle : la ligne est scindée (la part vendue
 * devient une ligne « vendue », avec sa part des frais de port), le reste reste en collection.
 */
export async function sellCollectionItemAction(
  _prev: CollectionState,
  formData: FormData,
): Promise<CollectionState> {
  const user = await requireUser();
  const parsed = saleSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const d = parsed.data;
  const item = await prisma.collectionItem.findFirst({ where: { id: d.id, userId: user.id } });
  if (!item || item.soldAt) return { error: 'Ligne introuvable ou déjà vendue.' };
  if (d.quantity > item.quantity) {
    return { error: `Tu n’en as que ${item.quantity} sur cette ligne.` };
  }
  if (d.soldAt! < item.purchaseDate) return { error: 'La vente ne peut pas précéder l’achat.' };

  const sale = {
    soldAt: d.soldAt!,
    salePrice: d.salePrice,
    saleFees: d.saleFees,
    saleChannel: d.saleChannel,
  };
  if (d.quantity === item.quantity) {
    await prisma.collectionItem.update({ where: { id: item.id }, data: sale });
  } else {
    const shipping = item.shipping === null ? null : Number(item.shipping);
    const soldShipping =
      shipping === null ? null : Math.round(((shipping * d.quantity) / item.quantity) * 100) / 100;
    await prisma.$transaction([
      prisma.collectionItem.update({
        where: { id: item.id },
        data: {
          quantity: item.quantity - d.quantity,
          shipping: shipping === null ? null : Math.round((shipping - soldShipping!) * 100) / 100,
        },
      }),
      prisma.collectionItem.create({
        data: {
          userId: user.id,
          productId: item.productId,
          quantity: d.quantity,
          purchasePrice: item.purchasePrice,
          purchaseDate: item.purchaseDate,
          store: item.store,
          shipping: soldShipping,
          condition: item.condition,
          notes: item.notes,
          ...sale,
        },
      }),
    ]);
  }
  revalidatePath('/collection');
  revalidatePath('/');
  return { success: 'Vente enregistrée.' };
}

/** Annule une vente : la ligne revient dans la collection. */
export async function cancelSaleAction(id: string) {
  const user = await requireUser();
  await prisma.collectionItem.updateMany({
    where: { id, userId: user.id },
    data: { soldAt: null, salePrice: null, saleFees: null, saleChannel: null },
  });
  revalidatePath('/collection');
  revalidatePath('/');
}
