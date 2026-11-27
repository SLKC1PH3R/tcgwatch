'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@tcgwatch/db';
import { parseTelegramMode, TELEGRAM_SETTINGS } from '@tcgwatch/shared';
import { requireAdmin } from '@/lib/auth';

const PAGE = '/membres';
const HOUR_MS = 3_600_000;

/** Durée de pause (heures) lue dans le formulaire ; 0 = reprendre. */
function pauseEnd(formData: FormData): Date | null {
  const hours = Number(formData.get('heures'));
  return Number.isFinite(hours) && hours > 0 ? new Date(Date.now() + hours * HOUR_MS) : null;
}

/** Nomme ou retire un administrateur (jamais le dernier). */
export async function setRoleAction(userId: string, admin: boolean) {
  await requireAdmin();
  if (!admin) {
    const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (target?.role === 'ADMIN' && admins <= 1) {
      redirect(
        `${PAGE}?erreur=${encodeURIComponent('Il faut garder au moins un administrateur.')}`,
      );
    }
  }
  await prisma.user.update({ where: { id: userId }, data: { role: admin ? 'ADMIN' : 'USER' } });
  revalidatePath('/', 'layout');
}

/** Réglage administrateur du Telegram d'un membre : actif, sans son ou coupé. */
export async function setTelegramModeAction(userId: string, formData: FormData) {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { telegramAdminMode: parseTelegramMode(String(formData.get('mode') ?? '')) },
  });
  revalidatePath(PAGE);
}

/** Met en pause (ou reprend) le Telegram d'un membre. */
export async function pauseTelegramAction(userId: string, formData: FormData) {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { telegramPausedUntil: pauseEnd(formData) },
  });
  revalidatePath(PAGE);
}

/** Pause de Telegram pour tout le monde, conversation du serveur comprise (ou reprise). */
export async function setGlobalTelegramPauseAction(formData: FormData) {
  await requireAdmin();
  const until = pauseEnd(formData);
  if (until) {
    await prisma.appSetting.upsert({
      where: { key: TELEGRAM_SETTINGS.pausedUntil },
      create: { key: TELEGRAM_SETTINGS.pausedUntil, value: until.toISOString() },
      update: { value: until.toISOString() },
    });
  } else {
    await prisma.appSetting.deleteMany({ where: { key: TELEGRAM_SETTINGS.pausedUntil } });
  }
  revalidatePath('/', 'layout');
}
