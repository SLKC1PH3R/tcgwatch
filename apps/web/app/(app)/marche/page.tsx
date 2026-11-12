import { Trash2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@tcgwatch/db';
import { createMarketProviders } from '@tcgwatch/market';
import { formatDate, formatPercent, formatPrice, toNumber } from '@tcgwatch/shared';
import { getEnv } from '@tcgwatch/shared/env';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { deleteChaseCardAction } from './actions';
import { ChaseCardForm } from './chase-card-form';
import { MarketPriceForm } from './market-price-form';

export const metadata: Metadata = { title: 'Marché secondaire' };

export default async function MarketPage() {
  const [products, market, cards, releases] = await Promise.all([
    getProducts(),
    latestMarketPrices(),
    prisma.chaseCard.findMany({
      include: {
        release: { select: { nameFr: true, setCode: true } },
        prices: { orderBy: { date: 'desc' }, take: 2 },
      },
      orderBy: [{ release: { releaseDate: 'desc' } }, { name: 'asc' }],
    }),
    prisma.release.findMany({
      where: { tcgdexId: { not: null } },
      select: { id: true, nameFr: true, setCode: true },
      orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } },
    }),
  ]);
  const providers = createMarketProviders(getEnv());

  return (
    <>
      <PageHeader
        title="Marché secondaire"
        description="Prix constatés hors boutiques. Cardmarket n’est jamais scrapé : saisie manuelle ou API tierces."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="py-2">
            <CardHeader className="pt-3">
              <CardTitle>Produits scellés</CardTitle>
            </CardHeader>
            <CardContent className="px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Prix marché</TableHead>
                    <TableHead className="text-right">Meilleur prix boutique</TableHead>
                    <TableHead className="text-right">Écart</TableHead>
                    <TableHead>Relevé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => {
                    const m = market.get(p.id);
                    const best = bestOffer(p.listings);
                    const gap = m && best ? m.price / best.price - 1 : null;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link href={`/produits/${p.id}`} className="font-medium hover:underline">
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPrice(m?.price)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPrice(best?.price)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPercent(gap)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m ? `${formatDate(m.date)} · ${m.source}` : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="py-2">
            <CardHeader className="pt-3">
              <div className="space-y-1">
                <CardTitle>Cartes phares</CardTitle>
                <CardDescription>
                  Cotations Cardmarket agrégées par TCGdex, relevées chaque jour.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-2">
              {cards.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucune carte suivie.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Carte</TableHead>
                      <TableHead>Extension</TableHead>
                      <TableHead className="text-right">Prix</TableHead>
                      <TableHead className="text-right">Variation</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cards.map((c) => {
                      const [last, prev] = c.prices;
                      const lastP = toNumber(last?.price);
                      const prevP = toNumber(prev?.price);
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {c.imageUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  referrerPolicy="no-referrer"
                                  src={c.imageUrl}
                                  alt=""
                                  className="h-12 rounded"
                                  loading="lazy"
                                />
                              )}
                              <div>
                                <p className="font-medium">{c.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {c.tcgdexId} {c.rarity && `· ${c.rarity}`}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {c.release.setCode ?? c.release.nameFr}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPrice(lastP)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {lastP !== null && prevP ? formatPercent(lastP / prevP - 1) : '—'}
                          </TableCell>
                          <TableCell>
                            <form action={deleteChaseCardAction.bind(null, c.id)}>
                              <Button
                                size="icon"
                                variant="ghost"
                                type="submit"
                                aria-label="Retirer"
                                className="text-destructive"
                              >
                                <Trash2 />
                              </Button>
                            </form>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-col">
              <CardTitle>Saisir un prix Cardmarket</CardTitle>
              <CardDescription>
                Une saisie par jour et par produit (la dernière remplace la précédente).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MarketPriceForm
                products={products.map((p) => ({ id: p.id, name: p.name }))}
                today={new Date().toISOString().slice(0, 10)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Suivre une carte phare</CardTitle>
            </CardHeader>
            <CardContent>
              <ChaseCardForm
                releases={releases.map((r) => ({
                  id: r.id,
                  label: r.setCode ? `${r.nameFr} (${r.setCode})` : r.nameFr,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
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
                PokeTrace est prévu pour la V2 : renseignez <code>POKETRACE_API_KEY</code> pour
                l’activer une fois implémenté.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
