'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@tcgwatch/db';
import { destroySession, requireUser } from '@/lib/auth';
import { syncProductTarget } from '@/lib/follows';
import { hashPassword, verifyPassword } from '@/lib/password';

export interface AccountState {
  error?: string;
  success?: string;
}

export async function updateProfileAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();
  const name = String(formData.get('name') ?? '')
    .trim()
    .slice(0, 80);
  await prisma.user.update({ where: { id: user.id }, data: { name: name || null } });
  revalidatePath('/', 'layout');
  return { success: 'Profil enregistré.' };
}

const passwordSchema = z
  .object({
    current: z.string().optional(),
    password: z.string().min(10, 'Le mot de passe doit contenir au moins 10 caractères').max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm'],
  });

/** Change (ou crée, pour un compte Google) le mot de passe ; les autres sessions sont fermées. */
export async function changePasswordAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({
    current: formData.get('current') || undefined,
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const row = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (row.passwordHash && !(await verifyPassword(parsed.data.current ?? '', row.passwordHash))) {
    return { error: 'Mot de passe actuel incorrect.' };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  return { success: 'Mot de passe enregistré.' };
}

/** Retire un appareil des notifications du navigateur. */
export async function removeDeviceAction(id: string) {
  const user = await requireUser();
  await prisma.pushSubscription.deleteMany({ where: { id, userId: user.id } });
  revalidatePath('/compte');
}

/** Ferme toutes les sessions sauf celle-ci (en la recréant). */
export async function logoutEverywhereAction() {
  const user = await requireUser();
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await destroySession();
  redirect('/connexion');
}

/**
 * Supprime le compte et toutes ses données (collection, cartes, suivis, alertes, vitrines,
 * appareils). Confirmation : l'adresse e-mail du compte.
 */
export async function deleteAccountAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();
  if (
    String(formData.get('confirm') ?? '')
      .trim()
      .toLowerCase() !== user.email
  ) {
    return { error: 'Recopiez exactement votre adresse e-mail pour confirmer.' };
  }
  if (user.role === 'ADMIN') {
    const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (admins <= 1) {
      return { error: 'Tu es le seul administrateur : nomme un autre administrateur d’abord.' };
    }
  }
  const followed = await prisma.productFollow.findMany({
    where: { userId: user.id },
    select: { productId: true },
  });
  // Les lignes de collection référencent les produits sans cascade : supprimées d'abord.
  await prisma.$transaction([
    prisma.collectionItem.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);
  for (const f of followed) await syncProductTarget(f.productId);
  await destroySession().catch(() => undefined);
  redirect('/bienvenue');
}
