import 'server-only';
import { pokemonTcgLargeImage } from '@tcgwatch/market';

/** Taille des aperçus de liens (Open Graph). */
export const OG_SIZE = { width: 1200, height: 630 };

/** Image PNG d'une carte (l'aperçu ne lit pas le WebP) ; null si indisponible. */
export function ogCardImage(base: string | null): string | null {
  if (!base) return null;
  if (base.startsWith('https://assets.tcgdex.net/')) return `${base}/high.png`;
  if (base.startsWith('https://images.pokemontcg.io/')) return pokemonTcgLargeImage(base);
  return null;
}

/** Image téléchargée et intégrée (data URL) : une image injoignable est simplement omise. */
export async function ogEmbed(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/^image\/(png|jpe?g)/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
}

/** Jusqu'à `max` images de cartes intégrées, dans l'ordre. */
export async function ogCards(imageUrls: (string | null)[], max = 5): Promise<string[]> {
  const urls = imageUrls
    .map(ogCardImage)
    .filter((u): u is string => u !== null)
    .slice(0, max);
  return (await Promise.all(urls.map(ogEmbed))).filter((u): u is string => u !== null);
}

/** Espaces insécables (milliers, symbole euro) : absentes de la police de l'aperçu. */
export const ogText = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

/**
 * Mise en page commune des aperçus, dans l'identité « scanner » : fond nuit, halo violet,
 * logo TCGWATCH, surtitre en capitales espacées, titre, sous-titre, bloc libre et cartes en
 * éventail à droite.
 */
export function OgFrame({
  kicker,
  title,
  subtitle,
  images,
  children,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  images: string[];
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background:
          'radial-gradient(ellipse 70% 60% at 85% 10%, rgba(124,58,237,0.35), transparent 70%), #050508',
        color: '#ece9ff',
        padding: '56px 64px',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', width: 560, gap: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: 4,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: '#ffd43b',
              boxShadow: '0 0 18px #ffd43b',
            }}
          />
          TCGWATCH
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 30,
            fontSize: 22,
            letterSpacing: 5,
            color: '#c4b5fd',
          }}
        >
          {ogText(kicker.toUpperCase())}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: title.length > 26 ? 52 : 64,
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: -2,
            color: '#e4dcff',
          }}
        >
          {ogText(title)}
        </div>
        {subtitle && (
          <div style={{ display: 'flex', fontSize: 28, color: 'rgba(236,233,255,0.68)' }}>
            {ogText(subtitle)}
          </div>
        )}
        {children}
      </div>
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            width={240}
            height={335}
            style={{
              position: 'absolute',
              top: 90 + Math.abs(i - (images.length - 1) / 2) * 18,
              left: i * (images.length > 3 ? 70 : 110),
              borderRadius: 14,
              transform: `rotate(${(i - (images.length - 1) / 2) * 6}deg)`,
              boxShadow: '0 20px 40px rgba(0,0,0,.55), 0 0 40px rgba(139,92,246,.25)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Barre d'avancement (Full Set, Master Set) pour un aperçu. */
export function OgProgress({
  label,
  owned,
  total,
  colors,
}: {
  label: string;
  owned: number;
  total: number;
  colors: [string, string];
}) {
  const pct = total ? Math.round((owned / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 460 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 20,
          letterSpacing: 2,
          color: 'rgba(236,233,255,0.68)',
        }}
      >
        <span>{label.toUpperCase()}</span>
        <span style={{ color: '#ece9ff' }}>
          {owned}/{total} · {pct} %
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          height: 12,
          borderRadius: 6,
          background: 'rgba(196,181,253,0.14)',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: `${Math.max(2, pct)}%`,
            height: 12,
            borderRadius: 6,
            background: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`,
          }}
        />
      </div>
    </div>
  );
}
