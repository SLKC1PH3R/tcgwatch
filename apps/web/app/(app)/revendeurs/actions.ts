'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@tcgwatch/db';
import { requireUser } from '@/lib/auth';

/** Active / désactive les relevés d'un revendeur (ses fiches ne sont plus relevées). */
export async function toggleRetailerAction(id: string) {
  await requireUser();
  const retailer = await prisma.retailer.findUnique({ where: { id }, select: { enabled: true } });
  if (!retailer) return;
  await prisma.retailer.update({ where: { id }, data: { enabled: !retailer.enabled } });
  revalidatePath('/revendeurs');
}
