import { Check, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import {
  formatDate,
  formatPercent,
  formatPrice,
  PRODUCT_TYPE_LABELS,
  todayUtc,
  type ProductTypeKey,
} from '@tcgwatch/shared';
import { AvailabilityBadge } from '@/components/availability-badge';
import { Countdown } from '@/components/countdown';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { SafeImg } from '@/components/safe-img';
import { Sparkline } from '@/components/sparkline';
import { Thumb } from '@/components/thumb';
import { TrendChart } from '@/components/trend-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getExtension,
  getExtensionCards,
  getExtensionChaseCards,
  getExtensionDates,
  getExtensionPriceEvolution,
  getExtensionProducts,
  refreshCardPrices,
  staleCardIds,
  type Extension,
  type ExtensionProduct,
} from '@/lib/data/extensions';
import { cn } from '@/lib/utils';
import { trackCardAction } from '../../cartes/actions';

const TABS = [
  { key: 'produits', label: 'Produits' },
  { key: 'cartes', label: 'Cartes' },
  { key: 'phares', label: 'Cartes phares' },
  { key: 'prix', label: 'Prix' },
  { key: 'dates', label: 'Dates' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ onglet?: string; rarete?: string; type?: string; secretes?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ext = await getExtension(decodeURIComponent((await params).code));
  return { title: ext?.nameFr ?? 'Extension' };
}

export default async function ExtensionPage({ params, searchParams }: Props) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const ext = await getExtension(decodeURIComponent(code));
  if (!ext) notFound();
  const tab: TabKey = TABS.find((t) => t.key === query.onglet)?.key ?? 'produits';
  const base = `/extensions/${encodeURIComponent(ext.tcgdexId!)}`;
  const tabHref = (key: TabKey, extra: Record<string, string | undefined> = {}) => {
    const q = new URLSearchParams();
    if (key !== 'produits') q.set('onglet', key);
    for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const counts: Record<TabKey, number | null> = {
    produits: ext._count.extensionProducts,
    cartes: ext._count.cards,
    phares: ext._count.chaseCards,
    prix: null,
    dates: null,
  };

  return (
    <FitPage>
      <PageHeader
        title={ext.nameFr}
        description={<ExtensionFacts ext={ext} />}
        actions={
          <span className="flex items-center gap-3">
            {ext.symbolUrl && (
              <SafeImg src={ext.symbolUrl} alt="Symbole" className="size-9 object-contain" />
            )}
            {ext.imageUrl && (
              <SafeImg
                src={ext.imageUrl}
                alt={`Logo ${ext.nameFr}`}
                className="h-14 max-w-48 object-contain"
              />
            )}
          </span>
        }
      />

      <nav aria-label="Onglets de l’extension" className="flex shrink-0 flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            aria-current={tab === t.key ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1 text-sm font-medium transition-colors hover:bg-accent',
              tab === t.key &&
                'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {t.label}
            {counts[t.key] !== null && (
              <span className="ml-1.5 text-xs opacity-70">{counts[t.key]}</span>
            )}
          </Link>
        ))}
      </nav>

      {/* Sur une page plein écran, l'onglet ouvert prend la hauteur restante et défile dedans. */}
      <div className="fit:min-h-0 fit:flex-1 fit:overflow-y-auto fit:[mask-image:linear-gradient(to_bottom,#000_calc(100%-1.75rem),transparent)] fit:pr-1 fit:pb-3">
        {tab === 'produits' && <ProductsTab ext={ext} />}
        {tab === 'cartes' && (
          <CardsTab
            ext={ext}
            rarity={query.rarete}
            type={query.type}
            secret={query.secretes === '1'}
            href={(extra) => tabHref('cartes', extra)}
          />
        )}
        {tab === 'phares' && <ChaseTab ext={ext} cardsHref={tabHref('cartes')} />}
        {tab === 'prix' && <PricesTab ext={ext} />}
        {tab === 'dates' && <DatesTab ext={ext} />}
      </div>
    </FitPage>
  );
}

function ExtensionFacts({ ext }: { ext: Extension }) {
  const facts = [
    ext.serieRef?.name ?? ext.serie,
    ext.setCode,
    ext.releaseDate ? `sortie FR le ${formatDate(ext.releaseDate)}` : 'date de sortie inconnue',
    ext.cardCountOfficial !== null
      ? `${ext.cardCountOfficial} cartes${
          ext.cardCountTotal && ext.cardCountTotal > ext.cardCountOfficial
            ? ` + ${ext.cardCountTotal - ext.cardCountOfficial} secrètes`
            : ''
        }`
      : null,
  ].filter(Boolean);
  return (
    <span className="flex flex-wrap items-center gap-2">
      {facts.join(' · ')}
      {ext.releaseDate && ext.releaseDate >= todayUtc() && <Countdown date={ext.releaseDate} />}
    </span>
  );
}

