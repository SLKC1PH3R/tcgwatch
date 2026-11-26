import { Check, Heart, MapPin, MessageCircle } from 'lucide-react';
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
import { accentColor, contactHref } from '@/lib/profile-accents';

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
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();
  const spare = p.doubles.reduce((n, d) => n + d.spare, 0);
  const accent = accentColor(p.accent);

  return (
    <main className="mx-auto min-h-dvh max-w-6xl space-y-10 px-4 py-8 sm:px-6">
      <header className="space-y-5">
        <BrandLogo />
        <div
          className="flex flex-col gap-5 rounded-3xl border p-5 sm:flex-row sm:items-center sm:p-6"
          style={{ background: `linear-gradient(120deg, ${accent}38, transparent 65%)` }}
        >
          {p.avatar?.image && (
            <div
              className="size-24 shrink-0 overflow-hidden rounded-3xl border-2 bg-muted sm:size-28"
              style={{ borderColor: accent }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.avatar.image}
                alt={p.avatar.name}
                referrerPolicy="no-referrer"
                className="size-full scale-150 object-cover object-[50%_30%]"
              />
            </div>
          )}
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-semibold tracking-wide uppercase" style={{ color: accent }}>
              Collectionneur Pokémon
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{p.name}</h1>
            {p.bio && (
              <p className="max-w-3xl whitespace-pre-line text-muted-foreground">{p.bio}</p>
            )}
            {(p.favorite || p.location || p.contact) && (
              <ul className="flex flex-wrap gap-2 text-sm">
                {p.favorite && (
                  <li className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1">
                    <Heart className="size-3.5" style={{ color: accent }} /> {p.favorite}
                  </li>
                )}
                {p.location && (
                  <li className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1">
                    <MapPin className="size-3.5" style={{ color: accent }} /> {p.location}
                  </li>
                )}
                {p.contact && (
                  <li className="inline-flex min-w-0 items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1">
                    <MessageCircle className="size-3.5 shrink-0" style={{ color: accent }} />
                    {contactHref(p.contact) ? (
                      <a
                        href={contactHref(p.contact)!}
                        target="_blank"
                        rel="nofollow ugc noopener noreferrer"
                        className="truncate underline-offset-2 hover:underline"
                      >
                        {p.contact.replace(/^https:\/\/(www\.)?/i, '')}
                      </a>
                    ) : (
                      <span className="truncate">{p.contact}</span>
                    )}
                  </li>
                )}
              </ul>
            )}
          </div>
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

      {p.featured && (
        <Section title={p.featured.wanted ? `Je cherche : ${p.featured.title}` : p.featured.title}>
          {p.featured.description && (
            <p className="-mt-2 max-w-3xl text-muted-foreground">{p.featured.description}</p>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {p.featured.cards.slice(0, 10).map((c) => (
              <CollectionCardTile
                key={c.id}
                card={c}
                link={false}
                showOwned={false}
                showPrice={p.featured!.showPrices}
              />
            ))}
          </div>
          {p.featured.cards.length > 10 && (
            <Link
              href={`/vitrine/${p.featured.slug}`}
              className="inline-block text-sm font-semibold hover:underline"
              style={{ color: accent }}
            >
              Voir les {p.featured.cards.length} cartes →
            </Link>
          )}
        </Section>
      )}

      {p.binders.length > 0 && (
        <Section title="Classeurs" count={p.binders.length}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {p.binders.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/collectionneur/${slug}/classeurs/${b.id}`}
                  className="flex h-full gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
                >
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
                </Link>
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

      {p.binders.length + p.showcases.length + p.wanted.length + p.doubles.length === 0 &&
        !p.featured && <p className="text-muted-foreground">Cette page est encore vide.</p>}

      <footer className="text-xs text-muted-foreground">
        Page de collectionneur partagée depuis TCGWatch
        {p.showPrices && ' · cote Cardmarket (tendance) du jour'}. Pour un échange, contactez la
        personne qui vous a envoyé ce lien.
      </footer>
    </main>
  );
}
