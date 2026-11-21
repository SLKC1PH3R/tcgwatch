import 'server-only';
import { prisma, type AlertType } from '@tcgwatch/db';

/**
 * Product.targetPrice = plus haut bon prix parmi les suiveurs : c'est lui qui déclenche les
 * alertes de prix et la recherche d'annonces ; le worker filtre ensuite par le bon prix de
 * chacun. À rappeler après chaque changement de suivi.
 */
export async function syncProductTarget(productId: string) {
  const top = await prisma.productFollow.aggregate({
    where: { productId, targetPrice: { not: null } },
    _max: { targetPrice: true },
  });
  await prisma.product.update({
    where: { id: productId },
    data: { targetPrice: top._max.targetPrice },
  });
}

/** Suit un produit (ou change son bon prix ; null : suivi sans bon prix). */
export async function setFollowTarget(
  userId: string,
  productId: string,
  targetPrice: number | null,
) {
  await prisma.productFollow.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, targetPrice },
    update: { targetPrice },
  });
  await syncProductTarget(productId);
}

/** Ne suit plus le produit (bon prix et sourdines effacés). */
export async function unfollow(userId: string, productId: string) {
  await prisma.productFollow.deleteMany({ where: { userId, productId } });
  await syncProductTarget(productId);
}

/** Coupe ou rétablit un type d'alerte pour un produit (le suivi est créé au besoin). */
export async function setFollowMute(
  userId: string,
  productId: string,
  type: AlertType,
  mute: boolean,
) {
  const follow = await prisma.productFollow.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { mutedAlerts: true },
  });
  const set = new Set(follow?.mutedAlerts ?? []);
  if (mute) set.add(type);
  else set.delete(type);
  await prisma.productFollow.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, mutedAlerts: [...set] },
    update: { mutedAlerts: [...set] },
  });
}
