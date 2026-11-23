import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoSubmitSelect } from '@/components/auto-submit-select';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { getCardReleases, getReleaseCards } from '@/lib/data/card-collection';
import { fitCard, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';
import { QuickAdd } from './quick-add';
import { parseSetMode } from '@/lib/card-sets';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Ajout rapide de cartes' };

type Props = { searchParams: Promise<{ extension?: string; set?: string }> };

/**
 * Ajout rapide : toutes les cartes d'une extension, un toucher = un exemplaire de plus.
 * Les quantités sont enregistrées en une fois.
 */
export default async function QuickAddPage({ searchParams }: Props) {
  const { extension, set } = await searchParams;
  const user = await requireUser();
  const releases = await getCardReleases();
  const code = extension ?? releases[0]?.tcgdexId ?? undefined;
  const data = code ? await getReleaseCards(user.id, code) : null;
  if (extension && !data) notFound();

  return (
    <FitPage>
      <PageHeader
        title="Ajout rapide"
        description="Choisis une extension, touche les cartes que tu possèdes (un toucher = un exemplaire), puis enregistre. En « Master Set », chaque reverse a sa propre case, juste après la carte classique."
      />
      <div className={cn(fitGrid, 'lg:grid-cols-[15rem_minmax(0,1fr)]')}>
        <Card className={cn(fitCard, 'px-3')}>
          <h2 className="px-2 font-display text-base font-semibold">Extension</h2>
          {/* Petit écran : liste déroulante ; grand écran : liste qui défile. */}
          <form className="px-2 lg:hidden">
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
          <nav aria-label="Extensions" className={cn('hidden space-y-0.5 lg:block', fitScroll)}>
            {releases.map((r) => {
              const on = r.tcgdexId === code;
              return (
                <Link
                  key={r.tcgdexId}
                  href={`/collection/cartes/ajout-rapide?extension=${encodeURIComponent(r.tcgdexId!)}`}
                  scroll={false}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'block rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-accent',
                    on && 'bg-accent font-semibold',
                  )}
                >
                  <span className="block truncate">{r.nameFr}</span>
                  {r.serieRef && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.serieRef.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </Card>
        {data ? (
          <QuickAdd
            key={data.release.tcgdexId}
            code={data.release.tcgdexId!}
            name={data.release.nameFr}
            cards={data.cards}
            initialMode={parseSetMode(set)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune extension avec des cartes pour l’instant.{' '}
            <Link href="/series" className="text-primary hover:underline">
              Voir l’encyclopédie
            </Link>
          </p>
        )}
      </div>
    </FitPage>
  );
}
