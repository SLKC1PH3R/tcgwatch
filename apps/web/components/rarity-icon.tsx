import { rarityInfo, type RarityKey, type RaritySymbol } from '@tcgwatch/shared';
import { cn } from '@/lib/utils';

const STAR = 'M6 0.6l1.6 3.5 3.8.4-2.9 2.6.8 3.8L6 9 2.7 10.9l.8-3.8L.6 4.5l3.8-.4z';
const DIAMOND = 'M6 .8L11 6 6 11.2 1 6z';

/** Remplissage et contour de chaque teinte (dégradés partagés : mêmes identifiants partout). */
const TONES: Record<RaritySymbol['tone'], { fill: string; stroke: string }> = {
  ink: { fill: 'currentColor', stroke: 'none' },
  silver: { fill: 'url(#rarity-silver)', stroke: '#64748b' },
  gold: { fill: 'url(#rarity-gold)', stroke: '#a16207' },
  rainbow: { fill: 'url(#rarity-rainbow)', stroke: '#7c3aed' },
  pink: { fill: '#ec4899', stroke: '#9d174d' },
  shiny: { fill: 'url(#rarity-gold)', stroke: '#a16207' },
};

function Defs() {
  return (
    <defs>
      <linearGradient id="rarity-silver" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f8fafc" />
        <stop offset="1" stopColor="#94a3b8" />
      </linearGradient>
      <linearGradient id="rarity-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fde68a" />
        <stop offset=".55" stopColor="#f59e0b" />
        <stop offset="1" stopColor="#b45309" />
      </linearGradient>
      <linearGradient id="rarity-rainbow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f43f5e" />
        <stop offset=".3" stopColor="#f59e0b" />
        <stop offset=".55" stopColor="#22c55e" />
        <stop offset=".8" stopColor="#3b82f6" />
        <stop offset="1" stopColor="#a855f7" />
      </linearGradient>
    </defs>
  );
}

function Glyph({ symbol, x }: { symbol: RaritySymbol; x: number }) {
  const tone = TONES[symbol.tone];
  const common = {
    fill: tone.fill,
    stroke: tone.stroke,
    strokeWidth: tone.stroke === 'none' ? 0 : 0.7,
    strokeLinejoin: 'round' as const,
    transform: `translate(${x} 0)`,
  };
  switch (symbol.shape) {
    case 'circle':
      return <circle cx={x + 6} cy={6} r={4.2} fill={tone.fill} />;
    case 'diamond':
      return <path d={DIAMOND} {...common} />;
    case 'crown':
      return <path d="M1 9.5h10l.6-6-3 2.3L6 1.5 3.4 5.8.4 3.5z" {...common} />;
    default:
      return <path d={STAR} {...common} />;
  }
}

/**
 * Symbole d'une rareté, dessiné comme sur les cartes : rond, losange, étoile(s) noires,
 * argentées ou dorées, couronne Pocket… avec sa mention éventuelle (V, VMAX, LV.X…).
 */
export function RarityIcon({ rarity, className }: { rarity: RarityKey; className?: string }) {
  const { symbol, label } = rarityInfo(rarity);
  if (symbol.shape === 'promo') {
    return (
      <span
        role="img"
        aria-label={label}
        className={cn(
          'inline-flex h-4 items-center rounded-[3px] bg-foreground px-1 text-[8px] leading-none font-black tracking-tight text-background',
          className,
        )}
      >
        PROMO
      </span>
    );
  }
  if (symbol.shape === 'none') {
    return (
      <svg viewBox="0 0 12 12" role="img" aria-label={label} className={cn('h-4 w-4', className)}>
        <circle
          cx="6"
          cy="6"
          r="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity=".6"
        />
      </svg>
    );
  }
  // Symboles serrés comme sur les cartes (les étoiles se chevauchent légèrement).
  const step = symbol.shape === 'circle' ? 12 : 9.5;
  const width = 12 + step * (symbol.count - 1);
  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      <svg
        viewBox={`0 0 ${width} 12`}
        className="h-4 shrink-0 overflow-visible"
        style={{ width: `${width / 12}rem` }}
        aria-hidden
      >
        <Defs />
        {Array.from({ length: symbol.count }, (_, i) => (
          <Glyph key={i} symbol={symbol} x={i * step} />
        ))}
        {symbol.tone === 'shiny' && (
          <path
            d={`M${width - 1.6} .2l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z`}
            fill="#fde047"
            stroke="#a16207"
            strokeWidth=".3"
          />
        )}
      </svg>
      {'mark' in symbol && symbol.mark && (
        <span className="text-[9px] leading-none font-black tracking-tight opacity-80">
          {symbol.mark}
        </span>
      )}
    </span>
  );
}
