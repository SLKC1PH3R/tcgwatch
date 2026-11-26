import { ImageResponse } from 'next/og';
import { prisma } from '@tcgwatch/db';
import { formatPrice, toNumber } from '@tcgwatch/shared';
import { OG_SIZE, OgFrame, ogCards } from '@/lib/og';

export const alt = 'Vitrine de cartes Pokémon partagée depuis TCGWatch';
export const size = OG_SIZE;
export const contentType = 'image/png';

/**
 * Aperçu affiché quand le lien d'une vitrine est collé sur Discord, WhatsApp, iMessage… :
 * titre, nombre de cartes, cote (si affichée) et les premières cartes en éventail.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await prisma.showcase.findUnique({
    where: { slug },
    select: {
      title: true,
      public: true,
      showPrices: true,
      wanted: true,
      cards: {
        orderBy: { position: 'asc' },
        select: { card: { select: { imageUrl: true, priceTrend: true } } },
      },
    },
  });
  const visible = s?.public ? s : null;
  const cards = visible?.cards ?? [];
  const images = await ogCards(cards.map((c) => c.card.imageUrl));
  const value = cards.reduce((n, c) => n + (toNumber(c.card.priceTrend) ?? 0), 0);
  const subtitle = visible
    ? [
        `${cards.length} carte${cards.length > 1 ? 's' : ''}`,
        visible.showPrices && value > 0 ? `cote ${formatPrice(value)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Vitrine privée ou introuvable';

  return new ImageResponse(
    <OgFrame
      kicker={visible?.wanted ? 'Je cherche' : 'Vitrine'}
      title={visible?.title ?? 'TCGWatch'}
      subtitle={subtitle}
      images={images}
    />,
    size,
  );
}
