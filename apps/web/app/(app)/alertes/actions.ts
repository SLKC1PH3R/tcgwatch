'use server';

import { revalidatePath } from 'next/cache';
import { prisma, type AlertType } from '@tcgwatch/db';
import { ALERT_TYPES, fromClock } from '@/lib/alerts';
import { requireUser } from '@/lib/auth';
import { setFollowMute } from '@/lib/follows';

const refresh = () => revalidatePath('/', 'layout');

/** Marque une alerte vue ou pas vue. */
export async function setAlertSeenAction(id: string, seen: boolean) {
  const user = await requireUser();
  await prisma.alertEvent.updateMany({
    where: { id, userId: user.id },
    data: { acknowledged: seen },
  });
  refresh();
}

/** Marque comme vues toutes les alertes (ou celles d'un type). */
export async function markAllSeenAction(type?: AlertType) {
  const user = await requireUser();
  await prisma.alertEvent.updateMany({
    where: { userId: user.id, acknowledged: false, ...(type ? { type } : {}) },
    data: { acknowledged: true },
  });
  refresh();
}

/** Heures silencieuses : alertes envoyées sans son entre deux heures (heure de Paris). */
export async function saveQuietHoursAction(formData: FormData) {
  const user = await requireUser();
  const on = formData.get('actives') === '1';
  const start = fromClock(String(formData.get('debut') ?? ''));
  const end = fromClock(String(formData.get('fin') ?? ''));
  const quiet = on && start !== null && end !== null && start !== end;
  await prisma.alertSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, quietStart: quiet ? start : null, quietEnd: quiet ? end : null },
    update: { quietStart: quiet ? start : null, quietEnd: quiet ? end : null },
  });
  refresh();
}

/** Types envoyés : les cases décochées sont journalisées sans être envoyées. */
export async function saveAlertTypesAction(formData: FormData) {
  const user = await requireUser();
  const kept = new Set(formData.getAll('type').map(String));
  const mutedTypes = ALERT_TYPES.filter((t) => !kept.has(t));
  await prisma.alertSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, mutedTypes },
    update: { mutedTypes },
  });
  refresh();
}

/** Coupe (ou rétablit) un type d'alerte pour un produit. */
export async function setProductAlertMuteAction(productId: string, type: AlertType, mute: boolean) {
  const user = await requireUser();
  await setFollowMute(user.id, productId, type, mute);
  refresh();
}
