'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma, SealCondition } from '@tcgwatch/db';
import { requireUser } from '@/lib/auth';
import { firstIssue, formToObject, optionalDate, optionalText, requiredPrice } from '@/lib/form';
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
  condition: z.enum(SealCondition),
  notes: optionalText,
});

export async function addCollectionItemAction(
  _prev: CollectionState,
  formData: FormData,
): Promise<CollectionState> {
  await requireUser();
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
      productId: d.productId,
      quantity: d.quantity,
      purchasePrice: d.purchasePrice,
      purchaseDate: d.purchaseDate!,
      store: d.store,
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
  await requireUser();
  const item = await prisma.collectionItem.delete({ where: { id } });
  await deleteUpload(item.photoPath);
  revalidatePath('/collection');
  revalidatePath('/');
}
