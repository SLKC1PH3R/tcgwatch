import { ImageResponse } from 'next/og';
import { prisma } from '@tcgwatch/db';
import { OG_SIZE, OgFrame, ogCards, ogText } from '@/lib/og';

export const alt = 'Page de collectionneur Pokémon sur TCGWatch';
export const size = OG_SIZE;
export const contentType = 'image/png';

/**
 * Aperçu du lien d'une page de collectionneur : pseudo, nombre de cartes et de classeurs,
 * carte d'avatar puis les cartes les mieux cotées de la collection.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await prisma.user.findFirst({
    where: { profileSlug: slug, profilePublic: true },
    select: {
      id: true,
      profileName: true,
      profileFavorite: true,
      profileLocation: true,
      profileAvatarCardId: true,
    },
  });
  const [avatar, top, stats, binders] = user
    ? await Promise.all([
        user.profileAvatarCardId
          ? prisma.card.findUnique({
              where: { id: user.profileAvatarCardId },
              select: { imageUrl: true },
            })
          : null,
        prisma.ownedCard.findMany({
          where: { userId: user.id, quantity: { gt: 0 }, card: { imageUrl: { not: null } } },
          orderBy: { card: { priceTrend: { sort: 'desc', nulls: 'last' } } },
          take: 6,
          select: { card: { select: { id: true, imageUrl: true } } },
        }),
        prisma.ownedCard.aggregate({
          where: { userId: user.id, quantity: { gt: 0 } },
          _sum: { quantity: true },
        }),
        prisma.cardBinder.count({ where: { userId: user.id } }),
      ])
    : [null, [], null, 0];
  const urls = [
    avatar?.imageUrl ?? null,
    ...top.filter((t) => t.card.id !== user?.profileAvatarCardId).map((t) => t.card.imageUrl),
  ];
  const images = await ogCards(urls, 4);
  const copies = stats?._sum.quantity ?? 0;
  const fr = new Intl.NumberFormat('fr-FR');
  const details = [user?.profileFavorite && `♥ ${user.profileFavorite}`, user?.profileLocation]
    .filter(Boolean)
    .join(' · ');

  return new ImageResponse(
    <OgFrame
      kicker="Collectionneur Pokémon"
      title={user ? user.profileName?.trim() || 'Collectionneur' : 'Page introuvable'}
      subtitle={
        user
          ? `${fr.format(copies)} carte${copies > 1 ? 's' : ''} · ${binders} classeur${binders > 1 ? 's' : ''}`
          : undefined
      }
      images={images}
    >
      {details && (
        <div style={{ display: 'flex', fontSize: 24, color: '#ffc670' }}>{ogText(details)}</div>
      )}
    </OgFrame>,
    size,
  );
}
