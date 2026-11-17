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
  children,
}: {
  card: CollectionCard;
  dimMissing?: boolean;
  showPrice?: boolean;
  showOwned?: boolean;
  link?: boolean;
  children?: React.ReactNode;
}) {
  const missing = dimMissing && card.owned === 0;
  const img = (
    <div className="relative">
      <SafeImg
        src={card.image}
        alt={card.name}
        className={cn(
          'aspect-[63/88] w-full rounded-lg bg-muted object-cover transition',
          missing && 'opacity-30 grayscale',
        )}
      />
      {showOwned && card.owned > 0 && (
        <span className="absolute top-1.5 right-1.5 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground shadow">
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
