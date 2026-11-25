import { prisma } from '@tcgwatch/db';
import { getCurrentUser } from '@/lib/auth';

/** Export RGPD : toutes les données du compte, en JSON. */
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return new Response('Non autorisé', { status: 401 });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: current.id },
    select: {
      email: true,
      name: true,
      role: true,
      emailVerifiedAt: true,
      googleId: true,
      profilePublic: true,
      profileSlug: true,
      profileName: true,
      profileBio: true,
      profileBinders: true,
      profileDoubles: true,
      profilePrices: true,
      createdAt: true,
      alertSettings: { select: { quietStart: true, quietEnd: true, mutedTypes: true } },
      follows: {
        select: {
          targetPrice: true,
          mutedAlerts: true,
          createdAt: true,
          product: { select: { id: true, name: true } },
        },
      },
      collection: { include: { product: { select: { id: true, name: true } } } },
      ownedCards: {
        select: {
          cardId: true,
          variant: true,
          quantity: true,
          purchasePrice: true,
          purchasedAt: true,
          createdAt: true,
        },
      },
      binders: { include: { cards: { select: { cardId: true, position: true } } } },
      showcases: { include: { cards: { select: { cardId: true, position: true } } } },
      cardLots: true,
      openings: {
        include: {
          product: { select: { id: true, name: true } },
          cards: { select: { cardId: true, variant: true, quantity: true } },
        },
      },
      alerts: {
        orderBy: { createdAt: 'desc' },
        select: { type: true, title: true, message: true, url: true, createdAt: true },
      },
      pushDevices: { select: { userAgent: true, createdAt: true } },
      sessions: { select: { userAgent: true, createdAt: true, expiresAt: true } },
    },
  });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify({ exportedAt: new Date(), user }, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="tcgwatch-mes-donnees-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
