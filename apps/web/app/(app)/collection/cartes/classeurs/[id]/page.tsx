import { ChevronLeft, ChevronRight, Minus, Plus, Trash2, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPrice } from '@tcgwatch/shared';
import { CardPicker } from '@/components/card-picker';
import { CollectionCardTile } from '@/components/collection-card';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type CardFilters,
  cardFiltersQuery,
  filterCards,
  parseCardFilters,
  rarityCounts,
} from '@/lib/card-filters';
import { getBinder } from '@/lib/data/card-collection';
import { fitCard, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';
import {
  addBinderCardAction,
  adjustOwnedCardAction,
  deleteBinderAction,
  removeBinderCardAction,
  updateBinderAction,
} from '../../actions';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Classeur' };

/** 9 cartes par page, deux pages côte à côte comme un classeur ouvert. */
const PER_PAGE = 9;
const PER_SPREAD = PER_PAGE * 2;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    q?: string;
    mine?: string;
    rarete?: string;
    reverse?: string;
    vue?: string;
  }>;
};

export default async function BinderPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const binder = await getBinder(user.id, id);
  if (!binder) notFound();
  const isSet = Boolean(binder.release);
  const filters = parseCardFilters(query);
  const filtered = filterCards(binder.cards, filters);
  const groups = rarityCounts(binder.cards);
  const spreads = Math.max(1, Math.ceil(filtered.length / PER_SPREAD));
  const spread = Math.min(spreads, Math.max(1, Number(query.page) || 1));
  const shown = filtered.slice((spread - 1) * PER_SPREAD, spread * PER_SPREAD);
  const pages = [shown.slice(0, PER_PAGE), shown.slice(PER_PAGE)];
  const owned = binder.cards.filter((c) => c.owned > 0);
  const value = owned.reduce((s, c) => s + (c.price ?? 0) * c.owned, 0);
  const base = `/collection/cartes/classeurs/${binder.id}`;
  const filtersHref = (f: CardFilters, page = 1) => {
    const params = new URLSearchParams(cardFiltersQuery(f));
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const pageHref = (n: number) => filtersHref(filters, n);
  const chip = (label: string, next: CardFilters, active: boolean, count?: number) => (
    <Link
      key={label}
      href={filtersHref(next)}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-accent',
        active && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
      )}
    >
      {label}
      {count !== undefined && <span className="ml-1 tabular-nums opacity-70">{count}</span>}
    </Link>
  );
  const filtering = filtered.length !== binder.cards.length;

  return (
    <FitPage>
      <PageHeader
        title={binder.name}
        description={
          isSet
            ? `Classeur de l’extension ${binder.release!.nameFr} : ${owned.length}/${binder.cards.length} cartes possédées, valeur ${formatPrice(value)}. Les cartes manquantes sont en gris.`
            : `${binder.cards.length} carte${binder.cards.length > 1 ? 's' : ''}, dont ${owned.length} possédée${owned.length > 1 ? 's' : ''} · valeur ${formatPrice(value)}.${binder.description ? ` ${binder.description}` : ''}`
        }
        actions={
          isSet ? (
            <Button asChild variant="outline">
              <Link
                href={`/collection/cartes/ajout-rapide?extension=${encodeURIComponent(binder.release!.tcgdexId!)}`}
              >
                Ajout rapide
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className={cn(fitGrid, 'xl:grid-cols-[minmax(0,1fr)_22rem]')}>
        <Card className={cn(fitCard, 'px-4')}>
          <div className={cn('space-y-4', fitScroll)}>
            {binder.cards.length === 0 ? (
              <div>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Classeur vide : cherche des cartes ci-dessous pour le remplir.
                </CardContent>
              </div>
            ) : filtered.length === 0 ? (
              <div>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Aucune carte pour ces filtres.
                </CardContent>
              </div>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-2 fit:items-start">
                  {pages.map((page, i) =>
                    page.length === 0 ? null : (
                      <section
                        key={i}
                        aria-label={`Page ${(spread - 1) * 2 + i + 1}`}
                        className="rounded-2xl border bg-muted/30 p-3 sm:p-4"
                      >
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 fit:mx-auto fit:max-w-[calc((100dvh-27.5rem)*0.72)]">
                          {page.map((c) => (
                            <CollectionCardTile key={c.id} card={c} dimMissing>
                              <div className="flex items-center justify-between gap-1">
                                {isSet ? (
                                  <>
                                    <form
                                      action={adjustOwnedCardAction.bind(null, c.id, -1, 'normal')}
                                    >
                                      <Button
                                        type="submit"
                                        size="icon"
                                        variant="ghost"
                                        className="size-7"
                                        disabled={!c.byVariant.normal}
                                        aria-label={`Retirer un ${c.name}`}
                                      >
                                        <Minus />
                                      </Button>
                                    </form>
                                    <form
                                      action={adjustOwnedCardAction.bind(null, c.id, 1, 'normal')}
                                    >
                                      <Button
                                        type="submit"
                                        size="icon"
                                        variant="ghost"
                                        className="size-7"
                                        aria-label={`Ajouter un ${c.name}`}
                                      >
                                        <Plus />
                                      </Button>
                                    </form>
                                  </>
                                ) : (
                                  <form
                                    action={removeBinderCardAction.bind(null, binder.id, c.id)}
                                    className="ml-auto"
                                  >
                                    <Button
                                      type="submit"
                                      size="icon"
                                      variant="ghost"
                                      className="size-7 text-muted-foreground"
                                      aria-label={`Retirer ${c.name} du classeur`}
                                    >
                                      <X />
                                    </Button>
                                  </form>
                                )}
                              </div>
                            </CollectionCardTile>
                          ))}
                        </div>
                      </section>
                    ),
                  )}
                </div>
                {spreads > 1 && (
                  <nav
                    aria-label="Pages du classeur"
                    className="mt-4 flex items-center justify-center gap-3 fit:mt-0"
                  >
                    <Button asChild variant="outline" size="sm" aria-disabled={spread === 1}>
                      <Link href={pageHref(Math.max(1, spread - 1))}>
                        <ChevronLeft /> Précédentes
                      </Link>
                    </Button>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      Pages {(spread - 1) * 2 + 1}–
                      {Math.min(spread * 2, Math.ceil(filtered.length / PER_PAGE))} sur{' '}
                      {Math.ceil(filtered.length / PER_PAGE)}
                    </span>
                    <Button asChild variant="outline" size="sm" aria-disabled={spread === spreads}>
                      <Link href={pageHref(Math.min(spreads, spread + 1))}>
                        Suivantes <ChevronRight />
                      </Link>
                    </Button>
                  </nav>
                )}
              </>
            )}
          </div>
        </Card>
        <Card className={cn(fitCard, 'px-4')}>
          <div className={cn('space-y-6', fitScroll)}>
            {binder.cards.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {chip('Toutes', { ...filters, owned: 'toutes' }, filters.owned === 'toutes')}
                  {chip(
                    'Manquantes',
                    { ...filters, owned: 'manquantes' },
                    filters.owned === 'manquantes',
                  )}
                  {chip(
                    'Possédées',
                    { ...filters, owned: 'possedees' },
                    filters.owned === 'possedees',
                  )}
                  {isSet &&
                    chip(
                      'Existe en reverse',
                      { ...filters, reverse: !filters.reverse },
                      filters.reverse,
                    )}
                </div>
                {groups.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {chip(
                      'Toutes raretés',
                      { ...filters, rarities: [] },
                      filters.rarities.length === 0,
                    )}
                    {groups.map((g) => {
                      const on = filters.rarities.includes(g.key);
                      return chip(
                        g.label,
                        {
                          ...filters,
                          rarities: on
                            ? filters.rarities.filter((k) => k !== g.key)
                            : [...filters.rarities, g.key],
                        },
                        on,
                        g.count,
                      );
                    })}
                  </div>
                )}
                {filtering && (
                  <p className="text-sm text-muted-foreground">
                    {filtered.length} carte{filtered.length > 1 ? 's' : ''} sur{' '}
                    {binder.cards.length} ·{' '}
                    <Link href={base} className="text-primary hover:underline">
                      Retirer les filtres
                    </Link>
                  </p>
                )}
              </div>
            )}

            {!isSet && (
              <section className="space-y-3">
                <h2 className="font-display text-base font-semibold">Ajouter des cartes</h2>
                <CardPicker
                  q={query.q}
                  mine={query.mine === '1'}
                  basePath={base}
                  exclude={new Set(binder.cards.map((c) => c.id))}
                  addAction={(cardId) => addBinderCardAction.bind(null, binder.id, cardId)}
                />
              </section>
            )}

            <details className="rounded-xl border p-4 text-sm">
              <summary className="cursor-pointer font-medium">Réglages du classeur</summary>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <form
                  action={updateBinderAction.bind(null, binder.id)}
                  className="flex flex-wrap items-end gap-3"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="bn">Nom</Label>
                    <Input
                      id="bn"
                      name="name"
                      defaultValue={binder.name}
                      required
                      className="w-64 max-w-full"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bd">Description</Label>
                    <Input
                      id="bd"
                      name="description"
                      defaultValue={binder.description ?? ''}
                      className="w-72 max-w-full"
                    />
                  </div>
                  <Button type="submit" size="sm">
                    Enregistrer
                  </Button>
                </form>
                <form action={deleteBinderAction.bind(null, binder.id)}>
                  <Button type="submit" size="sm" variant="ghost" className="text-destructive">
                    <Trash2 /> Supprimer le classeur
                  </Button>
                </form>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Supprimer un classeur ne retire aucune carte de ta collection.
              </p>
            </details>
          </div>
        </Card>
      </div>
    </FitPage>
  );
}
