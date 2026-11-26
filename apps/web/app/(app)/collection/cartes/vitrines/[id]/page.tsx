import { BookOpen, ExternalLink, RefreshCw, Trash2, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPrice } from '@tcgwatch/shared';
import { getEnv } from '@tcgwatch/shared/env';
import { CollectionCardTile } from '@/components/collection-card';
import { CopyButton } from '@/components/copy-button';
import { FitPage } from '@/components/fit-page';
import { FormError } from '@/components/form-message';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getShowcase } from '@/lib/data/card-collection';
import {
  deleteShowcaseAction,
  removeShowcaseCardAction,
  renewShowcaseLinkAction,
  setWantedTargetAction,
  updateShowcaseAction,
} from '../../actions';
import { fitCard, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Vitrine' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
};

export default async function ShowcasePage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const showcase = await getShowcase({ id, userId: user.id });
  if (!showcase) notFound();
  const url = `${getEnv().APP_URL.replace(/\/$/, '')}/vitrine/${showcase.slug}`;
  const value = showcase.cards.reduce((s, c) => s + (c.price ?? 0), 0);
  const base = `/collection/cartes/vitrines/${showcase.id}`;

  return (
    <FitPage>
      <PageHeader
        title={showcase.title}
        description={`${showcase.cards.length} carte${showcase.cards.length > 1 ? 's' : ''} · valeur ${formatPrice(value)}${showcase.description ? ` · ${showcase.description}` : ''}`}
      />
      <FormError message={query.erreur} />

      <div className={cn(fitGrid, 'xl:grid-cols-[minmax(0,1fr)_24rem]')}>
        <Card className={cn(fitCard, 'px-5')}>
          <h2 className="font-display text-base font-semibold">
            Cartes de la vitrine{' '}
            <span className="font-sans text-sm text-muted-foreground">
              · {showcase.cards.length}
            </span>
          </h2>
          <div className={fitScroll}>
            {showcase.cards.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
                <p>Vitrine vide : ajoutez des cartes depuis vos classeurs.</p>
                <Button asChild>
                  <Link href={`${base}/ajouter`}>
                    <BookOpen /> Ajouter des cartes
                  </Link>
                </Button>
              </div>
            )}
            {showcase.cards.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 2xl:grid-cols-6">
                {showcase.cards.map((c) => (
                  <CollectionCardTile key={c.id} card={c}>
                    {showcase.wanted && (
                      <form
                        action={setWantedTargetAction.bind(null, showcase.id, c.id)}
                        className="flex items-center gap-1"
                        title="Alerte quand la carte passe sous ce prix (eBay FR, sinon Cardmarket)"
                      >
                        <Input
                          name="target"
                          inputMode="decimal"
                          placeholder="Alerte sous… €"
                          aria-label={`Prix cible de ${c.name}`}
                          defaultValue={
                            c.targetPrice !== null ? String(c.targetPrice).replace('.', ',') : ''
                          }
                          className="h-7 min-w-0 flex-1 px-2 text-xs"
                        />
                        <Button type="submit" size="sm" variant="outline" className="h-7 px-2">
                          OK
                        </Button>
                      </form>
                    )}
                    <form action={removeShowcaseCardAction.bind(null, showcase.id, c.id)}>
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        className="w-full text-muted-foreground"
                      >
                        <X /> Retirer
                      </Button>
                    </form>
                  </CollectionCardTile>
                ))}
              </div>
            )}
          </div>
        </Card>
        <Card className={cn(fitCard, 'px-5')}>
          <div className={cn('space-y-6', fitScroll)}>
            <section className="space-y-4">
              <h2 className="font-display text-base font-semibold">Partage</h2>
              <div className="space-y-4">
                <form action={updateShowcaseAction.bind(null, showcase.id)} className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sv-title">Titre</Label>
                    <Input id="sv-title" name="title" defaultValue={showcase.title} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sv-desc">Description</Label>
                    <Textarea
                      id="sv-desc"
                      name="description"
                      defaultValue={showcase.description ?? ''}
                      rows={1}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="public"
                      defaultChecked={showcase.public}
                      className="size-4"
                    />
                    Lien public actif (toute personne qui a le lien voit la vitrine)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="showPrices"
                      defaultChecked={showcase.showPrices}
                      className="size-4"
                    />
                    Afficher la cote des cartes
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="wanted"
                      defaultChecked={showcase.wanted}
                      className="size-4"
                    />
                    Liste de recherche (« cartes que je cherche »)
                  </label>
                  <div>
                    <Button type="submit" size="sm">
                      Enregistrer
                    </Button>
                  </div>
                </form>
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-3 text-sm">
                  {showcase.public ? (
                    <>
                      <code className="min-w-0 flex-1 truncate">{url}</code>
                      <CopyButton text={url} />
                      <Button asChild variant="ghost" size="sm">
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          Ouvrir <ExternalLink />
                        </a>
                      </Button>
                    </>
                  ) : (
                    <span className="flex-1 text-muted-foreground">
                      Vitrine privée : cochez « Lien public actif » pour la partager.
                    </span>
                  )}
                  <form action={renewShowcaseLinkAction.bind(null, showcase.id)}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      title="L’ancien lien cessera de fonctionner"
                    >
                      <RefreshCw /> Nouveau lien
                    </Button>
                  </form>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-base font-semibold">Ajouter des cartes</h2>
              <p className="text-sm text-muted-foreground">
                Parcourez vos classeurs d’extension ou cherchez une carte par son nom.
              </p>
              <Button asChild>
                <Link href={`${base}/ajouter`}>
                  <BookOpen /> Ajouter depuis mes classeurs
                </Link>
              </Button>
            </section>

            <form action={deleteShowcaseAction.bind(null, showcase.id)}>
              <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                <Trash2 /> Supprimer la vitrine
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </FitPage>
  );
}
