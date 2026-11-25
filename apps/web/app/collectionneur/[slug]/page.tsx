import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { tcgdexAsset } from '@tcgwatch/market';
import { formatDate } from '@tcgwatch/shared';
import { getEnv } from '@tcgwatch/shared/env';
import { BrandLogo } from '@/components/brand-logo';
import { CollectionCardTile } from '@/components/collection-card';
import { SafeImg } from '@/components/safe-img';
import { SetProgressBars } from '@/components/set-progress-bars';
import { Badge } from '@/components/ui/badge';
import { getPublicProfile, type PublicProfile } from '@/lib/data/profile';

const load = cache((slug: string) => getPublicProfile(slug));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).slug);
  const title = p ? `${p.name} · collectionneur Pokémon` : 'Page introuvable';
  const description =
    p?.bio ??
    (p
      ? `${p.stats.copies} cartes, ${p.stats.binders} classeur${p.stats.binders > 1 ? 's' : ''}`
      : undefined);
  return {
    metadataBase: new URL(getEnv().APP_URL),
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'profile', siteName: 'TCGWatch' },
  };
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold tracking-tight">
        {title}
        {count !== undefined && (
          <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">{count}</span>
        )}
      </h2>
      {children}
    </section>
  );
}

function ShowcaseList({ items }: { items: PublicProfile['showcases'] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <li key={s.slug}>
          <Link
            href={`/vitrine/${s.slug}`}
            className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
          >
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 4 }, (_, i) => s.cards[i]).map((c, i) => (
                <SafeImg
                  key={i}
                  src={c ? (tcgdexAsset(c.card.imageUrl ?? undefined, '/low.webp') ?? null) : null}
                  alt=""
                  className="aspect-[63/88] w-full rounded-md bg-muted object-cover"
                />
              ))}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{s.title}</p>
              <p className="text-xs text-muted-foreground">
                {s._count.cards} carte{s._count.cards > 1 ? 's' : ''}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function CollectorPage({ params }: Props) {
  const p = await load((await params).slug);
  if (!p) notFound();
  const spare = p.doubles.reduce((n, d) => n + d.spare, 0);

  return (
    <main className="mx-auto min-h-dvh max-w-6xl space-y-10 px-4 py-8 sm:px-6">
      <header className="space-y-5">
        <BrandLogo />
        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">
            Collectionneur Pokémon
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{p.name}</h1>
          {p.bio && <p className="max-w-3xl whitespace-pre-line text-muted-foreground">{p.bio}</p>}
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          {[
            { label: 'Cartes', value: p.stats.copies.toLocaleString('fr-FR') },
            ...(p.binders.length
              ? [
                  { label: 'Classeurs', value: String(p.stats.binders) },
                  { label: 'Complétés', value: String(p.stats.completed) },
                ]
              : []),
            ...(p.doubles.length ? [{ label: 'Doubles', value: String(spare) }] : []),
            { label: 'Sur TCGWatch depuis', value: formatDate(p.since) },
          ].map((s) => (
            <div key={s.label}>
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="font-display text-xl font-bold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {p.binders.length > 0 && (
        <Section title="Classeurs" count={p.binders.length}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {p.binders.map((b) => (
              <li key={b.name} className="flex gap-3 rounded-xl border bg-card p-4">
                <SafeImg src={b.logo} alt="" className="h-12 w-20 shrink-0 object-contain" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold">{b.name}</p>
                    {b.complete && (
                      <Badge variant="success">
                        <Check className="size-3" /> Complété
                      </Badge>
                    )}
                  </div>
                  <SetProgressBars progress={b.progress} />
                  {!b.progress.master && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {b.progress.full.owned}/{b.progress.full.total}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {p.showcases.length > 0 && (
        <Section title="Vitrines" count={p.showcases.length}>
          <ShowcaseList items={p.showcases} />
        </Section>
      )}

      {p.wanted.length > 0 && (
        <Section title="Je cherche" count={p.wanted.length}>
          <ShowcaseList items={p.wanted} />
        </Section>
      )}

      {p.doubles.length > 0 && (
        <Section title="Doubles à l’échange" count={spare}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {p.doubles.map((d) => (
              <CollectionCardTile
                key={`${d.card.id}-${d.variant}`}
                card={{ ...d.card, owned: d.spare }}
                link={false}
                reverse={d.variant === 'reverse'}
                showPrice={p.showPrices}
              />
            ))}
          </div>
        </Section>
      )}

      {p.binders.length + p.showcases.length + p.wanted.length + p.doubles.length === 0 && (
        <p className="text-muted-foreground">Cette page est encore vide.</p>
      )}

      <footer className="text-xs text-muted-foreground">
        Page de collectionneur partagée depuis TCGWatch
        {p.showPrices && ' · cote Cardmarket (tendance) du jour'}. Pour un échange, contacte la
        personne qui t’a envoyé ce lien.
      </footer>
    </main>
  );
}
