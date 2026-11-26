'use client';

import { Check, Minus } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { formatPrice } from '@tcgwatch/shared';
import { CardPlaceholder } from '@/components/collection-card';
import { SafeImg } from '@/components/safe-img';
import { Button } from '@/components/ui/button';
import { hasReverseSlot } from '@/lib/card-sets';
import type { CollectionCard } from '@/lib/data/card-collection';
import { cn } from '@/lib/utils';
import { saveOpeningCardsAction } from '../actions';

type Variant = 'normal' | 'reverse';
type Counts = Record<Variant, Record<string, number>>;

/**
 * Cartes tirées d'un produit : un toucher = une carte de plus (normale ou reverse selon le mode),
 * total au prix Cardmarket et eBay FR mis à jour en direct.
 */
export function OpeningEditor({
  id,
  cards,
  initial,
  price,
}: {
  id: string;
  cards: CollectionCard[];
  initial: { cardId: string; variant: string; quantity: number }[];
  price: number;
}) {
  const start0 = useMemo(() => {
    const c: Counts = { normal: {}, reverse: {} };
    for (const r of initial) {
      if (r.variant === 'normal' || r.variant === 'reverse') c[r.variant][r.cardId] = r.quantity;
    }
    return c;
  }, [initial]);
  const [counts, setCounts] = useState<Counts>(start0);
  const [variant, setVariant] = useState<Variant>('normal');
  const [onlyPulled, setOnlyPulled] = useState(initial.length > 0);
  const [addToCollection, setAddToCollection] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const hasReverses = cards.some(hasReverseSlot);

  const set = (cardId: string, v: Variant, n: number) => {
    setMessage(null);
    setCounts((c) => ({ ...c, [v]: { ...c[v], [cardId]: Math.max(0, Math.min(999, n)) } }));
  };
  const total = (card: CollectionCard) =>
    (counts.normal[card.id] ?? 0) + (counts.reverse[card.id] ?? 0);
  const value = cards.reduce(
    (acc, c) => {
      const n = total(c);
      return { cm: acc.cm + n * (c.price ?? 0), fr: acc.fr + n * (c.frPrice ?? 0) };
    },
    { cm: 0, fr: 0 },
  );
  const pulled = cards.reduce((n, c) => n + total(c), 0);
  const shown = onlyPulled ? cards.filter((c) => total(c) > 0) : cards;

  const save = () =>
    start(async () => {
      const res = await saveOpeningCardsAction(id, { ...counts, addToCollection });
      setMessage(
        res.error ??
          `${res.saved} carte${res.saved > 1 ? 's' : ''} enregistrée${res.saved > 1 ? 's' : ''}${addToCollection ? ', collection mise à jour' : ''}`,
      );
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border bg-card px-3 py-2">
        {hasReverses && (
          <div role="group" aria-label="Variante ajoutée" className="flex rounded-lg border p-0.5">
            {(['normal', 'reverse'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={variant === v}
                onClick={() => setVariant(v)}
                className={cn(
                  'h-8 rounded-md px-3 text-sm font-medium',
                  variant === v
                    ? v === 'reverse'
                      ? 'bg-info text-black'
                      : 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent',
                )}
              >
                {v === 'normal' ? 'Normale' : 'Reverse'}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1">
          {[
            { on: false, label: 'Toutes' },
            { on: true, label: `Tirées · ${pulled}` },
          ].map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={onlyPulled === f.on}
              onClick={() => setOnlyPulled(f.on)}
              className={cn(
                'h-8 rounded-full border px-3 text-sm',
                onlyPulled === f.on && 'border-primary bg-primary/15 text-primary',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatPrice(value.cm)} Cardmarket ·{' '}
          <span className="text-info">{formatPrice(value.fr)} FR</span> · payé {formatPrice(price)}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={addToCollection}
              onChange={(e) => setAddToCollection(e.target.checked)}
              className="size-4 accent-primary"
            />
            Ajouter à ma collection
          </label>
          <Button type="button" onClick={save} disabled={pending}>
            <Check /> {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
      {message && <p className="shrink-0 text-sm text-success">{message}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucune carte tirée pour l’instant : affichez « Toutes » et touchez les cartes sorties.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
            {shown.map((c) => {
              const n = counts.normal[c.id] ?? 0;
              const r = counts.reverse[c.id] ?? 0;
              const current = variant === 'reverse' ? r : n;
              const canReverse = variant !== 'reverse' || hasReverseSlot(c);
              return (
                <li key={c.id} className="relative min-w-0">
                  <button
                    type="button"
                    disabled={!canReverse}
                    onClick={() => set(c.id, variant, current + 1)}
                    aria-label={`${c.name} n° ${c.localId} : ajouter une ${variant === 'reverse' ? 'reverse' : 'carte'}`}
                    className={cn(
                      'block w-full overflow-hidden rounded-lg transition disabled:cursor-not-allowed',
                      n + r > 0 && 'ring-2 ring-primary',
                    )}
                  >
                    <SafeImg
                      src={c.image}
                      alt=""
                      fallback={
                        <CardPlaceholder
                          name={c.name}
                          localId={c.localId}
                          className={cn(n + r === 0 && 'opacity-50')}
                        />
                      }
                      className={cn(
                        'aspect-[63/88] w-full rounded-lg bg-muted object-cover',
                        n + r === 0 && 'opacity-35 grayscale',
                      )}
                    />
                  </button>
                  <div className="pointer-events-none absolute top-1 right-1 flex flex-col items-end gap-0.5">
                    {n > 0 && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground shadow">
                        ×{n}
                      </span>
                    )}
                    {r > 0 && (
                      <span className="rounded-full bg-info px-1.5 py-0.5 text-[10px] font-bold text-black shadow">
                        R×{r}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <span className="truncate text-[11px] text-muted-foreground">
                      {c.localId} · {c.name}
                    </span>
                    {current > 0 && (
                      <button
                        type="button"
                        onClick={() => set(c.id, variant, current - 1)}
                        aria-label={`Retirer une ${variant === 'reverse' ? 'reverse' : 'carte'} ${c.name}`}
                        className="grid size-6 shrink-0 place-items-center rounded-md border hover:bg-accent"
                      >
                        <Minus className="size-3" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
