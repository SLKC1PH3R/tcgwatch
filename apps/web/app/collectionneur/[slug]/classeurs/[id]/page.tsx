import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { formatPrice } from '@tcgwatch/shared';
import { getEnv } from '@tcgwatch/shared/env';
import { BrandLogo } from '@/components/brand-logo';
import { CollectionCardTile } from '@/components/collection-card';
import { SetProgressBars } from '@/components/set-progress-bars';
import { parseSetMode, percent, SET_MODES, setSlots, type SetMode } from '@/lib/card-sets';
import { getPublicBinder } from '@/lib/data/profile';
import { cn } from '@/lib/utils';

const load = cache((slug: string, id: string) => getPublicBinder(slug, id));

const VIEWS = [
  { key: 'toutes', label: 'Toutes' },
  { key: 'possedees', label: 'Possédées' },
  { key: 'manquantes', label: 'Manquantes' },
] as const;
type View = (typeof VIEWS)[number]['key'];

type Props = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ set?: string; vue?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, id } = await params;
  const b = await load(slug, id);
  const title = b ? `${b.name} · classeur de ${b.owner}` : 'Classeur introuvable';
  const description = b
    ? `${b.progress.full.owned}/${b.progress.full.total} cartes (${percent(b.progress.full)} %)`
    : undefined;
  return {
    metadataBase: new URL(getEnv().APP_URL),
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website', siteName: 'TCGWatch' },
  };
}

export default async function PublicBinderPage({ params, searchParams }: Props) {
  const { slug, id } = await params;
  const query = await searchParams;
  const b = await load(slug, id);
  if (!b) notFound();

  const mode: SetMode = b.isSet && b.progress.master ? parseSetMode(query.set) : 'full';
  const view: View = VIEWS.find((v) => v.key === query.vue)?.key ?? 'toutes';
  const slots = setSlots(b.cards, mode).filter((s) =>
    view === 'possedees' ? s.owned > 0 : view === 'manquantes' ? s.owned === 0 : true,
  );
  const current = mode === 'master' ? b.progress.master! : b.progress.full;
  const value = b.cards.reduce((sum, c) => sum + (c.owned > 0 ? (c.price ?? 0) : 0), 0);
  const href = (m: SetMode, v: View) => {
    const q = new URLSearchParams();
    if (m === 'master') q.set('set', 'master');
    if (v !== 'toutes') q.set('vue', v);
    const s = q.toString();
    return `/collectionneur/${slug}/classeurs/${id}${s ? `?${s}` : ''}`;
  };
  const pill = (active: boolean) =>
    cn(
      'rounded-full px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground',
      active && 'bg-ink text-ink-foreground hover:text-ink-foreground',
    );

  return (
    <main className="mx-auto min-h-dvh max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-5">
        <div>
          <BrandLogo />
        </div>
        <div>
          <Link
            href={`/collectionneur/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Page de {b.owner}
          </Link>
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{b.name}</h1>
          {b.description && <p className="max-w-3xl text-muted-foreground">{b.description}</p>}
          <p className="text-sm text-muted-foreground tabular-nums">
            {current.owned}/{current.total} cartes · {percent(current)} %
            {b.showPrices && value > 0 && ` · cote des cartes possédées ${formatPrice(value)}`}
          </p>
        </div>
        <SetProgressBars progress={b.progress} className="max-w-md" />
      </header>

      <div className="flex flex-wrap gap-3">
        {b.progress.master && (
          <nav aria-label="Set" className="flex gap-1 rounded-full border bg-popover p-1">
            {SET_MODES.map((m) => (
              <Link
                key={m.key}
                href={href(m.key, view)}
                scroll={false}
                aria-current={mode === m.key ? 'page' : undefined}
                className={pill(mode === m.key)}
              >
                {m.label}
              </Link>
            ))}
          </nav>
        )}
        <nav aria-label="Cartes" className="flex gap-1 rounded-full border bg-popover p-1">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={href(mode, v.key)}
              scroll={false}
              aria-current={view === v.key ? 'page' : undefined}
              className={pill(view === v.key)}
            >
              {v.label}
            </Link>
          ))}
        </nav>
      </div>

      {slots.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {view === 'manquantes' ? 'Aucune carte manquante : classeur complet !' : 'Aucune carte.'}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {slots.map(({ key, card, variant, owned }) => (
            <CollectionCardTile
              key={key}
              card={{ ...card, owned }}
              reverse={variant === 'reverse'}
              link={false}
              dimMissing
              showPrice={b.showPrices}
            />
          ))}
        </div>
      )}

      <footer className="text-xs text-muted-foreground">
        Classeur partagé depuis TCGWatch · les emplacements manquants sont en gris
        {b.showPrices && ' · cote Cardmarket (tendance) du jour'}.
      </footer>
    </main>
  );
}
