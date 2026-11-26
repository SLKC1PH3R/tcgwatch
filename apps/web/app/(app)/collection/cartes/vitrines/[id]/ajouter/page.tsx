import { ArrowLeft, BookOpen, Check, Plus, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fold } from '@tcgwatch/shared';
import { CollectionCardTile } from '@/components/collection-card';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { SafeImg } from '@/components/safe-img';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { requireUser } from '@/lib/auth';
import { percent } from '@/lib/card-sets';
import { getBinder, getBinders, getShowcase, searchCards } from '@/lib/data/card-collection';
import { fitCard, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';
import { addShowcaseCardAction } from '../../../actions';

export const metadata: Metadata = { title: 'Ajouter des cartes à la vitrine' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ classeur?: string; q?: string; mine?: string }>;
};

/**
 * Ajout de cartes à une vitrine : parcourir ses classeurs (une extension, toutes ses cartes) ou
 * chercher par nom, dans un classeur ou partout, éventuellement parmi ses seules cartes.
 */
export default async function AddShowcaseCardsPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const [showcase, binders] = await Promise.all([
    getShowcase({ id, userId: user.id }),
    getBinders(user.id),
  ]);
  if (!showcase) notFound();

  const q = query.q?.trim() ?? '';
  // Liste de recherche : on y met surtout des cartes qu'on n'a pas, donc pas de filtre par défaut.
  const mine = query.mine === '1';
  const binderId = binders.some((b) => b.id === query.classeur) ? query.classeur! : null;
  const binder = binderId ? await getBinder(user.id, binderId) : null;
  const words = fold(q).split(/\s+/).filter(Boolean);
  const cards = binder
    ? binder.cards.filter(
        (c) =>
          (!mine || c.owned > 0) &&
          words.every(
            (w) =>
              fold(c.name).includes(w) || c.localId.replace(/^0+/, '') === w.replace(/^0+/, ''),
          ),
      )
    : q
      ? await searchCards(user.id, q, mine, 60)
      : [];
  const inShowcase = new Set(showcase.cards.map((c) => c.id));
  const base = `/collection/cartes/vitrines/${showcase.id}/ajouter`;
  const href = (classeur: string | null) => {
    const p = new URLSearchParams();
    if (classeur) p.set('classeur', classeur);
    if (mine) p.set('mine', '1');
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <FitPage>
      <PageHeader
        title={`Ajouter à « ${showcase.title} »`}
        description={`${showcase.cards.length} carte${showcase.cards.length > 1 ? 's' : ''} dans la vitrine. Ouvrez un de vos classeurs ou cherchez une carte par son nom.`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/collection/cartes/vitrines/${showcase.id}`}>
              <ArrowLeft /> Retour à la vitrine
            </Link>
          </Button>
        }
      />

      <div className={cn(fitGrid, 'lg:grid-cols-[18rem_minmax(0,1fr)]')}>
        <Card className={cn(fitCard, 'px-3')}>
          <h2 className="px-2 font-display text-base font-semibold">Mes classeurs</h2>
          <nav aria-label="Classeurs" className={cn('space-y-1', fitScroll)}>
            <Link
              href={href(null)}
              aria-current={binderId === null ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-semibold transition-colors hover:bg-accent',
                binderId === null && 'bg-accent',
              )}
            >
              <span className="grid h-8 w-16 shrink-0 place-items-center">
                <Search className="size-5 text-primary" />
              </span>
              Toutes les cartes
            </Link>
            {binders.map((b) => (
              <Link
                key={b.id}
                href={href(b.id)}
                aria-current={binderId === b.id ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-accent',
                  binderId === b.id && 'bg-accent',
                )}
              >
                <span className="grid h-8 w-16 shrink-0 place-items-center">
                  <SafeImg
                    src={b.release?.imageUrl ?? b.release?.symbolUrl ?? null}
                    alt=""
                    className="max-h-8 max-w-16 object-contain"
                    fallback={<BookOpen className="size-5 text-primary" />}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{b.name}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {b.progress.full.owned}/{b.progress.full.total} · {percent(b.progress.full)} %
                  </span>
                </span>
              </Link>
            ))}
            {binders.length === 0 && (
              <p className="px-2 text-sm text-muted-foreground">
                Aucun classeur.{' '}
                <Link href="/collection/cartes/classeurs" className="underline">
                  En créer un
                </Link>
              </p>
            )}
          </nav>
        </Card>

        <Card className={cn(fitCard, 'px-5')}>
          <form action={base} className="flex shrink-0 flex-wrap items-center gap-2">
            {binderId && <input type="hidden" name="classeur" value={binderId} />}
            <div className="relative min-w-0 flex-1 basis-56">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={q}
                placeholder={
                  binder
                    ? `Chercher dans ${binder.name} : nom ou numéro`
                    : 'Nom de la carte : Dracaufeu, Évoli…'
                }
                className="pl-9"
                aria-label="Chercher une carte"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="mine"
                value="1"
                defaultChecked={mine}
                className="size-4"
              />
              Seulement mes cartes
            </label>
            <Button type="submit" variant="secondary">
              Chercher
            </Button>
          </form>
          <p className="shrink-0 text-sm text-muted-foreground">
            {binder
              ? `${binder.name} · ${cards.length} carte${cards.length > 1 ? 's' : ''}${q ? ` pour « ${q} »` : ''}`
              : q
                ? `${cards.length} carte${cards.length > 1 ? 's' : ''} pour « ${q} »`
                : 'Choisissez un classeur à gauche, ou cherchez une carte dans toutes les extensions.'}
          </p>
          <div className={fitScroll}>
            {(binder || q) && cards.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucune carte trouvée.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
                {cards.map((c) => (
                  <CollectionCardTile key={c.id} card={c} link={false} dimMissing={Boolean(binder)}>
                    {inShowcase.has(c.id) ? (
                      <p className="flex h-8 items-center justify-center gap-1 text-xs text-muted-foreground">
                        <Check className="size-3.5" /> Dans la vitrine
                      </p>
                    ) : (
                      <form action={addShowcaseCardAction.bind(null, showcase.id, c.id)}>
                        <Button type="submit" size="sm" variant="secondary" className="w-full">
                          <Plus /> Ajouter
                        </Button>
                      </form>
                    )}
                  </CollectionCardTile>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </FitPage>
  );
}
