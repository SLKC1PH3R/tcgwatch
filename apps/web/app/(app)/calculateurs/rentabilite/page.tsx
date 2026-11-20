import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@tcgwatch/db';
import { HIT_SLOT, RARE_SLOT, simulateOpening, type OpeningCard } from '@tcgwatch/market';
import { formatPrice, toNumber } from '@tcgwatch/shared';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSealedPrices, type SealedPrice } from '@/lib/data/prices';
import { fitCard, fitColumn, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Rentabilité d’une ouverture' };

/** Générations dont la structure des boosters est modélisée. */
const SUPPORTED_SERIES = ['me', 'sv'];
const PRODUCTS = [
  { key: 'display', label: 'Display (36 boosters)', boosters: 36, category: 'display' },
  {
    key: 'demi-display',
    label: 'Demi-display (18 boosters)',
    boosters: 18,
    category: 'demi-display',
  },
  { key: 'etb', label: 'ETB (9 boosters)', boosters: 9, category: 'etb' },
  { key: 'bundle', label: 'Bundle (6 boosters)', boosters: 6, category: 'bundle' },
  { key: 'tripack', label: 'Tripack (3 boosters)', boosters: 3, category: 'tripack' },
  { key: 'boosters', label: 'Boosters à l’unité', boosters: 0, category: 'booster' },
] as const;
const MIN_VALUES = [
  { value: 0, label: 'Toutes, à leur cote' },
  { value: 0.5, label: 'À partir de 0,50 €' },
  { value: 1, label: 'À partir de 1 € (revendables)' },
  { value: 2, label: 'À partir de 2 €' },
  { value: 5, label: 'À partir de 5 €' },
];
const COMMISSION = 0.05;
/** Part minimale des cartes rares cotées pour un résultat fiable. */
const MIN_COVERAGE = 0.9;

const field =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type Props = {
  searchParams: Promise<{
    ext?: string;
    type?: string;
    prix?: string;
    boosters?: string;
    min?: string;
    commission?: string;
  }>;
};

/** Cote (ou meilleure offre) d'un produit de l'extension dans une catégorie donnée. */
function productPrice(sealed: SealedPrice[], setCode: string | null, category: string) {
  const p = sealed.find(
    (s) =>
      s.category?.key === category &&
      s.extension?.code?.toLowerCase() === setCode?.toLowerCase() &&
      (s.market ?? s.bestOffer) !== null,
  );
  return p ? { price: (p.market ?? p.bestOffer)!, product: p } : null;
}

export default async function OpeningCalculatorPage({ searchParams }: Props) {
  const q = await searchParams;
  const [sets, sealed] = await Promise.all([
    prisma.release.findMany({
      where: {
        tcgdexId: { not: null },
        serieId: { in: SUPPORTED_SERIES },
        cards: { some: { priceTrend: { gt: 0 } } },
        cardCountOfficial: { gte: 60 },
      },
      orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } },
      select: {
        id: true,
        tcgdexId: true,
        nameFr: true,
        setCode: true,
        cards: { select: { id: true, name: true, localId: true, rarity: true, priceTrend: true } },
      },
    }),
    getSealedPrices(),
  ]);
  // Cartes sans cote ignorées (pas comptées à 0 €) : la valeur d'une rareté = moyenne des
  // cartes cotées. Couverture : part des cartes rares et plus qui ont une cote.
  const toCards = (cards: (typeof sets)[number]['cards']): OpeningCard[] =>
    cards
      .filter((c) => c.rarity && c.priceTrend !== null)
      .map((c) => ({
        id: c.id,
        name: c.name,
        localId: c.localId,
        rarity: c.rarity!,
        price: toNumber(c.priceTrend) ?? 0,
      }));
  const coverage = (cards: (typeof sets)[number]['cards']) => {
    const rares = cards.filter((c) => c.rarity && !['Commune', 'Peu Commune'].includes(c.rarity));
    return rares.length ? rares.filter((c) => c.priceTrend !== null).length / rares.length : 0;
  };

  const set = sets.find((s) => s.tcgdexId === q.ext) ?? sets[0];
  const product = PRODUCTS.find((p) => p.key === q.type) ?? PRODUCTS[0];
  const boosters =
    product.boosters || Math.min(360, Math.max(1, Math.round(Number(q.boosters) || 10)));
  const minValue = MIN_VALUES.find((m) => String(m.value) === q.min)?.value ?? 0;
  const commission = q.commission === '1' ? COMMISSION : 0;
  const market = set ? productPrice(sealed, set.setCode, product.category) : null;
  const unitPrice = product.boosters ? null : (market?.price ?? null);
  const defaultPrice = product.boosters ? market?.price : unitPrice ? unitPrice * boosters : null;
  const paid =
    Number(q.prix?.replace(',', '.')) > 0
      ? Number(q.prix!.replace(',', '.'))
      : (defaultPrice ?? null);

  const result = set
    ? simulateOpening(toCards(set.cards), { boosters, minValue, commission })
    : null;
  const gain = result && paid ? result.expected - paid : null;
  const setCoverage = set ? coverage(set.cards) : 0;

  // Classement : quelle display ouvrir aujourd'hui (même filtre, même commission) ?
  const ranking = sets
    .map((s) => {
      const r = simulateOpening(toCards(s.cards), { boosters: 36, minValue, commission }, 0);
      const display = productPrice(sealed, s.setCode, 'display');
      return { s, expected: r.expected, supported: r.supported, display };
    })
    .filter((x) => x.supported && x.display && coverage(x.s.cards) >= MIN_COVERAGE)
    .sort((a, b) => b.expected / b.display!.price - a.expected / a.display!.price);

  return (
    <FitPage>
      <PageHeader
        title="Ouvrir une display, est-ce rentable ?"
        description="Ce que vaut en moyenne le contenu d’une display, d’un ETB ou de boosters, carte par carte, avec les cotes Cardmarket du jour. Entrez le prix trouvé : vous saurez si ouvrir vaut le coup, ou s’il vaut mieux garder scellé."
      />

      <div
        className={cn(
          fitGrid,
          'lg:grid-cols-[17rem_minmax(0,1fr)_18rem] xl:grid-cols-[19rem_minmax(0,1fr)_22rem]',
        )}
      >
        <Card className={cn(fitCard, 'self-start fit:self-stretch')}>
          <CardHeader className="shrink-0">
            <CardTitle>Votre calcul</CardTitle>
          </CardHeader>
          <CardContent className={cn('space-y-4', fitScroll)}>
            <form className="space-y-4">
              <label className="block space-y-1.5 text-sm font-medium">
                Extension
                <select name="ext" defaultValue={set?.tcgdexId ?? ''} className={field}>
                  {sets.map((s) => (
                    <option key={s.id} value={s.tcgdexId!}>
                      {s.nameFr}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5 text-sm font-medium">
                Produit
                <select name="type" defaultValue={product.key} className={field}>
                  {PRODUCTS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              {product.key === 'boosters' && (
                <label className="block space-y-1.5 text-sm font-medium">
                  Nombre de boosters
                  <input
                    type="number"
                    name="boosters"
                    min={1}
                    max={360}
                    defaultValue={boosters}
                    className={field}
                  />
                </label>
              )}
              <label className="block space-y-1.5 text-sm font-medium">
                Prix payé ou trouvé (€)
                <input
                  type="number"
                  name="prix"
                  min={0}
                  step="0.01"
                  defaultValue={paid ?? ''}
                  placeholder={defaultPrice ? String(defaultPrice) : 'ex. 183'}
                  className={field}
                />
                {market && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    Cote du jour : {formatPrice(market.price)}
                    {product.boosters ? '' : ' le booster'} (
                    <Link
                      href={`/produits/${market.product.id}`}
                      className="text-primary hover:underline"
                    >
                      fiche
                    </Link>
                    )
                  </span>
                )}
              </label>
              <label className="block space-y-1.5 text-sm font-medium">
                Compter les cartes
                <select name="min" defaultValue={String(minValue)} className={field}>
                  {MIN_VALUES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="commission"
                  value="1"
                  defaultChecked={commission > 0}
                />
                Déduire la commission de vente Cardmarket (5 %)
              </label>
              <Button type="submit" className="w-full">
                Faire le calcul
              </Button>
            </form>
            <details className="group rounded-lg border px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium">Comment on calcule</summary>
              <div className="mt-2 space-y-2 text-muted-foreground">
                <p>
                  Chaque booster : 4 communes, 3 peu communes, un emplacement rare et deux reverses,
                  dont l’un peut révéler une carte illustrée. Valeur d’une rareté : cote moyenne de
                  ses cartes dans l’extension (guide des prix Cardmarket du jour).
                </p>
                <p>
                  Taux de tirage estimés (moyennes communautaires, non officielles) :{' '}
                  {[...Object.entries(RARE_SLOT), ...Object.entries(HIT_SLOT)]
                    .map(([r, p]) => `${r} 1/${Math.round(1 / p)}`)
                    .join(', ')}
                  . Les reverses sont comptées à la cote de la version normale.
                </p>
                <p>
                  Non comptés : cartes énergie, codes en ligne, goodies des ETB et frais d’envoi.
                  Ces chiffres sont des moyennes : une ouverture réelle peut s’en écarter fortement.
                </p>
              </div>
            </details>
          </CardContent>
        </Card>

        <div className={fitColumn}>
          {!set || !result ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Cotes des cartes en cours d’import : le calcul sera disponible dès que les cartes
                des extensions récentes seront cotées.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card
                className={cn(
                  'shrink-0',
                  gain !== null && (gain >= 0 ? 'border-success/50' : 'border-destructive/50'),
                )}
              >
                <CardContent className="space-y-4 py-2">
                  <p className="font-display text-2xl font-bold">
                    {gain === null
                      ? `Contenu moyen : ${formatPrice(result.expected)}`
                      : gain >= 0
                        ? `En moyenne, ouvrir fait gagner ${formatPrice(gain)}`
                        : `En moyenne, ouvrir fait perdre ${formatPrice(-gain)}`}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                    <Tile label="Valeur moyenne du contenu" value={formatPrice(result.expected)} />
                    <Tile label="Prix payé" value={paid ? formatPrice(paid) : '—'} />
                    <Tile
                      label="Une ouverture sur deux vaut moins de"
                      value={formatPrice(result.median)}
                      hint={`8 sur 10 entre ${formatPrice(result.p10)} et ${formatPrice(result.p90)}`}
                    />
                    <Tile
                      label="Chance de rentrer dans ses frais"
                      value={paid ? `${Math.round(result.chanceAbove(paid) * 100)} %` : '—'}
                      hint="sur 2 000 ouvertures simulées"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {set.nameFr} · {boosters} booster{boosters > 1 ? 's' : ''}
                    {minValue > 0
                      ? ` · cartes de moins de ${formatPrice(minValue)} comptées à 0 €`
                      : ''}
                    {commission > 0 ? ' · commission Cardmarket déduite' : ''}
                  </p>
                  {setCoverage < MIN_COVERAGE && (
                    <p className="rounded-md border border-orange-400/50 bg-orange-400/10 px-3 py-2 text-sm text-orange-300">
                      Cotes incomplètes : {Math.floor(setCoverage * 100)} % des cartes rares de{' '}
                      {set.nameFr} ont une cote aujourd’hui. Le résultat sera fiable une fois toutes
                      les cartes reliées à Cardmarket (quelques jours après une sortie).
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 xl:grid-cols-2 fit:min-h-0 fit:flex-1 [&>*]:min-w-0">
                <Card className={fitCard}>
                  <CardHeader>
                    <div className="space-y-1">
                      <CardTitle>D’où vient la valeur</CardTitle>
                      <CardDescription>
                        Part de chaque rareté dans la valeur moyenne.
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className={cn('space-y-2', fitScroll)}>
                    {result.byRarity
                      .filter((r) => r.share > 0.005)
                      .map((r) => (
                        <div key={r.rarity} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{r.rarity}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {Math.round(r.share * 100)} %
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(2, r.share * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </CardContent>
                </Card>
                <Card className={fitCard}>
                  <CardHeader>
                    <div className="space-y-1">
                      <CardTitle>Les cartes qui font la valeur</CardTitle>
                      <CardDescription>Cote × nombre moyen d’exemplaires tirés.</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className={cn('px-2', fitScroll)}>
                    <ol className="divide-y">
                      {result.contributors.map(({ card, expectedCopies, contribution }) => (
                        <li key={card.id}>
                          <Link
                            href={`/cartes/${encodeURIComponent(card.id)}`}
                            className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition-colors hover:bg-accent/60"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">
                                {card.name}{' '}
                                <span className="text-muted-foreground">{card.localId}</span>
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {formatPrice(card.price)} · 1 chance sur{' '}
                                {Math.max(1, Math.round(1 / Math.max(expectedCopies, 1e-6)))}
                              </span>
                            </span>
                            <span className="text-right font-semibold tabular-nums">
                              {formatPrice(contribution)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>

        <Card className={fitCard}>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle className="text-balance">Quelle display ouvrir aujourd’hui ?</CardTitle>
              <CardDescription>
                Valeur moyenne du contenu d’une display de 36 boosters face à sa cote du jour (mêmes
                réglages).
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className={cn('px-2', fitScroll)}>
            {ranking.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                Aucune display cotée pour les extensions prises en charge.
              </p>
            ) : (
              <ol className="divide-y">
                {ranking.map(({ s, expected, display }) => {
                  const ratio = expected / display!.price;
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/calculateurs/rentabilite?ext=${s.tcgdexId}&type=display&prix=${display!.price}`}
                        className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition-colors hover:bg-accent/60"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">{s.nameFr}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatPrice(expected)} pour {formatPrice(display!.price)}
                        </span>
                        <span
                          className={cn(
                            'w-14 text-right font-semibold tabular-nums',
                            ratio >= 1 ? 'text-success' : 'text-destructive',
                          )}
                        >
                          {Math.round(ratio * 100)} %
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </FitPage>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
