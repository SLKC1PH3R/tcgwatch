'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma, ProductType } from '@tcgwatch/db';
import { requireUser } from '@/lib/auth';
import { firstIssue, formToObject, optionalDate, optionalText } from '@/lib/form';

export interface ReleaseState {
  error?: string;
  success?: string;
}

const releaseSchema = z.object({
  nameFr: z.string().trim().min(2, 'Nom requis').max(200),
  setCode: optionalText,
  releaseDate: optionalDate,
  productType: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.enum(ProductType).optional()),
  imageUrl: optionalText.pipe(z.string().url('URL d’image invalide').optional()),
  notes: optionalText,
  validate: z.string().optional(),
});

function toData(d: z.infer<typeof releaseSchema>) {
  return {
    nameFr: d.nameFr,
    setCode: d.setCode?.toUpperCase() ?? null,
    releaseDate: d.releaseDate,
    productType: d.productType ?? null,
    imageUrl: d.imageUrl ?? null,
    notes: d.notes ?? null,
  };
}

export async function createReleaseAction(
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  await requireUser();
  const parsed = releaseSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await prisma.release.create({
    data: { ...toData(parsed.data), source: 'MANUAL', status: 'VALIDATED' },
  });
  revalidatePath('/calendrier');
  return { success: 'Sortie ajoutée.' };
}

/** Édition manuelle : une sortie modifiée à la main passe en « validé » (plus écrasée par les imports). */
export async function updateReleaseAction(
  id: string,
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  await requireUser();
  const parsed = releaseSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await prisma.release.update({
    where: { id },
    data: {
      ...toData(parsed.data),
      status: parsed.data.validate === 'auto' ? 'AUTO' : 'VALIDATED',
    },
  });
  revalidatePath('/calendrier');
  revalidatePath('/');
  return { success: 'Sortie enregistrée.' };
}

export async function validateReleaseAction(id: string) {
  await requireUser();
  await prisma.release.update({ where: { id }, data: { status: 'VALIDATED' } });
  revalidatePath('/calendrier');
}

export async function deleteReleaseAction(id: string) {
  await requireUser();
  await prisma.release.delete({ where: { id } });
  revalidatePath('/calendrier');
}
