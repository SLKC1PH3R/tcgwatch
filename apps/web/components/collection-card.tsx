import Link from 'next/link';
import { formatPrice } from '@tcgwatch/shared';
import { SafeImg } from '@/components/safe-img';
import { cn } from '@/lib/utils';
import type { CollectionCard } from '@/lib/data/card-collection';

/**
 * Carte d'un classeur ou d'une vitrine : en couleur si elle est possédée, grisée sinon
 * (`dimMissing`), avec le nombre d'exemplaires et la cote.
 */
export function CollectionCardTile({
  card,
  dimMissing = false,
  showPrice = true,
  showOwned = true,
  link = true,
  reverse = false,
  children,
}: {
  card: CollectionCard;
  dimMissing?: boolean;
  showPrice?: boolean;
  showOwned?: boolean;
  link?: boolean;
  /** Emplacement de la version reverse (Master Set) : reflet et pastille bleue. */
  reverse?: boolean;
  children?: React.ReactNode;
}) {
  const missing = dimMissing && card.owned === 0;
  const img = (
    <div className="relative overflow-hidden rounded-lg">
      <SafeImg
        src={card.image}
        alt={card.name}
        className={cn(
          'aspect-[63/88] w-full rounded-lg bg-muted object-cover transition',
          missing && 'opacity-30 grayscale',
        )}
      />
      {reverse && (
        <>
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/0 via-sky-300/25 to-fuchsia-300/20 mix-blend-screen" />
          <span className="absolute top-1.5 left-1.5 rounded-full bg-info px-1.5 py-0.5 text-[10px] font-bold text-black shadow">
            Reverse
          </span>
        </>
      )}
      {showOwned && card.owned > 0 && (
        <span
          className={cn(
            'absolute top-1.5 right-1.5 rounded-full px-2 py-0.5 text-xs font-bold shadow',
            reverse ? 'bg-info text-black' : 'bg-primary text-primary-foreground',
          )}
        >
          ×{card.owned}
        </span>
      )}
    </div>
  );
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {link ? (
        <Link href={`/cartes/${encodeURIComponent(card.id)}`} className="block">
          {img}
        </Link>
      ) : (
        img
      )}
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className={cn('truncate font-medium', missing && 'text-muted-foreground')}>
          {card.name}
        </span>
        {showPrice && card.price !== null && (
          <span className="shrink-0 text-muted-foreground tabular-nums">
            {formatPrice(card.price)}
          </span>
        )}
      </div>
      <p className="truncate text-[11px] text-muted-foreground">
        n° {card.localId}
        {card.release.total ? `/${card.release.total}` : ''} · {card.release.name}
      </p>
      {children}
    </div>
  );
}
