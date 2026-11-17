import { ExternalLink, RefreshCw, Trash2, X } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatPrice } from '@tcgwatch/shared';
import { getEnv } from '@tcgwatch/shared/env';
import { CardPicker } from '@/components/card-picker';
import { CollectionCardTile } from '@/components/collection-card';
import { CopyButton } from '@/components/copy-button';
import { FormError } from '@/components/form-message';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getShowcase } from '@/lib/data/card-collection';
import {
  addShowcaseCardAction,
  deleteShowcaseAction,
  removeShowcaseCardAction,
  renewShowcaseLinkAction,
  updateShowcaseAction,
} from '../../actions';

export const metadata: Metadata = { title: 'Vitrine' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; mine?: string; erreur?: string }>;
};

export default async function ShowcasePage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const showcase = await getShowcase({ id });
  if (!showcase) notFound();
  const url = `${getEnv().APP_URL.replace(/\/$/, '')}/vitrine/${showcase.slug}`;
  const value = showcase.cards.reduce((s, c) => s + (c.price ?? 0), 0);
  const base = `/collection/cartes/vitrines/${showcase.id}`;

  return (
    <>
      <PageHeader
        title={showcase.title}
        description={`${showcase.cards.length} carte${showcase.cards.length > 1 ? 's' : ''} · valeur ${formatPrice(value)}${showcase.description ? ` · ${showcase.description}` : ''}`}
      />
      <FormError message={query.erreur} />

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Partage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={updateShowcaseAction.bind(null, showcase.id)}
            className="grid gap-3 md:grid-cols-2"
          >
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
                Vitrine privée : coche « Lien public actif » pour la partager.
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
        </CardContent>
      </Card>

      {showcase.cards.length > 0 && (
        <div className="mb-10 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {showcase.cards.map((c) => (
            <CollectionCardTile key={c.id} card={c}>
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

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Ajouter des cartes</h2>
        <CardPicker
          q={query.q}
          mine={query.mine === '1'}
          basePath={base}
          exclude={new Set(showcase.cards.map((c) => c.id))}
          addAction={(cardId) => addShowcaseCardAction.bind(null, showcase.id, cardId)}
        />
      </section>

      <form action={deleteShowcaseAction.bind(null, showcase.id)} className="mt-10">
        <Button type="submit" variant="ghost" size="sm" className="text-destructive">
          <Trash2 /> Supprimer la vitrine
        </Button>
      </form>
    </>
  );
}
