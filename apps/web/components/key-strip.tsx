import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface KeyFigure {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  valueClass?: string;
  hintClass?: string;
  href?: string;
}

/**
 * Bandeau de chiffres clés (identité « scanner ») : cases séparées par un filet, étiquette en
 * capitales mono, valeur en grand.
 */
export function KeyStrip({ items, className }: { items: KeyFigure[]; className?: string }) {
  const cols =
    items.length >= 4
      ? 'sm:grid-cols-2 xl:grid-cols-4'
      : items.length === 3
        ? 'sm:grid-cols-3'
        : 'sm:grid-cols-2';
  return (
    <div
      className={cn(
        'card-frame grid shrink-0 gap-px overflow-hidden rounded-[1.375rem] border bg-border shadow-(--card-shadow)',
        cols,
        className,
      )}
    >
      {items.map((k) => {
        const body = (
          <>
            <p className="label-mono text-muted-foreground">{k.label}</p>
            <p
              className={cn(
                'mt-1.5 truncate font-display text-2xl font-bold tabular-nums',
                k.valueClass,
              )}
            >
              {k.value}
            </p>
            {k.hint && (
              <p className={cn('line-clamp-2 text-xs text-muted-foreground', k.hintClass)}>
                {k.hint}
              </p>
            )}
          </>
        );
        return k.href ? (
          <Link
            key={k.label}
            href={k.href}
            className="min-w-0 bg-card px-5 py-4 transition-colors hover:bg-accent/60"
          >
            {body}
          </Link>
        ) : (
          <div key={k.label} className="min-w-0 bg-card px-5 py-4">
            {body}
          </div>
        );
      })}
    </div>
  );
}
