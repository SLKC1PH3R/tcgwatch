import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { formatPrice } from '@tcgwatch/shared';
import { getEnv } from '@tcgwatch/shared/env';
import { BrandLogo } from '@/components/brand-logo';
import { CollectionCardTile } from '@/components/collection-card';
import { getShowcase } from '@/lib/data/card-collection';

/** Vitrine partagée, publique uniquement quand elle est marquée comme telle. */
const load = cache(async (slug: string) => {
  const s = await getShowcase({ slug });
  return s?.public ? s : null;
});

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await load((await params).slug);
  const title = s ? (s.wanted ? `Je cherche : ${s.title}` : s.title) : 'Vitrine introuvable';
  const description =
    s?.description ??
    (s ? `${s.cards.length} carte${s.cards.length > 1 ? 's' : ''} Pokémon` : undefined);
  return {
    metadataBase: new URL(getEnv().APP_URL),
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website', siteName: 'TCGWatch' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function PublicShowcasePage({ params }: Props) {
  const s = await load((await params).slug);
  if (!s) notFound();
  const value = s.cards.reduce((sum, c) => sum + (c.price ?? 0), 0);

  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 space-y-4">
        <BrandLogo />
        <div className="space-y-2">
          {s.wanted && (
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              Je cherche ces cartes
            </p>
          )}
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{s.title}</h1>
          {s.description && <p className="max-w-3xl text-muted-foreground">{s.description}</p>}
          <p className="text-sm text-muted-foreground">
            {s.cards.length} carte{s.cards.length > 1 ? 's' : ''}
            {s.wanted ? ' recherchée' + (s.cards.length > 1 ? 's' : '') : ''}
            {s.showPrices && value > 0 ? ` · cote totale ${formatPrice(value)}` : ''}
          </p>
        </div>
      </header>
      {s.cards.length === 0 ? (
        <p className="text-muted-foreground">Cette vitrine est encore vide.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {s.cards.map((c) => (
            <CollectionCardTile
              key={c.id}
              card={c}
              link={false}
              showOwned={false}
              showPrice={s.showPrices}
            />
          ))}
        </div>
      )}
      <footer className="mt-12 text-xs text-muted-foreground">
        {s.wanted
          ? 'Liste de recherche partagée depuis TCGWatch : tu en as une ? Contacte la personne qui t’a envoyé ce lien.'
          : 'Vitrine partagée depuis TCGWatch'}{' '}
        · cote Cardmarket (tendance) du jour
      </footer>
    </main>
  );
}