async function ProductsTab({ ext }: { ext: Extension }) {
  const products = await getExtensionProducts(ext.id);
  if (products.length === 0) {
    return (
      <EmptyCard text="Aucun produit scellé rattaché à cette extension pour l’instant (catalogue Pokécardex)." />
    );
  }
  const ranked = products
    .filter((p): p is ExtensionProduct & { perBooster: number } => p.perBooster !== null)
    .sort((a, b) => a.perBooster - b.perBooster);
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] [&>*]:min-w-0">
      {ranked.length > 1 && (
        <Card>
          <CardHeader className="flex-col">
            <CardTitle>Comparateur des formats</CardTitle>
            <CardDescription>
              Prix par booster de chaque format achetable aujourd’hui (prix livré quand le port de
              la boutique est connu).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {ranked.map((p, i) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <Link
                    href={`/produits/${p.id}`}
                    className="min-w-0 flex-1 basis-56 truncate hover:underline"
                  >
                    {p.name}
                  </Link>
                  {i === 0 && <Badge variant="success">Le plus avantageux</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {p.boosters} booster{p.boosters! > 1 ? 's' : ''} ·{' '}
                    {formatPrice(p.best!.delivered ?? p.best!.price)}
                    {p.best!.delivered !== null ? ' livré' : ''} · {p.best!.retailerName}
                  </span>
                  <span className="w-24 text-right font-semibold tabular-nums">
                    {formatPrice(p.perBooster)}
                    <span className="text-xs font-normal text-muted-foreground"> /b.</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <ul
        className={cn(
          'grid gap-3 sm:grid-cols-2',
          ranked.length <= 1 && 'xl:col-span-2 xl:grid-cols-3',
        )}
      >
        {products.map((p) => (
          <li key={p.id}>
            <Link
              href={`/produits/${p.id}`}
              className="flex h-full gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-accent/50"
            >
              <Thumb src={p.displayImage} className="size-20" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[
                    PRODUCT_TYPE_LABELS[p.type as ProductTypeKey] ?? p.type,
                    p.msrp !== null ? `conseillé ${formatPrice(p.msrp)}` : null,
                    p.releaseDate ? formatDate(p.releaseDate) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {p.best ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold tabular-nums">
                      {formatPrice(p.best.delivered ?? p.best.price)}
                    </span>
                    <AvailabilityBadge availability={p.best.availability} />
                    {p.perBooster !== null && (
                      <span className="text-xs text-muted-foreground">
                        {formatPrice(p.perBooster)} /booster
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {p.listings.length
                      ? 'Pas achetable actuellement'
                      : 'Aucune fiche revendeur suivie'}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function CardsTab({
  ext,
  rarity,
  type,
  secret,
  href,
}: {
  ext: Extension;
  rarity?: string;
  type?: string;
  secret: boolean;
  href: (extra: Record<string, string | undefined>) => string;
}) {
  const data = await getExtensionCards(ext, { rarity, type, secret });
  if (data.total === 0) {
    return (
      <EmptyCard text="Les cartes de cette extension n’ont pas encore été importées (import TCGdex en tâche de fond)." />
    );
  }
  // Cotes manquantes ou de plus de 24 h : relues après l'affichage, visibles au passage suivant.
  const stale = staleCardIds(data.cards);
  if (stale.length) after(() => refreshCardPrices(stale).then(() => undefined));
  const current = { rarete: rarity, type, secretes: secret ? '1' : undefined };
  const chip = (label: string, params: Record<string, string | undefined>, active: boolean) => (
    <Link
      key={label}
      href={href({ ...current, ...params })}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-accent',
        active && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
      )}
    >
      {label}
    </Link>
  );
  const returnTo = href(current);

  return (
    <Card>
      <CardHeader className="flex-col gap-3">
        <div className="space-y-1">
          <CardTitle>
            {data.cards.length === data.total
              ? `${data.total} cartes`
              : `${data.cards.length} cartes sur ${data.total}`}
          </CardTitle>
          <CardDescription>
            Cote Cardmarket (tendance) via TCGdex, mise à jour au plus une fois par jour.
            {stale.length > 0 &&
              ` ${stale.length} cote${stale.length > 1 ? 's' : ''} en cours de mise à jour : rechargez la page dans un instant.`}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chip('Toutes raretés', { rarete: undefined }, !rarity)}
          {data.rarities.map((r) => chip(r, { rarete: r }, rarity === r))}
        </div>
        {data.types.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chip('Tous types', { type: undefined }, !type)}
            {data.types.map((t) => chip(t, { type: t }, type === t))}
          </div>
        )}
        {ext.cardCountOfficial !== null && (
          <div className="flex flex-wrap gap-1.5">
            {chip('Toutes les cartes', { secretes: undefined }, !secret)}
            {chip('Cartes secrètes', { secretes: '1' }, secret)}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {data.cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune carte pour ces filtres.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {data.cards.map((c) => (
              <li key={c.id} className="flex flex-col gap-1.5">
                <Link href={`/cartes/${encodeURIComponent(c.id)}`} className="group block">
                  <div className="aspect-[63/88] overflow-hidden rounded-lg border bg-muted">
                    {c.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        referrerPolicy="no-referrer"
                        src={c.image}
                        alt={c.name}
                        loading="lazy"
                        className="size-full object-cover transition-transform group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                        Image indisponible
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-medium group-hover:underline">
                    {c.name}
                  </p>
                </Link>
                <p className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
                  <span className="truncate">
                    n° {c.localId}
                    {ext.cardCountOfficial ? `/${ext.cardCountOfficial}` : ''}
                    {c.rarity ? ` · ${c.rarity}` : ''}
                  </span>
                  <span className="shrink-0 font-semibold text-foreground tabular-nums">
                    {c.price !== null ? formatPrice(c.price) : '—'}
                  </span>
                </p>
                {c.nameMissing && (
                  <p className="text-warning-foreground text-[11px]">Nom FR manquant</p>
                )}
                {c.tracked ? (
                  <Badge variant="success" className="w-fit">
                    <Check /> Suivie
                  </Badge>
                ) : (
                  <form action={trackCardAction.bind(null, c.id, returnTo)}>
                    <Button size="sm" variant="outline" type="submit" className="h-7 w-full">
                      <Plus /> Suivre cette carte
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

async function ChaseTab({ ext, cardsHref }: { ext: Extension; cardsHref: string }) {
  const cards = await getExtensionChaseCards(ext.id);
  if (cards.length === 0) {
    return (
      <EmptyCard
        text={
          <>
            Aucune carte suivie pour cette extension.{' '}
            <Link href={cardsHref} className="text-primary hover:underline">
              Choisir dans la liste des cartes
            </Link>
            .
          </>
        }
      />
    );
  }
  return (
    <Card>
      <CardHeader className="flex-col">
        <CardTitle>Cartes suivies</CardTitle>
        <CardDescription>
          Cotes Cardmarket relevées chaque jour (sélection automatique des mieux cotées et cartes
          ajoutées à la main).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {cards.map((c) => (
            <li key={c.tcgdexId} className="flex items-center gap-3 py-2">
              <Thumb src={c.imageUrl} className="h-14 w-10" />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/cartes/${encodeURIComponent(c.tcgdexId)}`}
                  className="truncate text-sm font-medium hover:underline"
                >
                  {c.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {[c.rarity, c.manual ? 'ajoutée à la main' : 'sélection auto']
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <Sparkline values={c.values} />
              <div className="w-24 text-right">
                <p className="font-semibold tabular-nums">{formatPrice(c.last)}</p>
                {c.first && c.last !== null && c.values.length > 1 && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatPercent(c.last / c.first - 1)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

async function PricesTab({ ext }: { ext: Extension }) {
  const products = await getExtensionProducts(ext.id);
  const evo = await getExtensionPriceEvolution(products);
  return (
    <Card>
      <CardHeader className="flex-col">
        <CardTitle>Displays et ETB depuis la sortie</CardTitle>
        <CardDescription>
          Meilleur prix achetable du jour, en écart au prix conseillé (0 % = prix conseillé). Les
          points mis de côté (prix aberrants) ne comptent pas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TrendChart
          unit="pct"
          height="h-72"
          data={evo.data}
          series={evo.series.map((s, i) => ({
            key: s.id,
            label: s.name,
            color: CHART_COLORS[i % CHART_COLORS.length]!,
          }))}
          empty="Pas encore d’historique de prix pour les displays et ETB de cette extension (prix conseillé nécessaire)."
        />
      </CardContent>
    </Card>
  );
}

async function DatesTab({ ext }: { ext: Extension }) {
  const products = await getExtensionProducts(ext.id);
  const dates = await getExtensionDates(ext, products);
  return (
    <Card>
      <CardHeader className="flex-col">
        <CardTitle>Dates</CardTitle>
        <CardDescription>
          Sortie de l’extension (TCGdex), date de chaque produit (Pokécardex ou revendeur) et
          premières précommandes relevées chez les revendeurs suivis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Sortie de l’extension :{' '}
          <span className="font-semibold">{formatDate(dates.release) || 'inconnue'}</span>
        </p>
        {dates.products.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-normal">Produit</th>
                <th className="py-1 text-right font-normal">Sortie</th>
                <th className="hidden py-1 text-right font-normal sm:table-cell">
                  1re précommande vue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dates.products.map((p) => (
                <tr key={p.id}>
                  <td className="py-1.5 pr-2">
                    <Link href={`/produits/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap tabular-nums">
                    {formatDate(p.releaseDate) || '—'}
                  </td>
                  <td className="hidden py-1.5 text-right whitespace-nowrap tabular-nums sm:table-cell">
                    {formatDate(p.preorderSeen) || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-muted-foreground">
          L’historique des changements de date arrive avec les événements séparés du calendrier.
        </p>
      </CardContent>
    </Card>
  );
}

function EmptyCard({ text }: { text: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}
