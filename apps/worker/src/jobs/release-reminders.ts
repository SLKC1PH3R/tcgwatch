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
 * La veille d'une sortie : un seul rappel regroupant les produits suivis (Mes produits ou
 * fiches revendeurs actives) qui sortent le lendemain (date du produit, sinon de sa sortie).
 */
export async function runReleaseReminders(ctx: WorkerContext): Promise<number> {
  const tomorrow = new Date(todayUtc().getTime() + DAY_MS);
  const followed = {
    OR: [
      { targetPrice: { not: null } },
      { listings: { some: { state: { not: 'PAUSED' as const } } } },
    ],
  };
  const products = await prisma.product.findMany({
    where: {
      AND: [
        followed,
        {
          OR: [
            { releaseDate: tomorrow },
            { releaseDate: null, release: { releaseDate: tomorrow } },
          ],
        },
      ],
    },
    select: { id: true, name: true, targetPrice: true },
    orderBy: [{ targetPrice: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
  });
  if (products.length === 0) return 0;

  const day = tomorrow.toISOString().slice(0, 10);
  const single = products.length === 1 ? products[0]! : null;
  await dispatchAlert(ctx, {
    type: 'RELEASE_DATE',
    dedupeKey: `RELEASE_REMINDER:${day}`,
    productId: single?.id,
    title: single
      ? `📅 Sortie demain : ${single.name}`
      : `📅 Demain, ${products.length} produits suivis sortent`,
    message: single ? 'Pense à vérifier les boutiques dès l’ouverture.' : reminderMessage(products),
    url: single ? `${ctx.env.APP_URL}/produits/${single.id}` : `${ctx.env.APP_URL}/calendrier`,
    linkLabel: single ? 'Voir le produit' : 'Voir le calendrier',
    priority: 'default',
    tags: ['date'],
  });
  ctx.logger.info({ day, products: products.length }, 'Rappel des sorties du lendemain');
  return products.length;
}
