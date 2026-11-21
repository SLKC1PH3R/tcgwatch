import { prisma } from '@tcgwatch/db';
import { todayUtc } from '@tcgwatch/shared';
import type { WorkerContext } from '../context';
import { dispatchAlert } from './dispatch';

const DAY_MS = 86_400_000;
/** Produits cités par leur nom dans le rappel ; au-delà, « et N autres ». */
const NAMED = 6;

export interface ReleasingProduct {
  id: string;
  name: string;
}

/** Texte du rappel : « ETB X, Display X et 3 autres ». */
export function reminderMessage(products: ReleasingProduct[]): string {
  const names = products.slice(0, NAMED).map((p) => p.name);
  const rest = products.length - names.length;
  if (rest > 0) return `${names.join(', ')} et ${rest} autre${rest > 1 ? 's' : ''}.`;
  if (names.length <= 1) return `${names[0] ?? ''}.`;
  return `${names.slice(0, -1).join(', ')} et ${names.at(-1)}.`;
}

/**
 * La veille d'une sortie : un rappel par utilisateur, regroupant ses produits suivis qui sortent
 * le lendemain (date du produit, sinon de sa sortie). Les administrateurs reçoivent aussi les
 * produits suivis chez les revendeurs (fiches actives).
 */
export async function runReleaseReminders(ctx: WorkerContext): Promise<number> {
  const tomorrow = new Date(todayUtc().getTime() + DAY_MS);
  const products = await prisma.product.findMany({
    where: {
      AND: [
        {
          OR: [
            { follows: { some: {} } },
            { listings: { some: { state: { not: 'PAUSED' as const } } } },
          ],
        },
        {
          OR: [
            { releaseDate: tomorrow },
            { releaseDate: null, release: { releaseDate: tomorrow } },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      targetPrice: true,
      follows: { select: { userId: true } },
      _count: { select: { listings: { where: { state: { not: 'PAUSED' } } } } },
    },
    orderBy: [{ targetPrice: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
  });
  if (products.length === 0) return 0;

  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  const perUser = new Map<string, ReleasingProduct[]>();
  const add = (userId: string, p: ReleasingProduct) =>
    perUser.set(userId, [...(perUser.get(userId) ?? []), p]);
  for (const p of products) {
    const followers = new Set(p.follows.map((f) => f.userId));
    if (p._count.listings > 0) for (const a of admins) followers.add(a.id);
    for (const userId of followers) add(userId, p);
  }

  const day = tomorrow.toISOString().slice(0, 10);
  for (const [userId, list] of perUser) {
    const single = list.length === 1 ? list[0]! : null;
    await dispatchAlert(ctx, {
      type: 'RELEASE_DATE',
      dedupeKey: `RELEASE_REMINDER:${day}`,
      recipients: [userId],
      productId: single?.id,
      title: single
        ? `📅 Sortie demain : ${single.name}`
        : `📅 Demain, ${list.length} produits suivis sortent`,
      message: single ? 'Pense à vérifier les boutiques dès l’ouverture.' : reminderMessage(list),
      url: single ? `${ctx.env.APP_URL}/produits/${single.id}` : `${ctx.env.APP_URL}/calendrier`,
      linkLabel: single ? 'Voir le produit' : 'Voir le calendrier',
      priority: 'default',
      tags: ['date'],
    });
  }
  ctx.logger.info(
    { day, products: products.length, users: perUser.size },
    'Rappel des sorties du lendemain',
  );
  return products.length;
}
