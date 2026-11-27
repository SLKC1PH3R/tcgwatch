'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@tcgwatch/db';
import { parseTelegramInvite, TELEGRAM_SETTINGS } from '@tcgwatch/shared';
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

/** Met le bot Telegram en pause (ou le reprend) : plus rien n'est envoyé au groupe. */
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

/** Lien d'invitation du groupe Telegram, affiché dans la page Alertes (vide : masqué). */
export async function setTelegramInviteAction(formData: FormData) {
  await requireAdmin();
  const raw = String(formData.get('lien') ?? '').trim();
  const url = parseTelegramInvite(raw);
  if (raw && !url) {
    redirect(`${PAGE}?erreur=${encodeURIComponent('Le lien doit commencer par https://t.me/')}`);
  }
  if (url) {
    await prisma.appSetting.upsert({
      where: { key: TELEGRAM_SETTINGS.inviteUrl },
      create: { key: TELEGRAM_SETTINGS.inviteUrl, value: url },
      update: { value: url },
    });
  } else {
    await prisma.appSetting.deleteMany({ where: { key: TELEGRAM_SETTINGS.inviteUrl } });
  }
  revalidatePath('/', 'layout');
}
