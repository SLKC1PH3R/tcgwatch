'use server';

import { randomBytes } from 'node:crypto';
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

/**
 * Heures silencieuses (heure de Paris) : alertes envoyées sans son, ou retenues et regroupées
 * en un récapitulatif à la fin de la plage.
 */
export async function saveQuietHoursAction(formData: FormData) {
  const user = await requireUser();
  const on = formData.get('actives') === '1';
  const start = fromClock(String(formData.get('debut') ?? ''));
  const end = fromClock(String(formData.get('fin') ?? ''));
  const quiet = on && start !== null && end !== null && start !== end;
  const quietMode = formData.get('mode') === 'hold' ? 'hold' : 'silent';
  const data = { quietStart: quiet ? start : null, quietEnd: quiet ? end : null, quietMode };
  await prisma.alertSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  refresh();
}

/** Résumé quotidien : alertes des dernières 24 h à l'heure choisie, et mode « résumé seulement ». */
export async function saveDigestAction(formData: FormData) {
  const user = await requireUser();
  const hour = Number(formData.get('heure'));
  const digestOnly = formData.get('seulement') === '1';
  const data = {
    digest: formData.get('resume') === '1' || digestOnly,
    digestOnly,
    digestHour: Number.isInteger(hour) && hour >= 0 && hour < 24 ? hour : 8,
  };
  await prisma.alertSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  refresh();
}

/** Hausse des cartes possédées : seuil en % sur 30 jours (vide ou 0 : désactivée). */
export async function saveCardRiseAction(formData: FormData) {
  const user = await requireUser();
  const n = Math.round(Number(String(formData.get('seuil') ?? '').replace(',', '.')));
  const cardRisePercent = Number.isFinite(n) && n > 0 ? Math.min(n, 500) : null;
  await prisma.alertSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, cardRisePercent },
    update: { cardRisePercent },
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

/** Durée de validité du lien de liaison Telegram. */
const TELEGRAM_LINK_MS = 15 * 60 * 1000;

/** Prépare un lien de liaison Telegram (jeton à usage unique, valable 15 minutes). */
export async function createTelegramLinkAction() {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      telegramLinkToken: randomBytes(18).toString('base64url'),
      telegramLinkExpires: new Date(Date.now() + TELEGRAM_LINK_MS),
    },
  });
  refresh();
}

/** Active ou coupe ses alertes Telegram (même effet que /start et /stop dans le bot). */
export async function setTelegramEnabledAction(enabled: boolean) {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { telegramEnabled: enabled } });
  refresh();
}

/** Délie la conversation Telegram du compte. */
export async function unlinkTelegramAction() {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      telegramChatId: null,
      telegramName: null,
      telegramLinkToken: null,
      telegramLinkExpires: null,
    },
  });
  refresh();
}
