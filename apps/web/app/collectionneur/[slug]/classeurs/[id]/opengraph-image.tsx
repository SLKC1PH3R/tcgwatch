import { ImageResponse } from 'next/og';
import { prisma } from '@tcgwatch/db';
import { getPublicBinder } from '@/lib/data/profile';
import { OG_SIZE, OgFrame, OgProgress, ogCards } from '@/lib/og';

export const alt = 'Classeur de cartes Pokémon partagé depuis TCGWatch';
export const size = OG_SIZE;
export const contentType = 'image/png';

/**
 * Aperçu du lien d'un classeur public : nom, propriétaire, avancement Full Set et Master Set,
 * et les cartes possédées les mieux cotées.
 */
export default async function Image({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const b = await getPublicBinder(slug, id);
  const owned = (b?.cards ?? [])
    .filter((c) => c.owned > 0)
    .sort((x, y) => (y.price ?? 0) - (x.price ?? 0))
    .slice(0, 5)
    .map((c) => c.id);
  // Images d'origine (l'aperçu veut du PNG, pas le WebP réduit de la collection).
  const rows = owned.length
    ? await prisma.card.findMany({
        where: { id: { in: owned } },
        select: { id: true, imageUrl: true },
      })
    : [];
  const byId = new Map(rows.map((r) => [r.id, r.imageUrl]));
  const images = await ogCards(owned.map((cid) => byId.get(cid) ?? null));
  const progress = b?.progress ?? null;

  return new ImageResponse(
    <OgFrame
      kicker={b ? `Classeur de ${b.owner}` : 'Classeur'}
      title={b?.name ?? 'Classeur introuvable'}
      images={images}
    >
      {progress && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 24 }}>
          <OgProgress
            label="Full Set"
            owned={progress.full.owned}
            total={progress.full.total}
            colors={['#8f6bf5', '#c4b5fd']}
          />
          {progress.master && (
            <OgProgress
              label="Master Set"
              owned={progress.master.owned}
              total={progress.master.total}
              colors={['#f2733d', '#ffc670']}
            />
          )}
        </div>
      )}
    </OgFrame>,
    size,
  );
}
