import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@tcgwatch/db';
import { formatDate, formatPrice } from '@tcgwatch/shared';
import { ChangeBadge } from '@/components/change-badge';
import { PageHeader } from '@/components/page-header';
import { SafeImg } from '@/components/safe-img';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { changeVs, getTopCards, toPricedCard, type PricedCard } from '@/lib/data/prices';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Prix des cartes' };

/** Seuil des hausses et baisses : sous 5 €, une variation n'a pas de sens. */
const MOVE_MIN = 5;
const RECENT_SETS = 6;

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

type Props = { searchParams: Promise<{ serie?: string }> };

export default async function CardPricesPage({ searchParams }: Props) {
  const { serie } = await searchParams;
  const [top, series, stats, recentSets, movers] = await Promise.all([
    getTopCards({ limit: 100, serieId: serie }),
    prisma.serie.findMany({
      where: { releases: { some: { cards: { some: { priceTrend: { gt: 0 } } } } } },
      orderBy: { order: 'desc' },
      select: { id: true, name: true },
    }),
    prisma.card.aggregate({
      where: { priceTrend: { gt: 0 } },
      _count: { _all: true },
      _max: { priceAt: true },
    }),
    prisma.release.findMany({
      where: {
        tcgdexId: { not: null },
        ...(serie ? { serieId: serie } : {}),
        cards: { some: { priceTrend: { gt: 0 } } },
      },
      orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } },
      take: RECENT_SETS,
      select: {
        id: true,
        nameFr: true,
        tcgdexId: true,
        releaseDate: true,
        cardCountTotal: true,
        cards: {
          where: { priceTrend: { gt: 0 } },
          orderBy: { priceTrend: 'desc' },
          take: 10,
          select: cardSelect,
        },
      },
    }),
    prisma.card.findMany({
      where: {
        priceTrend: { gte: MOVE_MIN },
        priceAvg7: { gt: 0 },
        ...(serie ? { release: { serieId: serie } } : {}),
      },
      select: cardSelect,
    }),
  ]);
  const over1000 = await prisma.card.count({ where: { priceTrend: { gte: 1000 } } });
  const setValues = new Map(
    (
      await prisma.card.groupBy({
        by: ['releaseId'],
        where: { releaseId: { in: recentSets.map((r) => r.id) }, priceTrend: { gt: 0 } },
        _sum: { priceTrend: true },
      })
    ).map((g) => [g.releaseId, Number(g._sum.priceTrend ?? 0)]),
  );
  const moves = movers
    .map(toPricedCard)
    .map((c) => ({ c, change: changeVs(c.price, c.avg7) }))
    .filter((m): m is { c: PricedCard; change: number } => m.change !== null);
  const risers = [...moves].sort((a, b) => b.change - a.change).slice(0, 8);
  const fallers = [...moves].sort((a, b) => a.change - b.change).slice(0, 8);
  const podium = top.slice(0, 3);
  const rest = top.slice(3);
  const chip = (label: string, to: string, active: boolean) => (
    <Link
      key={to}
      href={to}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex h-8 items-center rounded-full border px-3.5 text-sm font-medium transition-colors hover:bg-accent',
        active && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
      )}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Prix des cartes à l’unité"
        description="Cote Cardmarket du jour de chaque carte (guide des prix officiel), cartes les plus chères, plus fortes hausses et baisses de la semaine."
        actions={
          <form action="/cartes" className="flex gap-2">
            <Input
              name="q"
              placeholder="Nom de la carte : Dracaufeu…"
              aria-label="Trouver la valeur d’une carte"
              className="w-56"
            />
            <Button type="submit">
              <Search /> Trouver la valeur
            </Button>
          </form>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Cartes cotées" value={stats._count._all.toLocaleString('fr-FR')} />
        <Tile
          label="La plus chère"
          value={top[0] ? formatPrice(top[0].price) : '—'}
          hint={top[0] ? `${top[0].name} · ${top[0].setName}` : undefined}
        />
        <Tile label="Cartes à plus de 1 000 €" value={String(over1000)} />
        <Tile
          label="Mise à jour"
          value={stats._max.priceAt ? formatDate(stats._max.priceAt) : '—'}
          hint="guide des prix Cardmarket"
        />
      </div>

      {stats._count._all === 0 && (
        <Card className="mb-6">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Cotes en cours d’import : le worker relie chaque carte à Cardmarket par lots quotidiens,
            puis applique le guide des prix chaque matin.
          </CardContent>
        </Card>
      )}

      <nav aria-label="Séries" className="mb-6 flex flex-wrap gap-1.5">
        {chip('Toutes les séries', '/produits/prix/cartes', !serie)}
        {series.map((s) => chip(s.name, `/produits/prix/cartes?serie=${s.id}`, serie === s.id))}
      </nav>

      {podium.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-xl font-semibold">Le podium du jour</h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {podium.map((c, i) => (
              <li key={c.id}>
                <Link
                  href={`/cartes/${encodeURIComponent(c.id)}`}
                  className="flex h-full gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-accent/40"
                >
                  <SafeImg src={c.image} alt="" className="h-28 w-20 rounded object-contain" />
                  <div className="min-w-0 space-y-1">
                    <span className="font-display text-3xl font-bold text-primary">{i + 1}</span>
                    <p className="font-semibold">
                      {c.name} <span className="text-muted-foreground">{c.localId}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.setName}
                      {c.releaseDate ? ` · ${c.releaseDate.getUTCFullYear()}` : ''}
                    </p>
                    <p className="font-display text-lg font-bold tabular-nums">
                      {formatPrice(c.price)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {rest.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Le classement complet</CardTitle>
              <CardDescription>
                Top {top.length} des cartes françaises par cote du jour
                {serie ? ` (${series.find((s) => s.id === serie)?.name ?? serie})` : ''}.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-2">
            <ol className="divide-y">
              {rest.map((c, i) => (
                <li key={c.id}>
                  <Link
                    href={`/cartes/${encodeURIComponent(c.id)}`}
                    className="flex items-center gap-3 rounded-lg px-4 py-2.5 transition-colors hover:bg-accent/60"
                  >
                    <span className="w-8 shrink-0 text-right text-sm font-semibold text-muted-foreground tabular-nums">
                      {i + 4}
                    </span>
                    <SafeImg
                      src={c.image}
                      alt=""
                      className="h-10 w-7 shrink-0 rounded object-contain"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {c.name} <span className="text-muted-foreground">{c.localId}</span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.setName}
                        {c.releaseDate ? ` · ${c.releaseDate.getUTCFullYear()}` : ''}
                        {c.rarity ? ` · ${c.rarity}` : ''}
                      </span>
                    </span>
                    <ChangeBadge value={changeVs(c.price, c.avg30)} className="hidden sm:inline" />
                    <span className="w-24 shrink-0 text-right font-semibold tabular-nums">
                      {formatPrice(c.price)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {(risers.length > 0 || fallers.length > 0) && (
        <div className="mb-8 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <MoveList title="Les plus fortes hausses de la semaine" moves={risers} />
          <MoveList title="Les plus fortes baisses de la semaine" moves={fallers} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        {recentSets.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle>Les 10 cartes {r.nameFr} les plus chères</CardTitle>
                <CardDescription>
                  {r.releaseDate ? `Sortie le ${formatDate(r.releaseDate)} · ` : ''}
                  {r.cardCountTotal ? `${r.cardCountTotal} cartes · ` : ''}
                  valeur de l’extension {formatPrice(setValues.get(r.id) ?? 0)}
                </CardDescription>
              </div>
              <Link
                href={`/extensions/${encodeURIComponent(r.tcgdexId!)}?onglet=cartes`}
                className="text-sm text-primary hover:underline"
              >
                Toutes les cartes ›
              </Link>
            </CardHeader>
            <CardContent className="px-2">
              <ol className="divide-y">
                {r.cards.map(toPricedCard).map((c, i) => (
                  <li key={c.id}>
                    <Link
                      href={`/cartes/${encodeURIComponent(c.id)}`}
                      className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition-colors hover:bg-accent/60"
                    >
                      <span className="w-6 text-right text-muted-foreground tabular-nums">
                        #{i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {c.name} <span className="text-muted-foreground">{c.localId}</span>
                      </span>
                      <ChangeBadge value={changeVs(c.price, c.avg30)} />
                      <span className="w-20 text-right font-semibold tabular-nums">
                        {formatPrice(c.price)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Cote : tendance du guide des prix Cardmarket, toutes langues et états confondus (prix réel
        de vente, pas de cote inventée). Variation : cote du jour face à la moyenne des 30 derniers
        jours (classement) ou des 7 derniers jours (hausses et baisses, cartes de plus de {MOVE_MIN}{' '}
        €).
      </p>
    </>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="line-clamp-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MoveList({ title, moves }: { title: string; moves: { c: PricedCard; change: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        <ul className="divide-y">
          {moves.map(({ c, change }) => (
            <li key={c.id}>
              <Link
                href={`/cartes/${encodeURIComponent(c.id)}`}
                className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition-colors hover:bg-accent/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {c.name} <span className="text-muted-foreground">{c.localId}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{c.setName}</span>
                </span>
                <ChangeBadge value={change} />
                <span className="w-20 text-right font-semibold tabular-nums">
                  {formatPrice(c.price)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
