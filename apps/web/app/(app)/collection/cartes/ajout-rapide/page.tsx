import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoSubmitSelect } from '@/components/auto-submit-select';
import { PageHeader } from '@/components/page-header';
import { getCardReleases, getReleaseCards } from '@/lib/data/card-collection';
import { QuickAdd } from './quick-add';

export const metadata: Metadata = { title: 'Ajout rapide de cartes' };

type Props = { searchParams: Promise<{ extension?: string }> };

/**
 * Ajout rapide : toutes les cartes d'une extension, un toucher = un exemplaire de plus.
 * Les quantités sont enregistrées en une fois.
 */
export default async function QuickAddPage({ searchParams }: Props) {
  const { extension } = await searchParams;
  const releases = await getCardReleases();
  const code = extension ?? releases[0]?.tcgdexId ?? undefined;
  const data = code ? await getReleaseCards(code) : null;
  if (extension && !data) notFound();

  return (
    <>
      <PageHeader
        title="Ajout rapide"
        description="Choisis une extension, touche les cartes que tu possèdes (un toucher = un exemplaire), puis enregistre. Bascule sur « Reverse » pour compter tes reverses à part."
      />
      <form className="mb-6 max-w-md">
        <AutoSubmitSelect
          name="extension"
          value={code ?? ''}
          label="Extension"
          className="h-10 w-full rounded-lg border bg-secondary px-3 text-sm font-medium"
          options={releases.map((r) => ({
            value: r.tcgdexId!,
            label: `${r.nameFr}${r.serieRef ? ` · ${r.serieRef.name}` : ''}`,
          }))}
        />
      </form>
      {data ? (
        <QuickAdd
          key={data.release.tcgdexId}
          code={data.release.tcgdexId!}
          name={data.release.nameFr}
          cards={data.cards}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Aucune extension avec des cartes pour l’instant.{' '}
          <Link href="/series" className="text-primary hover:underline">
            Voir l’encyclopédie
          </Link>
        </p>
      )}
    </>
  );
}
