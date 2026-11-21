'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@tcgwatch/db';
import { requireAdmin, requireUser } from '@/lib/auth';

export interface ReportState {
  error?: string;
  success?: string;
}

const reportSchema = z.object({
  kind: z.enum(['PRICE', 'STOCK', 'MATCH', 'OTHER']),
  message: z.string().trim().min(3, 'Décris l’erreur en quelques mots').max(1000),
  productId: z.string().max(50).optional(),
  listingId: z.string().max(50).optional(),
  cardId: z.string().max(50).optional(),
  path: z.string().max(300).optional(),
});

/** Signalement d'une erreur ; 20 au plus par jour et par compte. */
export async function reportErrorAction(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const user = await requireUser();
  const value = (k: string) => (formData.get(k) ? String(formData.get(k)) : undefined);
  const parsed = reportSchema.safeParse({
    kind: value('kind'),
    message: value('message'),
    productId: value('productId'),
    listingId: value('listingId'),
    cardId: value('cardId'),
    path: value('path'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const today = await prisma.errorReport.count({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  if (today >= 20)
    return { error: 'Beaucoup de signalements aujourd’hui : merci, réessaie demain.' };
  await prisma.errorReport.create({ data: { ...parsed.data, userId: user.id } });
  revalidatePath('/signalements');
  return { success: 'Merci ! Le signalement sera vérifié rapidement.' };
}

/** Clôt un signalement (corrigé ou rejeté), avec une note facultative. */
export async function closeReportAction(
  id: string,
  status: 'RESOLVED' | 'REJECTED',
  formData: FormData,
) {
  await requireAdmin();
  const note = String(formData.get('note') ?? '')
    .trim()
    .slice(0, 500);
  await prisma.errorReport.update({
    where: { id },
    data: { status, adminNote: note || null, resolvedAt: new Date() },
  });
  revalidatePath('/signalements');
}

/** Fiche revendeur rattachée au mauvais produit : mise en pause (plus relevée ni affichée). */
export async function pauseListingFromReportAction(reportId: string) {
  await requireAdmin();
  const report = await prisma.errorReport.findUnique({ where: { id: reportId } });
  if (!report?.listingId) return;
  await prisma.$transaction([
    prisma.listing.update({ where: { id: report.listingId }, data: { state: 'PAUSED' } }),
    prisma.errorReport.update({
      where: { id: reportId },
      data: { status: 'RESOLVED', adminNote: 'Fiche mise en pause', resolvedAt: new Date() },
    }),
  ]);
  revalidatePath('/signalements');
  if (report.productId) revalidatePath(`/produits/${report.productId}`);
}
