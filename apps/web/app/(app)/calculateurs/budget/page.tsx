import { ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@tcgwatch/db';
import { fold, formatDate, formatPrice } from '@tcgwatch/shared';
import { PageHeader } from '@/components/page-header';
import { SafeImg } from '@/components/safe-img';
import { Thumb } from '@/components/thumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSealedPrices, toPricedCard } from '@/lib/data/prices';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Budget Pokémon' };

const BUDGETS = [20, 50, 100, 150, 250, 500];
const LOOKING = [
  { key: 'tout', label: 'Un peu de tout', hint: 'Cartes et produits scellés' },
  { key: 'cartes', label: 'Des cartes', hint: 'À l’unité, au prix du marché' },
  { key: 'etb', label: 'Des ETB', hint: 'Coffrets Dresseur d’Élite' },
  { key: 'display', label: 'Des displays', hint: 'Boîtes de 36 boosters' },
] as const;
const GOALS = [
  { key: 'ouvrir', label: 'Ouvrir des boosters', hint: 'Le plaisir de l’ouverture' },
  { key: 'collection', label: 'Ma collection', hint: 'Des cartes précises' },
  { key: 'garder', label: 'Garder scellé', hint: 'Sous blister, pour plus tard' },
  { key: 'offrir', label: 'Offrir', hint: 'Un cadeau qui fait plaisir' },
] as const;
type LookingKey = (typeof LOOKING)[number]['key'];
type GoalKey = (typeof GOALS)[number]['key'];

/** Catégories de scellé adaptées à chaque usage. */
const GOAL_CATEGORIES: Record<GoalKey, string[]> = {
  ouvrir: ['booster', 'bundle', 'tripack', 'blister', 'display', 'demi-display', 'etb'],
  collection: ['coffret', 'upc', 'pokebox'],
  garder: ['etb', 'display', 'demi-display', 'upc', 'coffret', 'bundle'],
  offrir: ['coffret', 'etb', 'pokebox', 'tripack', 'mini-tin', 'upc', 'blister'],
};

interface Item {
  key: string;
  kind: 'carte' | 'scellé';
  name: string;
  detail: string;
  category: string;
  price: number;
  /** Offre en boutique (lien direct), sinon cote du marché. */
  offer: { retailer: string; url: string } | null;
  href: string;
  image: string | null;
}

type Props = {
  searchParams: Promise<{
    budget?: string;
    cherche?: string;
    pour?: string;
    pokemon?: string;
    recent?: string;
  }>;
};

/** Le plus beau produit qui rentre dans le budget. */
function favourite(items: Item[], budget: number): Item[] {
  const best = items.filter((i) => i.price <= budget).sort((a, b) => b.price - a.price)[0];
  return best ? [best] : [];
}

/** Plusieurs produits différents (catégories variées d'abord) qui remplissent le budget. */
function plenty(items: Item[], budget: number): Item[] {
  const pool = items.filter((i) => i.price <= budget / 2).sort((a, b) => b.price - a.price);
  const picked: Item[] = [];
  let left = budget;
  for (const pass of [0, 1]) {
    for (const i of pool) {
      if (picked.includes(i) || i.price > left) continue;
      if (pass === 0 && picked.some((p) => p.category === i.category)) continue;
      picked.push(i);
      left -= i.price;
    }
  }
  return picked.length > 1 ? picked : [];
}

/** Deux ou trois produits de bonne taille. */
function balanced(items: Item[], budget: number): Item[] {
  const sorted = items.filter((i) => i.price <= budget * 0.6).sort((a, b) => b.price - a.price);
  const first = sorted.find((i) => i.price <= budget * 0.55);
  if (!first) return [];
  const picked = [first];
  let left = budget - first.price;
  for (const i of sorted) {
    if (picked.length >= 3) break;
    if (picked.includes(i) || i.price > left || i.category === first.category) continue;
    picked.push(i);
    left -= i.price;
  }
  return picked.length > 1 ? picked : [];
}

