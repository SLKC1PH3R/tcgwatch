import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma, type Prisma } from '@tcgwatch/db';
import { formatDate, formatPrice, toNumber } from '@tcgwatch/shared';
import { ChangeBadge } from '@/components/change-badge';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { TabPanels } from '@/components/tab-panels';
import { Thumb } from '@/components/thumb';
import { TrendChart } from '@/components/trend-chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  changeVs,
  getSealedPrices,
  getTopCards,
  toPricedCard,
  type PricedCard,
  type SealedPrice,
} from '@/lib/data/prices';
import { fitCard, fitGrid, fitScroll } from '@/lib/fit';
import { familyStats } from '@/lib/market-stats';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Indice du marché' };

/** Seuil des cartes « qui s'envolent / chutent » : sous 10 €, le bruit domine. */
const CARD_MOVE_MIN = 10;
const HISTORY_DAYS = 120;

const cardSelect = {
  id: true,
  localId: true,
  name: true,
  rarity: true,
  imageUrl: true,
  priceTrend: true,
  priceAvg7: true,
  priceAvg30: true,
  release: {
    select: {
      nameFr: true,
      setCode: true,
      tcgdexId: true,
      serieId: true,
      releaseDate: true,
      cardCountOfficial: true,
      serieRef: { select: { name: true } },
    },
  },
} as const;

/** Valeur quotidienne des displays et ETB cotés sur Cardmarket (historique des cotes). */
async function sealedHistory() {
  return prisma.$queryRaw<{ date: Date; displays: Prisma.Decimal; etb: Prisma.Decimal }[]>`
    SELECT m.date,
      sum(m.price) FILTER (WHERE p.type = 'DISPLAY') AS displays,
      sum(m.price) FILTER (WHERE p.type = 'ETB') AS etb
    FROM "MarketPrice" m JOIN "Product" p ON p.id = m."productId"
    WHERE m.source = 'cardmarket' AND m.date > CURRENT_DATE - ${HISTORY_DAYS}::int
    GROUP BY m.date ORDER BY m.date`;
}

