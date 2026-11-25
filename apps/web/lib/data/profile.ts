import 'server-only';
import { prisma } from '@tcgwatch/db';
import { tcgdexAsset } from '@tcgwatch/market';
import { setProgress } from '@/lib/card-sets';
import {
  cardSelectFor,
  getBinder,
  getBinders,
  getShowcase,
  toCollectionCard,
} from './card-collection';

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
      profileAvatarCardId: true,
      profileAccent: true,
      profileFavorite: true,
      profileLocation: true,
      profileContact: true,
      profileFeaturedId: true,
      profileShowcases: true,
      profileWanted: true,
    },
  });
}

/** Cartes proposées comme avatar : les plus chères de la collection, avec une image. */
export async function getAvatarChoices(userId: string, current: string | null) {
  const cards = await prisma.card.findMany({
    where: {
      owned: { some: { userId, quantity: { gt: 0 } } },
      imageUrl: { not: null },
    },
    orderBy: { priceTrend: { sort: 'desc', nulls: 'last' } },
    take: 24,
    select: { id: true, name: true, imageUrl: true },
  });
  if (current && !cards.some((c) => c.id === current)) {
    const c = await prisma.card.findUnique({
      where: { id: current },
      select: { id: true, name: true, imageUrl: true },
    });
    if (c) cards.unshift(c);
  }
  return cards.map((c) => ({ id: c.id, name: c.name, image: cardImage(c.imageUrl) }));
}

const cardImage = (url: string | null, size: '/low.webp' | '/high.webp' = '/low.webp') =>
  tcgdexAsset(url ?? undefined, size) ?? null;

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
      profileAvatarCardId: true,
      profileAccent: true,
      profileFavorite: true,
      profileLocation: true,
      profileContact: true,
      profileFeaturedId: true,
      profileShowcases: true,
      profileWanted: true,
      createdAt: true,
    },
  });
  if (!user) return null;

  const [binders, showcases, doubles, stats, avatar, featured] = await Promise.all([
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
    user.profileAvatarCardId
      ? prisma.card.findUnique({
          where: { id: user.profileAvatarCardId },
          select: { name: true, imageUrl: true },
        })
      : null,
    user.profileFeaturedId ? getShowcase({ id: user.profileFeaturedId, userId: user.id }) : null,
  ]);

  const percent = (p: { owned: number; total: number }) => (p.total ? p.owned / p.total : 0);
  // Classeurs vides (personnels sans carte) : rien à montrer.
  const shown = binders.filter((b) => b.progress.full.total > 0);
  return {
    name: user.profileName?.trim() || 'Collectionneur',
    bio: user.profileBio,
    since: user.createdAt,
    showPrices: user.profilePrices,
    accent: user.profileAccent,
    favorite: user.profileFavorite,
    location: user.profileLocation,
    contact: user.profileContact,
    avatar: avatar?.imageUrl
      ? { name: avatar.name, image: cardImage(avatar.imageUrl, '/high.webp') }
      : null,
    featured: featured?.public && featured.cards.length > 0 ? featured : null,
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
    showcases: user.profileShowcases
      ? showcases.filter((s) => !s.wanted && s.slug !== featured?.slug)
      : [],
    wanted: user.profileWanted ? showcases.filter((s) => s.wanted) : [],
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
