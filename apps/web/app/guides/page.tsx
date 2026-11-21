import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDate } from '@tcgwatch/shared';
import { PublicPage } from '@/components/public-page';
import { getUpcomingEvents } from '@/lib/data/releases';
import { GUIDES } from '@/lib/guides';

export const metadata: Metadata = {
  title: 'Guides Pokémon JCC',
  description:
    'Repérer les faux, choisir entre scellé et cartes à l’unité, éditions françaises ou japonaises, prochaines sorties en France.',
};

/** Guides et prochaines sorties françaises (page publique). */
export default async function GuidesPage() {
  const upcoming = (await getUpcomingEvents(40)).filter((e) => e.kind === 'release').slice(0, 6);
  return (
    <PublicPage
      title="Guides"
      intro="L’essentiel pour collectionner sans se faire avoir, en français."
      wide
    >
      <ul className="grid !list-none gap-4 !pl-0 sm:grid-cols-3">
        {GUIDES.map((g) => (
          <li key={g.slug} className="rounded-2xl border bg-card p-5">
            <Link href={`/guides/${g.slug}`} className="!text-foreground">
              <span className="block font-semibold">{g.title}</span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                {g.summary}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {upcoming.length > 0 && (
        <>
          <h2>Prochaines sorties en France</h2>
          <ul>
            {upcoming.map((e) => (
              <li key={e.id}>
                <b>{formatDate(e.date)}</b> — {e.title}
                {e.subtitle ? ` (${e.subtitle})` : ''}
              </li>
            ))}
          </ul>
          <p>
            Calendrier complet, produits et précommandes :{' '}
            <Link href="/calendrier">calendrier</Link>.
          </p>
        </>
      )}
    </PublicPage>
  );
}