export default async function MarketIndexPage() {
  const [sealed, topCards, cardTotals, movers, extensions, history, snapshots] = await Promise.all([
    getSealedPrices(),
    getTopCards({ limit: 10 }),
    prisma.$queryRaw<
      {
        value: Prisma.Decimal | null;
        count: bigint;
        now: Prisma.Decimal | null;
        then: Prisma.Decimal | null;
      }[]
    >`
      SELECT sum("priceTrend") AS value, count(*) AS count,
        sum("priceTrend") FILTER (WHERE "priceAvg30" > 0) AS now,
        sum("priceAvg30") FILTER (WHERE "priceAvg30" > 0) AS then
      FROM "Card" WHERE "priceTrend" > 0`,
    prisma.card.findMany({
      where: { priceTrend: { gte: CARD_MOVE_MIN }, priceAvg30: { gt: 0 } },
      select: cardSelect,
    }),
    prisma.$queryRaw<
      {
        id: string;
        tcgdexId: string;
        nameFr: string;
        releaseDate: Date | null;
        value: Prisma.Decimal;
        now: Prisma.Decimal | null;
        then: Prisma.Decimal | null;
      }[]
    >`
      SELECT r.id, r."tcgdexId", r."nameFr", r."releaseDate", sum(c."priceTrend") AS value,
        sum(c."priceTrend") FILTER (WHERE c."priceAvg30" > 0) AS now,
        sum(c."priceAvg30") FILTER (WHERE c."priceAvg30" > 0) AS then
      FROM "Card" c JOIN "Release" r ON r.id = c."releaseId"
      WHERE c."priceTrend" > 0 AND r."tcgdexId" IS NOT NULL
      GROUP BY r.id ORDER BY value DESC LIMIT 10`,
    sealedHistory(),
    prisma.marketIndexSnapshot.findMany({
      where: { key: 'cards' },
      orderBy: { date: 'asc' },
      take: HISTORY_DAYS,
    }),
  ]);

  const displays = sealed.filter((p) => p.category?.key === 'display');
  const etbs = sealed.filter((p) => p.category?.key === 'etb');
  const d = familyStats(displays);
  const e = familyStats(etbs);
  const ct = cardTotals[0];
  const cards = {
    value: toNumber(ct?.value) ?? 0,
    count: Number(ct?.count ?? 0),
    change:
      ct?.now && ct?.then && toNumber(ct.then)! > 0
        ? toNumber(ct.now)! / toNumber(ct.then)! - 1
        : null,
  };
  const total = cards.value + sealed.reduce((s, p) => s + (p.market ?? 0), 0);

  const cardMoves = movers
    .map(toPricedCard)
    .map((c) => ({ c, change: changeVs(c.price, c.avg30) }))
    .filter((m): m is { c: PricedCard; change: number } => m.change !== null);
  const up = [...cardMoves].sort((a, b) => b.change - a.change).slice(0, 8);
  const down = [...cardMoves].sort((a, b) => a.change - b.change).slice(0, 8);
  const sealedMoves = [...displays, ...etbs].filter((p) => p.change30 !== null);
  const sealedUp = [...sealedMoves].sort((a, b) => b.change30! - a.change30!).slice(0, 6);
  const sealedDown = [...sealedMoves].sort((a, b) => a.change30! - b.change30!).slice(0, 6);
  const priciest = [...displays, ...etbs]
    .filter((p) => p.market !== null)
    .sort((a, b) => b.market! - a.market!)
    .slice(0, 10);

  const cardSnap = new Map(
    snapshots.map((s) => [s.date.toISOString().slice(0, 10), toNumber(s.value)]),
  );
  const chart = history.map((h) => {
    const day = h.date.toISOString().slice(0, 10);
    return {
      day,
      displays: toNumber(h.displays),
      etb: toNumber(h.etb),
      cards: cardSnap.get(day) ?? null,
    };
  });

  return (
    <FitPage>
      <PageHeader
        title="Combien vaut le marché Pokémon ?"
        description={`La valeur de ${(cards.count + d.count + e.count).toLocaleString('fr-FR')} cartes, displays et ETB, d’après leur cote Cardmarket du jour : les plus chers, ce qui monte, ce qui chute.`}
      />

      <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Family
          label="Valeur suivie"
          value={total}
          hint="cartes, displays, ETB et autres produits"
        />
        <Family
          label="Cartes françaises"
          value={cards.value}
          count={cards.count}
          unit="cartes"
          change={cards.change}
        />
        <Family
          label="Displays"
          value={d.value}
          count={d.count}
          unit="displays"
          change={d.change}
        />
        <Family label="ETB" value={e.value} count={e.count} unit="ETB" change={e.change} />
      </div>

      <div
        className={cn(
          fitGrid,
          'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] fit:grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)]',
        )}
      >
        <Card className={fitCard}>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>La tendance générale</CardTitle>
              <CardDescription>
                Valeur totale des displays, ETB et cartes cotés, sur {HISTORY_DAYS} jours.
              </CardDescription>
            </div>
            <details className="group relative text-xs text-muted-foreground">
              <summary className="cursor-pointer list-none rounded-full border px-2.5 py-1 font-semibold hover:text-foreground">
                Méthode ⓘ
              </summary>
              <div className="absolute top-full right-0 z-20 mt-2 w-80 space-y-2 rounded-xl border bg-popover p-3 leading-relaxed shadow-lg">
                <p>
                  Cotes : tendance du guide des prix officiel de Cardmarket, publié chaque jour
                  (toutes langues et états confondus). Les cartes y sont reliées via TCGdex, les
                  produits scellés via CardNexus, avec des contrôles de cohérence (format, année,
                  date de sortie).
                </p>
                <p>
                  Variation sur 30 jours : cartes, cote du jour face à la moyenne des 30 derniers
                  jours (cartes de plus de {CARD_MOVE_MIN} € pour les hausses et baisses) ; scellé,
                  cote du jour face à celle d’il y a 30 jours, à périmètre constant. Valeur d’une
                  extension : somme des cotes de ses cartes.
                </p>
                <p>Dernière mise à jour : {formatDate(new Date())}.</p>
              </div>
            </details>
          </CardHeader>
          <CardContent className="fit:flex fit:min-h-0 fit:flex-1 fit:flex-col">
            <TrendChart
              data={chart}
              series={[
                { key: 'displays', label: 'Displays', color: 'var(--chart-1)' },
                { key: 'etb', label: 'ETB', color: 'var(--chart-2)' },
                { key: 'cards', label: 'Cartes', color: 'var(--chart-3)' },
              ]}
              height="h-72 fit:h-auto fit:min-h-32 fit:flex-1"
            />
          </CardContent>
        </Card>

        <Card className={fitCard}>
          <TabPanels
            bodyClassName={cn('px-2', fitScroll)}
            tabs={[
              { id: 'envolent', label: 'Cartes qui s’envolent', content: <CardRows cards={up} /> },
              { id: 'chutent', label: 'Qui chutent', content: <CardRows cards={down} /> },
            ]}
          />
        </Card>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 fit:min-h-0 [&>*]:min-w-0">
          <Card className={fitCard}>
            <CardHeader>
              <CardTitle>Displays et ETB · 30 j</CardTitle>
            </CardHeader>
            <TabPanels
              bodyClassName={cn('px-2', fitScroll)}
              tabs={[
                { id: 'montent', label: 'Hausses', content: <SealedRows rows={sealedUp} /> },
                { id: 'baissent', label: 'Baisses', content: <SealedRows rows={sealedDown} /> },
                { id: 'chers', label: 'Plus chers', content: <SealedRows rows={priciest} /> },
              ]}
            />
          </Card>
          <Card className={fitCard}>
            <CardHeader>
              <CardTitle>Extensions qui valent le plus</CardTitle>
            </CardHeader>
            <CardContent className={cn('px-2', fitScroll)}>
              <ol className="divide-y">
                {extensions.map((x, i) => {
                  const now = toNumber(x.now);
                  const then = toNumber(x.then);
                  return (
                    <li key={x.id}>
                      <Link
                        href={`/extensions/${encodeURIComponent(x.tcgdexId)}?onglet=cartes`}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent/60"
                      >
                        <span className="w-5 text-right text-muted-foreground tabular-nums">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{x.nameFr}</span>
                        <ChangeBadge value={now && then ? now / then - 1 : null} />
                        <span className="w-20 text-right font-semibold tabular-nums">
                          {formatPrice(Math.round(toNumber(x.value) ?? 0))}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        <Card className={fitCard}>
          <CardHeader>
            <CardTitle>Les cartes les plus chères du moment</CardTitle>
            <Link href="/produits/prix/cartes" className="text-sm text-primary hover:underline">
              Top 100 ›
            </Link>
          </CardHeader>
          <CardContent className={cn('px-2', fitScroll)}>
            <CardRows
              cards={topCards.map((c) => ({ c, change: changeVs(c.price, c.avg30) }))}
              rank
            />
          </CardContent>
        </Card>
      </div>
    </FitPage>
  );
}

function Family({
  label,
  value,
  count,
  unit,
  change,
  hint,
}: {
  label: string;
  value: number;
  count?: number;
  unit?: string;
  change?: number | null;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold tabular-nums">
        {formatPrice(Math.round(value))}
      </p>
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {count !== undefined && `${count.toLocaleString('fr-FR')} ${unit} cotés`}
        {hint}
        {change !== undefined && <ChangeBadge value={change} suffix="en 30 j" />}
      </p>
    </div>
  );
}

function CardRows({
  cards,
  rank = false,
}: {
  cards: { c: PricedCard; change: number | null }[];
  rank?: boolean;
}) {
  if (cards.length === 0)
    return (
      <p className="px-4 py-4 text-sm text-muted-foreground">Cotes des cartes en cours d’import.</p>
    );
  return (
    <ol className="divide-y">
      {cards.map(({ c, change }, i) => (
        <li key={c.id}>
          <Link
            href={`/cartes/${encodeURIComponent(c.id)}`}
            className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition-colors hover:bg-accent/60"
          >
            {rank && (
              <span className="w-6 text-right text-muted-foreground tabular-nums">{i + 1}</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {c.name} <span className="text-muted-foreground">{c.localId}</span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">{c.setName}</span>
            </span>
            <ChangeBadge value={change} />
            <span className="w-24 text-right font-semibold tabular-nums">
              {formatPrice(c.price)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function SealedRows({ rows }: { rows: SealedPrice[] }) {
  if (rows.length === 0)
    return (
      <p className="px-4 py-4 text-sm text-muted-foreground">Pas encore assez d’historique.</p>
    );
  return (
    <ol className="divide-y">
      {rows.map((p) => (
        <li key={p.id}>
          <Link
            href={`/produits/${p.id}`}
            className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition-colors hover:bg-accent/60"
          >
            <Thumb src={p.image} className="size-9 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
            <ChangeBadge value={p.change30} />
            <span className="w-24 text-right font-semibold tabular-nums">
              {formatPrice(p.market)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
