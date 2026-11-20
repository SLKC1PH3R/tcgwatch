'use server';

import { revalidatePath } from 'next/cache';
import { prisma, type AlertType } from '@tcgwatch/db';
import { ALERT_TYPES, fromClock } from '@/lib/alerts';
import { requireUser } from '@/lib/auth';

const refresh = () => revalidatePath('/', 'layout');

/** Marque une alerte vue ou pas vue. */
export async function setAlertSeenAction(id: string, seen: boolean) {
  await requireUser();
  await prisma.alertEvent.update({ where: { id }, data: { acknowledged: seen } });
  refresh();
}

/** Marque comme vues toutes les alertes (ou celles d'un type). */
export async function markAllSeenAction(type?: AlertType) {
  await requireUser();
  await prisma.alertEvent.updateMany({
    where: { acknowledged: false, ...(type ? { type } : {}) },
    data: { acknowledged: true },
  });
  refresh();
}

/** Heures silencieuses : alertes envoyées sans son entre deux heures (heure de Paris). */
export async function saveQuietHoursAction(formData: FormData) {
  await requireUser();
  const on = formData.get('actives') === '1';
  const start = fromClock(String(formData.get('debut') ?? ''));
  const end = fromClock(String(formData.get('fin') ?? ''));
  const quiet = on && start !== null && end !== null && start !== end;
  await prisma.alertSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', quietStart: quiet ? start : null, quietEnd: quiet ? end : null },
    update: { quietStart: quiet ? start : null, quietEnd: quiet ? end : null },
  });
  refresh();
}

/** Types envoyés : les cases décochées sont journalisées sans être envoyées. */
export async function saveAlertTypesAction(formData: FormData) {
  await requireUser();
  const kept = new Set(formData.getAll('type').map(String));
  const mutedTypes = ALERT_TYPES.filter((t) => !kept.has(t));
  await prisma.alertSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', mutedTypes },
    update: { mutedTypes },
  });
  refresh();
}

/** Coupe (ou rétablit) un type d'alerte pour un produit. */
export async function setProductAlertMuteAction(productId: string, type: AlertType, mute: boolean) {
  await requireUser();
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { mutedAlerts: true },
  });
  if (!product) return;
  const set = new Set(product.mutedAlerts);
  if (mute) set.add(type);
  else set.delete(type);
  await prisma.product.update({ where: { id: productId }, data: { mutedAlerts: [...set] } });
  refresh();
}
