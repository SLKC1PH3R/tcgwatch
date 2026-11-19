'use client';

import { ArrowLeft, ChevronRight, Package, Search, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { fold, PRODUCT_TYPE_LABELS, type ProductTypeKey, queryWords } from '@tcgwatch/shared';
import { SafeImg } from '@/components/safe-img';
import { Thumb } from '@/components/thumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ProductOption } from '@/lib/data/products';
import { cn } from '@/lib/utils';

const OTHERS = '__autres';

type Group = {
  id: string;
  name: string;
  setCode: string | null;
  logo: string | null;
  cover: string | null;
  releaseDate: string | null;
  products: ProductOption[];
};

/** Extensions qui ont des produits, de la plus récente à la plus ancienne ; « Autres » à la fin. */
function groupByExtension(products: ProductOption[]): Group[] {
  const groups = new Map<string, Group>();
  for (const p of products) {
    const id = p.extension?.id ?? OTHERS;
    let g = groups.get(id);
    if (!g) {
      g = {
        id,
        name: p.extension?.name ?? 'Autres produits',
        setCode: p.extension?.setCode ?? null,
        logo: p.extension?.logo ?? null,
        cover: null,
        releaseDate: p.extension?.releaseDate ?? null,
        products: [],
      };
      groups.set(id, g);
    }
    g.products.push(p);
    if (!g.cover && p.image) g.cover = p.image;
  }
  return [...groups.values()].sort(
    (a, b) =>
      Number(a.id === OTHERS) - Number(b.id === OTHERS) ||
      (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') ||
      a.name.localeCompare(b.name, 'fr'),
  );
}

/**
 * Choix d'un produit en image : extensions (logos), puis leurs produits ; la recherche filtre
 * produits et extensions sans tenir compte des accents (« regne » trouve « Règne Delta »).
 * La valeur choisie part dans le formulaire via un champ caché `name`.
 */
export function ProductPicker({
  products,
  name = 'productId',
  id,
}: {
  products: ProductOption[];
  name?: string;
  id?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<ProductOption | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const groups = useMemo(() => groupByExtension(products), [products]);
  const haystack = useMemo(
    () =>
      new Map(
        products.map((p) => [
          p.id,
          fold(
            [
              p.name,
              p.extension?.name,
              p.extension?.setCode,
              PRODUCT_TYPE_LABELS[p.type as ProductTypeKey],
            ]
              .filter(Boolean)
              .join(' '),
          ),
        ]),
      ),
    [products],
  );

  const words = queryWords(q);
  const results = words.length
    ? products.filter((p) => words.every((w) => haystack.get(p.id)!.includes(w)))
    : [];
  const current = groups.find((g) => g.id === group) ?? null;

  const open = () => {
    dialog.current?.showModal();
    searchRef.current?.focus();
  };
  const close = () => dialog.current?.close();
  const pick = (p: ProductOption) => {
    setSelected(p);
    close();
  };

  return (
    <>
      <input type="hidden" name={name} value={selected?.id ?? ''} />
      <button
        id={id}
        type="button"
        onClick={open}
        className="flex w-full items-center gap-3 rounded-lg border bg-secondary p-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      >
        {selected ? (
          <>
            <Thumb src={selected.image} className="size-12" />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 font-medium">{selected.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[PRODUCT_TYPE_LABELS[selected.type as ProductTypeKey], selected.extension?.name]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <span className="shrink-0 text-xs text-primary">Changer</span>
          </>
        ) : (
          <>
            <span className="grid size-12 place-items-center rounded-md border border-dashed">
              <Package className="size-5 text-muted-foreground" />
            </span>
            <span className="flex-1 font-medium">Choisir un produit…</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </>
        )}
      </button>

      <dialog
        ref={dialog}
        aria-label="Choisir un produit"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto h-[min(48rem,calc(100dvh-2rem))] w-[min(64rem,calc(100vw-2rem))] rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b p-3 sm:p-4">
            {current && !words.length && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setGroup(null)}
                aria-label="Retour aux extensions"
                className="size-9 shrink-0"
              >
                <ArrowLeft />
              </Button>
            )}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher : règne, ETB Flamme Blanche, display…"
                aria-label="Rechercher un produit ou une extension"
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={close}
              aria-label="Fermer"
              className="size-9 shrink-0"
            >
              <X />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {words.length ? (
              results.length ? (
                <>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {results.length} produit{results.length > 1 ? 's' : ''}
                  </p>
                  <ProductGrid products={results} onPick={pick} selectedId={selected?.id} />
                </>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Aucun produit pour « {q} ».
                </p>
              )
            ) : current ? (
              <>
                <h3 className="mb-3 flex items-center gap-3 font-display text-lg font-bold">
                  {current.logo && (
                    <SafeImg src={current.logo} alt="" className="h-8 max-w-28 object-contain" />
                  )}
                  {current.name}
                  <span className="text-sm font-normal text-muted-foreground">
                    {current.products.length} produit{current.products.length > 1 ? 's' : ''}
                  </span>
                </h3>
                <ProductGrid
                  products={current.products}
                  onPick={pick}
                  selectedId={selected?.id}
                  hideExtension
                />
              </>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {groups.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setGroup(g.id)}
                      className="flex h-full w-full flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors hover:bg-accent/50"
                    >
                      <span className="flex h-14 w-full items-center justify-center">
                        {g.logo ? (
                          <SafeImg
                            src={g.logo}
                            alt=""
                            className="max-h-14 max-w-full object-contain"
                          />
                        ) : g.cover ? (
                          <SafeImg
                            src={g.cover}
                            alt=""
                            className="max-h-14 max-w-full rounded object-contain"
                          />
                        ) : (
                          <Package className="size-8 text-muted-foreground/60" />
                        )}
                      </span>
                      <span className="line-clamp-2 text-sm font-medium">{g.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[
                          g.setCode,
                          `${g.products.length} produit${g.products.length > 1 ? 's' : ''}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

function ProductGrid({
  products,
  onPick,
  selectedId,
  hideExtension,
}: {
  products: ProductOption[];
  onPick: (p: ProductOption) => void;
  selectedId?: string;
  hideExtension?: boolean;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {products.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => onPick(p)}
            className={cn(
              'flex h-full w-full flex-col gap-2 rounded-xl border p-2 text-left transition-colors hover:bg-accent/50',
              p.id === selectedId && 'border-primary ring-1 ring-primary',
            )}
          >
            <Thumb src={p.image} className="aspect-square h-auto w-full" />
            <span className="line-clamp-3 text-xs font-medium">{p.name}</span>
            <span className="mt-auto truncate text-[11px] text-muted-foreground">
              {[
                PRODUCT_TYPE_LABELS[p.type as ProductTypeKey],
                hideExtension ? null : p.extension?.name,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
