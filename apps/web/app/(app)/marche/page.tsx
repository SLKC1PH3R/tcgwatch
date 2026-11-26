import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@tcgwatch/db';
import { createMarketProviders } from '@tcgwatch/market';
import {
  formatDate,
  formatPercent,
  formatPrice,
  PRODUCT_TYPE_LABELS,
  todayUtc,
  toNumber,
  type ProductTypeKey,
} from '@tcgwatch/shared';
import { getEnv } from '@tcgwatch/shared/env';
import { FitPage } from '@/components/fit-page';
import { KeyStrip } from '@/components/key-strip';
import { PageHeader } from '@/components/page-header';
import { Thumb } from '@/components/thumb';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { latestMarketPrices } from '@/lib/data/collection';
import { bestOffer, getProducts } from '@/lib/data/products';
import { fitCard, fitColumn, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';
import { Sparkline } from '@/components/sparkline';

export const metadata: Metadata = { title: 'Marché secondaire' };

const PERIODS = [
  { value: 'recent', label: 'Nouveautés' },
  { value: 'anciennes', label: 'Anciennes collections' },
  { value: 'tout', label: 'Tout' },
] as const;
type Period = (typeof PERIODS)[number]['value'];

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { periode } = await searchParams;
  const period: Period = PERIODS.some((p) => p.value === periode) ? (periode as Period) : 'recent';
  const [products, market, cards] = await Promise.all([
    getProducts(),
    latestMarketPrices(),
    prisma.chaseCard.findMany({
      include: {
        release: { select: { nameFr: true, setCode: true } },
        // 30 derniers relevés : mini-courbe et variation.
        prices: { orderBy: { date: 'desc' }, take: 30 },
      },
      orderBy: [{ release: { releaseDate: 'desc' } }, { name: 'asc' }],
    }),
  ]);
  const providers = createMarketProviders(getEnv());
  // Nouveautés : sorties depuis moins de 6 mois ou à venir ; anciennes : le reste.
  const recentLimit = todayUtc().getTime() - 183 * 86_400_000;
  const isRecent = (d: Date | null) => !d || d.getTime() >= recentLimit;
  // Produits avec au moins une donnée de prix : boutique achetable d'abord, puis par sortie.
  const sealed = products
    .filter((p) =>
      period === 'tout'
        ? true
        : period === 'recent'
          ? isRecent(p.releaseDate)
          : !isRecent(p.releaseDate),
    )
    .map((p) => ({ p, m: market.get(p.id), best: bestOffer(p.listings) }))
    .filter(({ p, m, best }) => best || m || p.msrp !== null)
    .sort(
      (a, b) =>
        Number(!!b.best) - Number(!!a.best) ||
        (b.p.releaseDate?.getTime() ?? 0) - (a.p.releaseDate?.getTime() ?? 0),
    );

  // Chiffres clés : produits cotés, médiane de la plus-value vs prix conseillé, boutiques sous
  // le prix conseillé, cartes phares relevées.
  const gains = sealed
    .map(({ p, m }) => (m && p.msrp ? m.price / p.msrp - 1 : null))
    .filter((g): g is number => g !== null)
    .sort((a, b) => a - b);
  const medianGain = gains.length ? gains[Math.floor(gains.length / 2)]! : null;
  const underMsrp = sealed.filter(({ p, best }) => best && p.msrp && best.price < p.msrp).length;
  const resold = sealed.filter(({ m }) => m).length;

  return (
    <FitPage>
      <PageHeader
        title="Marché secondaire"
        description="Prix constatés hors boutiques. Cardmarket n’est jamais scrapé : saisie manuelle ou API tierces."
      />

      <KeyStrip
        items={[
          {
            label: 'Produits cotés',
            value: String(resold),
            hint: `${sealed.length} produits avec au moins un prix`,
          },
          {
            label: 'Plus-value médiane',
            value: formatPercent(medianGain),
            valueClass:
              medianGain === null
                ? undefined
                : medianGain >= 0
                  ? 'text-success'
                  : 'text-destructive',
            hint: 'revente face au prix conseillé de sortie',
          },
          {
            label: 'Sous le prix conseillé',
            value: String(underMsrp),
            valueClass: underMsrp ? 'text-success' : undefined,
            hint: 'produits achetables en boutique sous leur prix de sortie',
          },
          {
            label: 'Cartes phares',
            value: String(cards.length),
            hint: 'secrètes des dernières extensions, cotées chaque jour',
          },
        ]}
      />

      <div className={cn(fitGrid, 'xl:grid-cols-[minmax(0,1fr)_24rem]')}>
        <Card className={fitCard}>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Produits scellés</CardTitle>
              <CardDescription>
                {sealed.length} produits FR · prix conseillé à la sortie (Pokécardex), meilleur prix
                achetable aujourd’hui chez les revendeurs suivis, prix de revente (annonces FR sur
                CardNexus, ou saisie).
              </CardDescription>
            </div>
            <nav aria-label="Période" className="flex flex-wrap gap-1.5">
              {PERIODS.map((p) => (
                <Link
                  key={p.value}
                  href={p.value === 'recent' ? '/marche' : `/marche?periode=${p.value}`}
                  aria-current={period === p.value ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-8 items-center rounded-full border px-3.5 text-sm font-medium transition-colors hover:bg-accent',
                    period === p.value &&
                      'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {p.label}
                </Link>
              ))}
            </nav>
          </CardHeader>
          <CardContent className={cn('px-2', fitScroll)}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right whitespace-normal">
                    Prix conseillé (sortie)
                  </TableHead>
                  <TableHead className="text-right whitespace-normal">
                    Meilleur prix boutique
                  </TableHead>
                  <TableHead className="text-right whitespace-normal">vs conseillé</TableHead>
                  <TableHead className="text-right whitespace-normal">Prix de revente</TableHead>
                  <TableHead className="text-right whitespace-normal">Plus-value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sealed.map(({ p, m, best }) => {
                  const vsMsrp = best && p.msrp ? best.price / p.msrp - 1 : null;
                  // Plus-value latente : revente (sinon prix boutique actuel) vs prix d'époque.
                  const current = m?.price ?? null;
                  const gain = current !== null && p.msrp ? current / p.msrp - 1 : null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex min-w-56 items-center gap-3">
                          <Thumb src={p.displayImage} />
                          <div className="min-w-0">
                            <Link
                              href={`/produits/${p.id}`}
                              className="line-clamp-2 font-medium hover:underline"
                            >
                              {p.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {PRODUCT_TYPE_LABELS[p.type as ProductTypeKey] ?? p.type}
                              {p.releaseDate && ` · ${formatDate(p.releaseDate)}`}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPrice(p.msrp)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {best ? (
                          <a
                            href={best.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {formatPrice(best.price)}
                            <span className="block text-xs text-muted-foreground">
                              {best.retailerName}
                            </span>
                          </a>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right tabular-nums',
                          vsMsrp !== null && vsMsrp > 0.05 && 'text-destructive',
                          vsMsrp !== null && vsMsrp < -0.02 && 'text-success',
                        )}
                      >
                        {formatPercent(vsMsrp)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m ? (
                          <>
                            {formatPrice(m.price)}
                            <span className="block text-xs text-muted-foreground">
                              {formatDate(m.date)} · {m.source}
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right tabular-nums',
                          gain !== null && gain > 0.05 && 'text-success',
                          gain !== null && gain < -0.05 && 'text-destructive',
                        )}
                      >
                        {formatPercent(gain)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className={fitColumn}>
          <Card className={cn(fitCard, 'shrink-0')}>
            <CardHeader>
              <CardTitle>Sources de prix</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {providers.map((p) => (
                  <li key={p.key} className="flex items-center justify-between gap-2">
                    <span>{p.label}</span>
                    <Badge variant={p.isEnabled() ? 'success' : 'secondary'}>
                      {p.isEnabled() ? 'Actif' : 'Non configuré'}
                    </Badge>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-2">
                  <span>TCGdex (cartes phares)</span>
                  <Badge variant="success">Actif</Badge>
                </li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Prix de revente automatique : créez une clé API gratuite dans votre compte CardNexus
                (Réglages → API) et renseignez <code>CARDNEXUS_API_KEY</code> : seule l’annonce en
                français la moins chère est retenue. PokeTrace demande l’offre Pro pour le marché
                européen.
              </p>
            </CardContent>
          </Card>
          <Card className={cn(fitCard, 'fit:flex-1')}>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle>Cartes phares</CardTitle>
                <CardDescription>
                  Cartes secrètes les mieux cotées des dernières extensions, cotations Cardmarket
                  agrégées par TCGdex, relevées chaque jour.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className={cn('px-2', fitScroll)}>
              {cards.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucune carte suivie.
                </p>
              ) : (
                <ul className="divide-y">
                  {cards.map((c) => {
                    const [last, prev] = c.prices;
                    const lastP = toNumber(last?.price);
                    const prevP = toNumber(prev?.price);
                    return (
                      <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                        {c.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            referrerPolicy="no-referrer"
                            src={c.imageUrl}
                            alt=""
                            className="h-12 w-9 shrink-0 rounded object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <span className="h-12 w-9 shrink-0 rounded bg-muted" />
                        )}
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/cartes/${encodeURIComponent(c.tcgdexId)}`}
                            className="block truncate text-sm font-medium hover:underline"
                          >
                            {c.name}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.release.setCode ?? c.release.nameFr}
                            {c.rarity && ` · ${c.rarity}`}
                          </p>
                          <Sparkline
                            width={88}
                            height={18}
                            values={c.prices
                              .map((p) => toNumber(p.price))
                              .filter((v): v is number => v !== null)
                              .reverse()}
                          />
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums">{formatPrice(lastP)}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {lastP !== null && prevP ? formatPercent(lastP / prevP - 1) : '—'}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </FitPage>
  );
}
