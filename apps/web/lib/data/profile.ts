import 'server-only';
import { prisma } from '@tcgwatch/db';
import { setProgress } from '@/lib/card-sets';
import { cardSelectFor, getBinder, getBinders, toCollectionCard } from './card-collection';

/** Réglages de la page publique de collectionneur. */
export async function getProfileSettings(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      profilePublic: true,
      profileSlug: true,
      profileName: true,
      profileBio: true,
      profileBinders: true,
      profileDoubles: true,
      profilePrices: true,
    },
  });
}

/**
 * Page publique d'un collectionneur : seulement si elle est activée. Elle montre ses classeurs
 * d'extension (complétés d'abord), ses vitrines et listes de recherche rendues publiques, et ses
 * doubles. Rien d'autre (ni e-mail, ni prix d'achat, ni scellé).
 */
export async function getPublicProfile(slug: string) {
  const user = await prisma.user.findFirst({
    where: { profileSlug: slug, profilePublic: true },
    select: {
      id: true,
      profileName: true,
      profileBio: true,
      profileBinders: true,
      profileDoubles: true,
      profilePrices: true,
      createdAt: true,
    },
  });
  if (!user) return null;

  const [binders, showcases, doubles, stats] = await Promise.all([
    user.profileBinders ? getBinders(user.id) : [],
    prisma.showcase.findMany({
      where: { userId: user.id, public: true },
      orderBy: { updatedAt: 'desc' },
      select: {
        title: true,
        description: true,
        slug: true,
        wanted: true,
        cards: {
          orderBy: { position: 'asc' },
          take: 4,
          select: { card: { select: { imageUrl: true } } },
        },
        _count: { select: { cards: true } },
      },
    }),
    user.profileDoubles
      ? prisma.ownedCard.findMany({
          where: { userId: user.id, quantity: { gt: 1 } },
          select: { variant: true, quantity: true, card: { select: cardSelectFor(user.id) } },
        })
      : [],
    prisma.ownedCard.aggregate({
      where: { userId: user.id, quantity: { gt: 0 } },
      _sum: { quantity: true },
      _count: { cardId: true },
    }),
  ]);

  const percent = (p: { owned: number; total: number }) => (p.total ? p.owned / p.total : 0);
  // Classeurs vides (personnels sans carte) : rien à montrer.
  const shown = binders.filter((b) => b.progress.full.total > 0);
  return {
    name: user.profileName?.trim() || 'Collectionneur',
    bio: user.profileBio,
    since: user.createdAt,
    showPrices: user.profilePrices,
    stats: {
      copies: stats._sum.quantity ?? 0,
      // Une ligne par carte et par variante : approximation suffisante pour un compteur.
      entries: stats._count.cardId,
      binders: shown.length,
      completed: shown.filter((b) => percent(b.progress.full) >= 1).length,
    },
    binders: shown
      .map((b) => ({
        id: b.id,
        name: b.name,
        logo: b.release?.imageUrl ?? null,
        progress: b.progress,
        complete: percent(b.progress.full) >= 1,
      }))
      .sort(
        (a, b) =>
          Number(b.complete) - Number(a.complete) ||
          percent(b.progress.master ?? b.progress.full) -
            percent(a.progress.master ?? a.progress.full) ||
          a.name.localeCompare(b.name, 'fr'),
      ),
    showcases: showcases.filter((s) => !s.wanted),
    wanted: showcases.filter((s) => s.wanted),
    doubles: doubles
      .map((d) => ({
        variant: d.variant,
        spare: d.quantity - 1,
        card: toCollectionCard(d.card),
      }))
      .sort((a, b) => (b.card.price ?? 0) - (a.card.price ?? 0)),
  };
}

export type PublicProfile = NonNullable<Awaited<ReturnType<typeof getPublicProfile>>>;

/** Classeur d'une page publique : seulement si la page et l'affichage des classeurs sont actifs. */
export async function getPublicBinder(slug: string, id: string) {
  const user = await prisma.user.findFirst({
    where: { profileSlug: slug, profilePublic: true, profileBinders: true },
    select: { id: true, profileName: true, profilePrices: true },
  });
  if (!user) return null;
  const binder = await getBinder(user.id, id);
  if (!binder || binder.cards.length === 0) return null;
  return {
    owner: user.profileName?.trim() || 'Collectionneur',
    showPrices: user.profilePrices,
    name: binder.name,
    description: binder.description,
    isSet: Boolean(binder.release),
    cards: binder.cards,
    progress: binder.release
      ? setProgress(binder.cards)
      : {
          full: {
            owned: binder.cards.filter((c) => c.owned > 0).length,
            total: binder.cards.length,
          },
          master: null,
        },
  };
}
