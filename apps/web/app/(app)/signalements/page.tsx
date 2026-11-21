import { ExternalLink, PauseCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@tcgwatch/db';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ago } from '@/lib/alerts';
import { requireAdmin } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { closeReportAction, pauseListingFromReportAction } from './actions';

export const metadata: Metadata = { title: 'Signalements' };

const KIND_LABEL = {
  PRICE: 'Prix faux',
  STOCK: 'Stock faux',
  MATCH: 'Mauvais produit',
  OTHER: 'Autre',
} as const;

type Props = { searchParams: Promise<{ vue?: string }> };

/** File de modération des erreurs signalées par les utilisateurs (administrateurs). */
export default async function ReportsPage({ searchParams }: Props) {
  await requireAdmin();
  const { vue } = await searchParams;
  const closed = vue === 'traites';
  const [reports, open, done] = await Promise.all([
    prisma.errorReport.findMany({
      where: closed ? { status: { not: 'OPEN' } } : { status: 'OPEN' },
      orderBy: { createdAt: closed ? 'desc' : 'asc' },
      take: 200,
      include: { user: { select: { email: true } } },
    }),
    prisma.errorReport.count({ where: { status: 'OPEN' } }),
    prisma.errorReport.count({ where: { status: { not: 'OPEN' } } }),
  ]);
  const productIds = [...new Set(reports.flatMap((r) => (r.productId ? [r.productId] : [])))];
  const listingIds = [...new Set(reports.flatMap((r) => (r.listingId ? [r.listingId] : [])))];
  const [products, listings] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    }),
    prisma.listing.findMany({
      where: { id: { in: listingIds } },
      select: {
        id: true,
        url: true,
        state: true,
        lastTitle: true,
        lastPrice: true,
        retailer: { select: { name: true } },
      },
    }),
  ]);
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const listingById = new Map(listings.map((l) => [l.id, l]));

  return (
    <>
      <PageHeader
        title="Signalements"
        description="Erreurs remontées par les utilisateurs : prix, stocks, fiches rattachées au mauvais produit."
      />
      <nav className="mb-4 flex gap-2">
        {[
          { href: '/signalements', label: `À traiter · ${open}`, on: !closed },
          { href: '/signalements?vue=traites', label: `Traités · ${done}`, on: closed },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-semibold text-muted-foreground',
              t.on && 'bg-foreground text-background',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {reports.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Rien à traiter.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const listing = r.listingId ? listingById.get(r.listingId) : undefined;
            return (
              <Card key={r.id} className="gap-0 py-4">
                <CardContent className="space-y-2">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="warning">{KIND_LABEL[r.kind]}</Badge>
                    {ago(r.createdAt)} · {r.user.email}
                    {r.status !== 'OPEN' && (
                      <Badge variant={r.status === 'RESOLVED' ? 'success' : 'secondary'}>
                        {r.status === 'RESOLVED' ? 'Corrigé' : 'Rejeté'}
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm font-semibold">
                    {r.productId ? (
                      <Link href={`/produits/${r.productId}`} className="hover:underline">
                        {productName.get(r.productId) ?? 'Produit supprimé'}
                      </Link>
                    ) : r.cardId ? (
                      <Link href={`/cartes/${r.cardId}`} className="hover:underline">
                        Carte {r.cardId}
                      </Link>
                    ) : (
                      (r.path ?? 'Page inconnue')
                    )}
                  </p>
                  {listing && (
                    <p className="text-xs text-muted-foreground">
                      Fiche {listing.retailer.name}
                      {listing.lastTitle ? ` · « ${listing.lastTitle} »` : ''}
                      {listing.state === 'PAUSED' ? ' · en pause' : ''} ·{' '}
                      <a
                        href={listing.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary hover:underline"
                      >
                        ouvrir <ExternalLink className="size-3" />
                      </a>
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-line">{r.message}</p>
                  {r.adminNote && (
                    <p className="text-xs text-muted-foreground">Note : {r.adminNote}</p>
                  )}
                  {r.status === 'OPEN' && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <form
                        action={closeReportAction.bind(null, r.id, 'RESOLVED')}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input
                          name="note"
                          placeholder="Note (facultatif)"
                          className="h-8 w-56 max-w-full rounded-md border border-input bg-transparent px-2 text-sm"
                        />
                        <Button type="submit" size="sm">
                          Corrigé
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          formAction={closeReportAction.bind(null, r.id, 'REJECTED')}
                        >
                          Rejeter
                        </Button>
                      </form>
                      {listing && listing.state !== 'PAUSED' && (
                        <form action={pauseListingFromReportAction.bind(null, r.id)}>
                          <Button type="submit" size="sm" variant="outline">
                            <PauseCircle /> Mettre la fiche en pause
                          </Button>
                        </form>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
