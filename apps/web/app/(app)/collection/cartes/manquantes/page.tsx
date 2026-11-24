import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { formatPrice } from '@tcgwatch/shared';
import { AutoSubmitSelect } from '@/components/auto-submit-select';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { PriceSourceToggle } from '@/components/price-source-toggle';
import { SafeImg } from '@/components/safe-img';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth';
import { parseSetMode, SET_MODES, type SetMode, setProgress, setSlots } from '@/lib/card-sets';
import { getCardCollection, getReleaseCards } from '@/lib/data/card-collection';
import { fitCard, fitScroll } from '@/lib/fit';
import { PRICE_COOKIE, parsePriceSource } from '@/lib/price-source';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Ce qu’il me manque' };

type Props = { searchParams: Promise<{ extension?: string; set?: string }> };

/**
 * Cartes manquantes d'une extension commencée (Full Set ou Master Set), des plus chères aux
 * moins chères, et le coût pour la compléter au prix Cardmarket ou eBay FR.
 */
export default async function MissingCardsPage({ searchParams }: Props) {
  const user = await requireUser();
  const [{ extension, set }, jar, collection] = await Promise.all([
    searchParams,
    cookies(),
    getCardCollection(user.id),
  ]);
  const priceSource = parsePriceSource(jar.get(PRICE_COOKIE)?.value);
  const started = collection.releases;
  const code = extension ?? started[0]?.code;
  const data = code ? await getReleaseCards(user.id, code) : null;

  const href = (c: string | undefined, m: SetMode) => {
    const params = new URLSearchParams();
    if (c) params.set('extension', c);
    if (m === 'master') params.set('set', 'master');
    return `/collection/cartes/manquantes?${params}`;
  };

  if (!data) {
    return (
      <FitPage>
        <PageHeader
          title="Ce qu’il me manque"
          description="Ajoute d’abord des cartes d’une extension : ses manquantes et le coût pour la compléter apparaîtront ici."
        />
      </FitPage>
    );
  }

  const progress = setProgress(data.cards);
  const mode: SetMode = progress.master ? parseSetMode(set) : 'full';
  const missing = setSlots(data.cards, mode)
    .filter((s) => s.owned === 0)
    .map((s) => ({
      ...s,
      cm: s.card.price,
      fr: s.card.frPrice,
      price: priceSource === 'ebay' ? s.card.frPrice : s.card.price,
    }))
    .sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  const sum = (key: 'cm' | 'fr') => missing.reduce((n, s) => n + (s[key] ?? 0), 0);
  const unpriced = (key: 'cm' | 'fr') => missing.filter((s) => s[key] === null).length;
  const totals = [
    { key: 'cm' as const, label: 'Cardmarket', hint: 'cote tendance, toutes langues' },
    { key: 'fr' as const, label: 'eBay FR', hint: 'médiane des annonces en français' },
  ];

  return (
    <FitPage>
      <PageHeader
        title="Ce qu’il me manque"
        description={`${data.release.nameFr} : ${missing.length} carte${missing.length > 1 ? 's' : ''} pour compléter le ${mode === 'master' ? 'Master Set' : 'Full Set'}, des plus chères aux moins chères. Les reverses sont estimées au prix de la carte classique.`}
        actions={
          <>
            {progress.master && (
              <nav aria-label="Set" className="flex rounded-lg border p-0.5">
                {SET_MODES.map((m) => (
                  <Link
                    key={m.key}
                    href={href(code, m.key)}
                    aria-current={mode === m.key ? 'page' : undefined}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium',
                      mode === m.key
                        ? m.key === 'master'
                          ? 'bg-info text-black'
                          : 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent',
                    )}
                  >
                    {m.label}
                  </Link>
                ))}
              </nav>
            )}
            <PriceSourceToggle current={priceSource} />
            <Button asChild variant="outline">
              <Link
                href={`/collection/cartes/ajout-rapide?extension=${encodeURIComponent(code!)}${mode === 'master' ? '&set=master' : ''}`}
              >
                Ajout rapide
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid shrink-0 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground">Extension</p>
          <form className="mt-1">
            <AutoSubmitSelect
              name="extension"
              value={code ?? ''}
              label="Extension"
              className="h-9 w-full rounded-lg border bg-secondary px-2 text-sm font-medium"
              options={started.map((r) => ({ value: r.code, label: r.name }))}
            />
            {mode === 'master' && <input type="hidden" name="set" value="master" />}
          </form>
        </div>
        {totals.map((t) => (
          <div
            key={t.key}
            className={cn(
              'rounded-2xl border bg-card px-4 py-3',
              (priceSource === 'ebay') === (t.key === 'fr') && 'border-foreground/30',
            )}
          >
            <p className="text-xs font-semibold text-muted-foreground">
              Pour compléter · {t.label}
            </p>
            <p
              className={cn(
                'font-display text-2xl font-bold tabular-nums',
                t.key === 'fr' && 'text-info',
              )}
            >
              {missing.length === 0 ? '—' : `≈ ${formatPrice(sum(t.key))}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.hint}
              {unpriced(t.key) > 0 &&
                ` · ${unpriced(t.key)} carte${unpriced(t.key) > 1 ? 's' : ''} sans prix`}
            </p>
          </div>
        ))}
      </div>

      <Card className={cn(fitCard, 'pb-0')}>
        <CardHeader className="shrink-0">
          <CardTitle>
            Manquantes{' '}
            <span className="font-sans text-sm text-muted-foreground">· {missing.length}</span>
          </CardTitle>
          <CardDescription>
            Prix {priceSource === 'ebay' ? 'eBay FR' : 'Cardmarket'} en premier, l’autre à côté pour
            comparer.
          </CardDescription>
        </CardHeader>
        <CardContent className={cn('px-0', fitScroll)}>
          {missing.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">
              Rien ne manque : le {mode === 'master' ? 'Master Set' : 'Full Set'} est complet.
            </p>
          ) : (
            <ul className="divide-y">
              {missing.map((s) => {
                const other = priceSource === 'ebay' ? s.cm : s.fr;
                return (
                  <li key={s.key}>
                    <Link
                      href={`/cartes/${encodeURIComponent(s.card.id)}`}
                      className="flex items-center gap-3 px-6 py-2 transition-colors hover:bg-accent"
                    >
                      <SafeImg
                        src={s.card.image}
                        alt=""
                        className="h-14 w-10 shrink-0 rounded bg-muted object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {s.card.name}
                          {s.variant === 'reverse' && (
                            <span className="ml-2 rounded-full bg-info px-1.5 py-0.5 text-[10px] font-bold text-black">
                              Reverse
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          n° {s.card.localId}
                          {s.card.rarity ? ` · ${s.card.rarity}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <p
                          className={cn(
                            'text-sm font-semibold',
                            priceSource === 'ebay' && 'text-info',
                          )}
                        >
                          {s.price === null ? '—' : formatPrice(s.price)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {priceSource === 'ebay' ? 'Cardmarket' : 'FR'}{' '}
                          {other === null ? '—' : formatPrice(other)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </FitPage>
  );
}