export default async function BudgetPage({ searchParams }: Props) {
  const q = await searchParams;
  const budget = Math.min(10_000, Math.max(5, Math.round(Number(q.budget) || 100)));
  const looking: LookingKey = LOOKING.find((l) => l.key === q.cherche)?.key ?? 'tout';
  const goal: GoalKey = GOALS.find((g) => g.key === q.pour)?.key ?? 'ouvrir';
  const pokemon = (q.pokemon ?? '').trim();
  const recentOnly = q.recent === '1';
  const words = fold(pokemon).split(/\s+/).filter(Boolean);
  const nameOk = (name: string) => words.every((w) => fold(name).includes(w));

  const latestSerie = await prisma.serie.findFirst({
    where: { releases: { some: { tcgdexId: { not: null } } } },
    orderBy: { order: 'desc' },
    select: { id: true, name: true },
  });

  const wantsSealed = looking !== 'cartes';
  const wantsCards = looking === 'cartes' || (looking === 'tout' && goal === 'collection');
  const [sealed, cards] = await Promise.all([
    wantsSealed ? getSealedPrices() : Promise.resolve([]),
    wantsCards
      ? prisma.card.findMany({
          where: {
            priceTrend: { gte: 1, lte: budget },
            ...(recentOnly && latestSerie ? { release: { serieId: latestSerie.id } } : {}),
            ...(words.length
              ? { AND: words.map((w) => ({ name: { contains: w, mode: 'insensitive' as const } })) }
              : {}),
          },
          orderBy: { priceTrend: 'desc' },
          take: 300,
          select: {
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
          },
        })
      : Promise.resolve([]),
  ]);

  const sealedCategories =
    looking === 'etb'
      ? ['etb']
      : looking === 'display'
        ? ['display', 'demi-display']
        : GOAL_CATEGORIES[goal];
  const items: Item[] = [
    ...sealed
      .filter((p) => p.category && sealedCategories.includes(p.category.key))
      .filter((p) => !recentOnly || p.serie?.id === latestSerie?.id)
      .filter((p) => nameOk(p.name))
      .flatMap((p): Item[] => {
        const price = p.bestOffer ?? p.market;
        if (price === null) return [];
        return [
          {
            key: p.id,
            kind: 'scellé',
            name: p.name,
            detail: [
              p.category!.label,
              p.releaseDate ? `Sortie le ${formatDate(p.releaseDate)}` : null,
            ]
              .filter(Boolean)
              .join(' · '),
            category: p.category!.key,
            price,
            offer:
              p.bestOffer !== null && p.bestUrl
                ? { retailer: p.bestRetailer!, url: p.bestUrl }
                : null,
            href: `/produits/${p.id}`,
            image: p.image,
          },
        ];
      }),
    ...cards.map(toPricedCard).map((c): Item => ({
      key: c.id,
      kind: 'carte',
      name: `${c.name} ${c.localId}`,
      detail: [c.setName, c.rarity].filter(Boolean).join(' · '),
      category: `carte-${c.rarity ?? ''}`,
      price: c.price,
      offer: null,
      href: `/cartes/${encodeURIComponent(c.id)}`,
      image: c.image,
    })),
  ].filter((i) => i.price <= budget);

  const ideas = [
    {
      title: 'Le coup de cœur',
      hint: 'Un seul produit, le plus beau que permet votre budget.',
      items: favourite(items, budget),
    },
    {
      title: 'Le plein de plaisir',
      hint: 'Plusieurs produits différents qui remplissent votre budget.',
      items: plenty(items, budget),
    },
    {
      title: 'Le juste milieu',
      hint: 'Deux ou trois produits de bonne taille.',
      items: balanced(items, budget),
    },
  ];
  const all = [...items].sort((a, b) => b.price - a.price).slice(0, 60);

  const href = (params: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    const merged = {
      budget: String(budget),
      cherche: looking,
      pour: goal,
      pokemon: pokemon || undefined,
      recent: recentOnly ? '1' : undefined,
      ...params,
    };
    for (const [k, v] of Object.entries(merged)) if (v) s.set(k, v);
    return `/calculateurs/budget?${s}`;
  };
  const option = (label: string, hint: string | undefined, to: string, active: boolean) => (
    <Link
      key={to}
      href={to}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-xl border px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
        active && 'border-primary bg-primary/10',
      )}
    >
      <span className="block font-medium">{label}</span>
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Que acheter en Pokémon avec votre budget ?"
        description="Indiquez combien vous voulez dépenser et ce que vous cherchez : trois idées d’achat au prix du jour (meilleure offre chez les revendeurs suivis, sinon cote du marché), avec tout ce qui rentre dans votre budget."
      />

      <Card className="mb-8">
        <CardContent className="space-y-5 py-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">1. Mon budget : {formatPrice(budget)} maximum</h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {BUDGETS.map((b) => (
                <Link
                  key={b}
                  href={href({ budget: String(b) })}
                  aria-current={b === budget ? 'true' : undefined}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent',
                    b === budget &&
                      'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {b} €
                </Link>
              ))}
              <form className="flex items-center gap-1.5">
                <input type="hidden" name="cherche" value={looking} />
                <input type="hidden" name="pour" value={goal} />
                {pokemon && <input type="hidden" name="pokemon" value={pokemon} />}
                {recentOnly && <input type="hidden" name="recent" value="1" />}
                <input
                  type="number"
                  name="budget"
                  min={5}
                  max={10000}
                  defaultValue={budget}
                  aria-label="Autre montant"
                  className="h-8 w-24 rounded-md border border-input bg-transparent px-2 text-sm"
                />
                <Button type="submit" size="sm" variant="outline">
                  OK
                </Button>
              </form>
            </div>
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">2. Je cherche</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {LOOKING.map((l) =>
                option(l.label, l.hint, href({ cherche: l.key }), l.key === looking),
              )}
            </div>
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">3. C’est pour</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {GOALS.map((g) => option(g.label, g.hint, href({ pour: g.key }), g.key === goal))}
            </div>
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">4. Mes préférences (facultatif)</h2>
            <form className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="budget" value={budget} />
              <input type="hidden" name="cherche" value={looking} />
              <input type="hidden" name="pour" value={goal} />
              <input
                name="pokemon"
                defaultValue={pokemon}
                placeholder="Mon Pokémon préféré : Pikachu…"
                aria-label="Mon Pokémon préféré"
                className="h-9 w-64 rounded-md border border-input bg-transparent px-3 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="recent" value="1" defaultChecked={recentOnly} />
                Seulement la série la plus récente{latestSerie ? ` (${latestSerie.name})` : ''}
              </label>
              <Button type="submit" size="sm">
                Appliquer
              </Button>
            </form>
          </section>
        </CardContent>
      </Card>

      <h2 className="mb-3 font-display text-xl font-semibold">
        3 idées pour {formatPrice(budget)}
      </h2>
      <div className="mb-8 grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        {ideas.map((idea, n) => {
          const total = idea.items.reduce((s, i) => s + i.price, 0);
          return (
            <Card key={idea.title}>
              <CardHeader>
                <div className="space-y-1">
                  <CardDescription>
                    Idée {n + 1} · {idea.items.length} produit{idea.items.length > 1 ? 's' : ''}
                  </CardDescription>
                  <CardTitle>{idea.title}</CardTitle>
                  <CardDescription>{idea.hint}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {idea.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Pas de combinaison possible avec ces critères.
                  </p>
                ) : (
                  <>
                    <ul className="space-y-2">
                      {idea.items.map((i) => (
                        <ItemRow key={i.key} item={i} />
                      ))}
                    </ul>
                    <p className="flex justify-between border-t pt-2 text-sm">
                      <span>
                        Total <strong className="tabular-nums">{formatPrice(total)}</strong>
                      </span>
                      <span className="text-muted-foreground">
                        Il reste {formatPrice(budget - total)}
                      </span>
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Tout ce qui rentre dans {formatPrice(budget)}</CardTitle>
            <CardDescription>
              {items.length} possibilité{items.length > 1 ? 's' : ''}, de la plus chère à la moins
              chère{items.length > all.length ? ` (${all.length} premières)` : ''}.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {all.length === 0 ? (
            <p className="text-sm text-muted-foreground">Rien ne correspond à ces critères.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {all.map((i) => (
                <ItemRow key={i.key} item={i} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground">
        Prix du scellé : meilleure offre achetable chez les revendeurs suivis (prix livré quand le
        port est connu), sinon cote Cardmarket du jour. Cartes : cote Cardmarket du jour, à acheter
        sur une plateforme de vente entre particuliers.
      </p>
    </>
  );
}

function ItemRow({ item: i }: { item: Item }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border p-2">
      {i.kind === 'carte' ? (
        <SafeImg src={i.image} alt="" className="h-12 w-9 shrink-0 rounded object-contain" />
      ) : (
        <Thumb src={i.image} className="size-12 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <Link href={i.href} className="line-clamp-2 text-sm font-medium hover:underline">
          {i.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{i.detail}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <strong className="tabular-nums">{formatPrice(i.price)}</strong>
          {i.offer ? (
            <a
              href={i.offer.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              chez {i.offer.retailer} <ExternalLink className="size-3" />
            </a>
          ) : (
            <Badge variant="secondary">cote du marché</Badge>
          )}
        </p>
      </div>
    </li>
  );
}
