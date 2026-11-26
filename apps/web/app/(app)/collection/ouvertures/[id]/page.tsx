import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate, formatPrice } from '@tcgwatch/shared';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth';
import { getReleaseCards } from '@/lib/data/card-collection';
import { getOpening } from '@/lib/data/openings';
import { deleteOpeningAction } from '../actions';
import { OpeningEditor } from './opening-editor';

export const metadata: Metadata = { title: 'Ouverture' };

type Props = { params: Promise<{ id: string }> };

/** Une ouverture : les cartes tirées du produit, à saisir ou corriger. */
export default async function OpeningPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const opening = await getOpening(user.id, id);
  if (!opening) notFound();
  const code = opening.product.release?.tcgdexId;
  const data = code ? await getReleaseCards(user.id, code) : null;

  return (
    <FitPage>
      <PageHeader
        title={opening.product.name}
        description={`Ouvert le ${formatDate(opening.openedAt)}, payé ${formatPrice(opening.price)}${opening.notes ? ` · ${opening.notes}` : ''}. Touchez les cartes sorties du produit, puis enregistrez.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/collection/ouvertures">Toutes les ouvertures</Link>
            </Button>
            <form action={deleteOpeningAction.bind(null, opening.id)}>
              <Button type="submit" variant="ghost" className="text-destructive">
                Supprimer
              </Button>
            </form>
          </>
        }
      />
      {data ? (
        <OpeningEditor
          id={opening.id}
          cards={data.cards}
          initial={opening.counts}
          price={opening.price}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Les cartes de l’extension de ce produit ne sont pas encore importées.
        </p>
      )}
    </FitPage>
  );
}
