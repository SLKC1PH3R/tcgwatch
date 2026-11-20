import { ImageResponse } from 'next/og';
import { prisma } from '@tcgwatch/db';
import { pokemonTcgLargeImage } from '@tcgwatch/market';
import { formatPrice, toNumber } from '@tcgwatch/shared';

export const alt = 'Vitrine de cartes Pokémon partagée depuis TCGWatch';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Image PNG d'une carte (l'aperçu ne lit pas le WebP) ; null si indisponible. */
function pngImage(base: string | null): string | null {
  if (!base) return null;
  if (base.startsWith('https://assets.tcgdex.net/')) return `${base}/high.png`;
  if (base.startsWith('https://')) return pokemonTcgLargeImage(base);
  return null;
}

/** Image téléchargée et intégrée (data URL) : une image injoignable est simplement omise. */
async function embed(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/^image\/(png|jpe?g)/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
}

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
  const urls = (visible?.cards ?? [])
    .map((c) => pngImage(c.card.imageUrl))
    .filter((u): u is string => u !== null)
    .slice(0, 5);
  const images = (await Promise.all(urls.map(embed))).filter((u): u is string => u !== null);
  const value = (visible?.cards ?? []).reduce((n, c) => n + (toNumber(c.card.priceTrend) ?? 0), 0);
  const count = visible?.cards.length ?? 0;
  const subtitle = visible
    ? [
        `${count} carte${count > 1 ? 's' : ''}`,
        visible.showPrices && value > 0 ? `cote ${formatPrice(value)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
        // Espaces insécables (milliers, « € ») : absentes de la police de l'aperçu.
        .replace(/[\u00a0\u202f]/g, ' ')
    : 'Vitrine privée ou introuvable';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: '#0c0d16',
        color: '#ecedf5',
        padding: 64,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 12,
          background: 'linear-gradient(180deg,#ffd43b,#ff6b9a,#8b7cff,#4fd1ff,#6ee7a0)',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', width: 520, gap: 18 }}>
        <div style={{ display: 'flex', fontSize: 26, color: '#ffd43b', fontWeight: 700 }}>
          {visible?.wanted ? 'JE CHERCHE' : 'VITRINE'}
        </div>
        <div style={{ display: 'flex', fontSize: 60, fontWeight: 800, lineHeight: 1.05 }}>
          {visible?.title ?? 'TCGWatch'}
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#b4b6c8' }}>{subtitle}</div>
        <div style={{ display: 'flex', marginTop: 'auto', fontSize: 24, color: '#7d8098' }}>
          Partagé depuis TCGWatch
        </div>
      </div>
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            width={250}
            height={349}
            style={{
              position: 'absolute',
              top: 60 + Math.abs(i - (images.length - 1) / 2) * 18,
              left: i * 75,
              borderRadius: 14,
              transform: `rotate(${(i - (images.length - 1) / 2) * 6}deg)`,
              boxShadow: '0 20px 40px rgba(0,0,0,.5)',
            }}
          />
        ))}
      </div>
    </div>,
    size,
  );
}
