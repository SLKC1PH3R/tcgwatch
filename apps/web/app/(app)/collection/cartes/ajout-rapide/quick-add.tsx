'use client';

import { Check, Minus } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { SafeImg } from '@/components/safe-img';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type CardFilters, filterCards, hasReverse, rarityCounts } from '@/lib/card-filters';
import type { CollectionCard } from '@/lib/data/card-collection';
import { fitCard, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';
import { saveQuickAddAction } from '../actions';

type Variant = 'normal' | 'reverse';
type Counts = Record<Variant, Record<string, number>>;
const FILTERS = [
  { key: 'toutes', label: 'Toutes' },
  { key: 'manquantes', label: 'Manquantes' },
  { key: 'possedees', label: 'Possédées' },
] as const;

const initial = (cards: CollectionCard[]): Counts => ({
  normal: Object.fromEntries(cards.map((c) => [c.id, c.byVariant.normal ?? 0])),
  reverse: Object.fromEntries(cards.map((c) => [c.id, c.byVariant.reverse ?? 0])),
});

export function QuickAdd({
  code,
  name,
  cards,
}: {
  code: string;
  name: string;
  cards: CollectionCard[];
}) {
  const [saved, setSaved] = useState<Counts>(() => initial(cards));
  const [counts, setCounts] = useState<Counts>(() => initial(cards));
  const [variant, setVariant] = useState<Variant>('normal');
  const [filter, setFilter] = useState<CardFilters['owned']>('toutes');
  const [rarities, setRarities] = useState<CardFilters['rarities']>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const changed = useMemo(() => {
    const out: Record<Variant, Record<string, number>> = { normal: {}, reverse: {} };
    for (const v of ['normal', 'reverse'] as const) {
      for (const id of Object.keys(counts[v])) {
        if (counts[v][id] !== saved[v][id]) out[v][id] = counts[v][id]!;
      }
    }
    return out;
  }, [counts, saved]);
  const changes = Object.keys(changed.normal).length + Object.keys(changed.reverse).length;
  const total = (id: string) => (counts.normal[id] ?? 0) + (counts.reverse[id] ?? 0);
  const ownedCount = cards.filter((c) => total(c.id) > 0).length;
  const groups = useMemo(() => rarityCounts(cards), [cards]);
  // En mode reverse, seules les cartes qui existent en reverse sont proposées.
  const shown = filterCards(
    cards,
    { rarities, reverse: variant === 'reverse', owned: filter },
    (c) => total(c.id),
  );
  const reverseCount = useMemo(() => cards.filter(hasReverse).length, [cards]);
  const toggleRarity = (key: CardFilters['rarities'][number]) =>
    setRarities((r) => (r.includes(key) ? r.filter((k) => k !== key) : [...r, key]));

  const set = (id: string, n: number) => {
    setMessage(null);
    setCounts((c) => ({ ...c, [variant]: { ...c[variant], [id]: Math.max(0, Math.min(999, n)) } }));
  };
  const setAll = (n: (current: number) => number) => {
    setMessage(null);
    setCounts((c) => ({
      ...c,
      [variant]: Object.fromEntries(shown.map((card) => [card.id, n(c[variant][card.id] ?? 0)])),
    }));
  };
  const save = () =>
    startTransition(async () => {
      for (const v of ['normal', 'reverse'] as const) {
        if (Object.keys(changed[v]).length === 0) continue;
        const res = await saveQuickAddAction(code, { variant: v, quantities: changed[v] });
        if (res.error) {
          setMessage(res.error);
          return;
        }
      }
      setSaved(counts);
      setMessage(`${changes} carte${changes > 1 ? 's' : ''} enregistrée${changes > 1 ? 's' : ''}`);
    });

  // Ajouts en cours (pas encore enregistrés) : écart de quantité par carte et variante.
  const pendingList = (['normal', 'reverse'] as const).flatMap((v) =>
    Object.entries(changed[v]).map(([id, n]) => ({
      id,
      v,
      card: cards.find((c) => c.id === id),
      delta: n - (saved[v][id] ?? 0),
    })),
  );

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_17rem] fit:min-h-0 [&>*]:min-w-0">
      <Card className={cn(fitCard, 'px-4')}>
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur fit:static fit:shadow-none">
          <div role="group" aria-label="Variante" className="flex rounded-lg border p-0.5">
            {(['normal', 'reverse'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={variant === v}
                onClick={() => setVariant(v)}
                className={cn(
                  'h-8 rounded-md px-3 text-sm font-medium',
                  variant === v ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                )}
              >
                {v === 'normal' ? 'Normale' : `Reverse (${reverseCount})`}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'h-8 rounded-full border px-3 text-sm',
                  filter === f.key && 'border-primary bg-primary/15 text-primary',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">
            {ownedCount}/{cards.length} · {name}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAll((n) => Math.max(n, 1))}
            >
              Tout cocher
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAll(() => 0)}>
              Tout décocher
            </Button>
            <Button type="button" size="sm" disabled={changes === 0 || pending} onClick={save}>
              <Check />
              {pending ? 'Enregistrement…' : changes ? `Enregistrer (${changes})` : 'Enregistré'}
            </Button>
          </div>
          {groups.length > 1 && (
            <div role="group" aria-label="Rareté" className="flex w-full flex-wrap gap-1">
              <button
                type="button"
                aria-pressed={rarities.length === 0}
                onClick={() => setRarities([])}
                className={cn(
                  'h-7 rounded-full border px-2.5 text-xs',
                  rarities.length === 0 && 'border-primary bg-primary/15 text-primary',
                )}
              >
                Toutes raretés
              </button>
              {groups.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  aria-pressed={rarities.includes(g.key)}
                  onClick={() => toggleRarity(g.key)}
                  className={cn(
                    'h-7 rounded-full border px-2.5 text-xs',
                    rarities.includes(g.key) && 'border-primary bg-primary/15 text-primary',
                  )}
                >
                  {g.label} <span className="text-muted-foreground tabular-nums">{g.count}</span>
                </button>
              ))}
            </div>
          )}
          {message && (
            <p role="status" className="w-full text-sm text-success">
              {message}
            </p>
          )}
        </div>

        {shown.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucune carte pour ces filtres.
          </p>
        )}
        <div className={fitScroll}>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 2xl:grid-cols-9">
            {shown.map((c) => {
              const n = counts[variant][c.id] ?? 0;
              const other = total(c.id) - n;
              return (
                <li key={c.id} className="relative min-w-0">
                  <button
                    type="button"
                    onClick={() => set(c.id, n + 1)}
                    aria-label={`${c.name} n° ${c.localId} : ${n} exemplaire${n > 1 ? 's' : ''}, ajouter un`}
                    className={cn(
                      'block w-full rounded-lg outline-offset-2 transition',
                      n > 0 && 'ring-2 ring-primary',
                    )}
                  >
                    <SafeImg
                      src={c.image}
                      alt=""
                      className={cn(
                        'aspect-[63/88] w-full rounded-lg bg-muted object-cover',
                        total(c.id) === 0 && 'opacity-35 grayscale',
                      )}
                    />
                  </button>
                  {n > 0 && (
                    <span className="pointer-events-none absolute top-1 right-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground shadow">
                      ×{n}
                    </span>
                  )}
                  {other > 0 && (
                    <span className="pointer-events-none absolute top-1 left-1 rounded-full bg-info px-1.5 py-0.5 text-[10px] font-bold text-black shadow">
                      {variant === 'normal' ? 'R' : 'N'}×{other}
                    </span>
                  )}
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <span
                      className="truncate text-[11px] text-muted-foreground"
                      title={c.rarity ?? undefined}
                    >
                      {c.localId} · {c.name}
                    </span>
                    {n > 0 && (
                      <button
                        type="button"
                        onClick={() => set(c.id, n - 1)}
                        aria-label={`Retirer un exemplaire de ${c.name}`}
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
        </div>
      </Card>

      <Card className={cn(fitCard, 'hidden px-4 xl:flex')}>
        <h2 className="font-display text-base font-semibold">
          Ajouts en cours{' '}
          <span className="font-sans text-sm text-muted-foreground">· {pendingList.length}</span>
        </h2>
        <div className={fitScroll}>
          {pendingList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Touche une carte pour l’ajouter ; elle apparaît ici jusqu’à l’enregistrement.
            </p>
          ) : (
            <ul className="divide-y">
              {pendingList.map((p) => (
                <li key={`${p.v}-${p.id}`} className="flex items-center gap-2 py-2 text-sm">
                  <SafeImg
                    src={p.card?.image}
                    alt=""
                    className="aspect-[63/88] w-8 shrink-0 rounded bg-muted object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.card?.name ?? p.id}</span>
                    <span className="block text-xs text-muted-foreground">
                      {p.card?.localId}
                      {p.v === 'reverse' ? ' · reverse' : ''}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 font-semibold tabular-nums',
                      p.delta > 0 ? 'text-success' : 'text-destructive',
                    )}
                  >
                    {p.delta > 0 ? '+' : ''}
                    {p.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button type="button" disabled={changes === 0 || pending} onClick={save}>
          <Check />
          {pending ? 'Enregistrement…' : changes ? `Enregistrer (${changes})` : 'Enregistré'}
        </Button>
        {message && (
          <p role="status" className="text-sm text-success">
            {message}
          </p>
        )}
      </Card>
    </div>
  );
}
