import { Trash2 } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { formatDate, formatPrice, todayUtc } from '@tcgwatch/shared';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { PriceSourceToggle } from '@/components/price-source-toggle';
import { SafeImg } from '@/components/safe-img';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth';
import { getCardCollection } from '@/lib/data/card-collection';
import { getCardInvestment } from '@/lib/data/card-investment';
import { fitCard, fitGrid, fitScroll } from '@/lib/fit';
import { PRICE_COOKIE, parsePriceSource } from '@/lib/price-source';
import { cn } from '@/lib/utils';
import { deleteCardLotAction } from '../actions';
import { LotDialog } from './lot-dialog';

export const metadata: Metadata = { title: 'Achats et plus-value' };

const VARIANT_LABELS: Record<string, string> = {
  normal: 'Normale',
  reverse: 'Reverse',
  holo: 'Holo',
  firstEdition: '1re édition',
};

function Gain({ value, paid }: { value: number; paid: number }) {
  const gain = value - paid;
  return (
    <span className={cn('text-xs tabular-nums', gain >= 0 ? 'text-success' : 'text-destructive')}>
      {gain >= 0 ? '+' : ''}
      {formatPrice(gain)}
      {paid > 0 && ` (${gain >= 0 ? '+' : ''}${Math.round((gain / paid) * 100)} %)`}
    </span>
  );
}

/**
 * Investissement en cartes : lots d'achat (achats groupés couvrant des extensions) et cartes
 * achetées à l'unité, face à leur valeur du jour.
 */
export default async function CardPurchasesPage() {
  const user = await requireUser();
  const [inv, collection, jar] = await Promise.all([
    getCardInvestment(user.id),
    getCardCollection(user.id),
    cookies(),
  ]);
  const priceSource = parsePriceSource(jar.get(PRICE_COOKIE)?.value);
  const v = (x: { cm: number; fr: number }) => (priceSource === 'ebay' ? x.fr : x.cm);
  const releases = collection.releases.map((r) => ({ code: r.code, name: r.name }));
  const names = new Map(releases.map((r) => [r.code, r.name]));
  const today = todayUtc().toISOString().slice(0, 10);
  const label = priceSource === 'ebay' ? 'eBay FR' : 'Cardmarket';

  return (
    <FitPage>
      <PageHeader
        title="Achats et plus-value"
        description="Ce que vos cartes vous ont coûté face à leur valeur du jour : lots (master set, display ouvert…) couvrant des extensions, et cartes achetées à l’unité. Le prix à l’unité se saisit sur la fiche de la carte."
        actions={<PriceSourceToggle current={priceSource} />}
      />
      <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-card px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground">Investi</p>
          <p className="font-display text-2xl font-bold tabular-nums">
            {formatPrice(inv.covered.paid)}
          </p>
          <p className="text-xs text-muted-foreground">
            {inv.lots.length} lot{inv.lots.length > 1 ? 's' : ''} · {inv.singles.length} carte
            {inv.singles.length > 1 ? 's' : ''} à l’unité
          </p>
        </div>
        <div className="rounded-2xl border bg-card px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground">Valeur actuelle · {label}</p>
          <p
            className={cn(
              'font-display text-2xl font-bold tabular-nums',
              priceSource === 'ebay' && 'text-info',
            )}
          >
            {formatPrice(v(inv.covered))}
          </p>
          <p className="text-xs text-muted-foreground">cartes dont le prix d’achat est connu</p>
        </div>
        <div className="rounded-2xl border bg-card px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground">Plus-value latente</p>
          <p
            className={cn(
              'font-display text-2xl font-bold tabular-nums',
              v(inv.covered) - inv.covered.paid >= 0 ? 'text-success' : 'text-destructive',
            )}
          >
            {v(inv.covered) - inv.covered.paid >= 0 ? '+' : ''}
            {formatPrice(v(inv.covered) - inv.covered.paid)}
          </p>
          <p className="text-xs text-muted-foreground">
            {inv.covered.paid > 0
              ? `${Math.round((v(inv.covered) / inv.covered.paid) * 100)} % du prix payé`
              : 'ajoutez un lot ou un prix à l’unité'}
          </p>
        </div>
        <div className="rounded-2xl border bg-card px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground">Sans prix d’achat</p>
          <p className="font-display text-2xl font-bold tabular-nums">
            {formatPrice(v(inv.unpriced))}
          </p>
          <p className="text-xs text-muted-foreground">
            {inv.unpriced.copies} exemplaire{inv.unpriced.copies > 1 ? 's' : ''} hors lot et sans
            prix à l’unité
          </p>
        </div>
      </div>

      <div className={cn(fitGrid, 'xl:grid-cols-2')}>
        <Card className={cn(fitCard, 'pb-0')}>
          <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle>Lots d’achat</CardTitle>
              <CardDescription>
                Achats groupés couvrant des extensions : la valeur compte les cartes de ces
                extensions sans prix à l’unité.
              </CardDescription>
            </div>
            <LotDialog releases={releases} today={today} />
          </CardHeader>
          <CardContent className={cn('px-0', fitScroll)}>
            {inv.lots.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted-foreground">
                Aucun lot. Exemple : « Master set 30 ans » à 450 € couvrant 30ᵉ Anniversaire et
                Collection Classique, ou « Demi-display Règne Delta » à 90 €.
              </p>
            ) : (
              <ul className="divide-y">
                {inv.lots.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-6 py-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate font-semibold">{l.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(l.purchasedAt)} ·{' '}
                        {l.releases.map((c) => names.get(c) ?? c).join(', ')} · {l.copies} carte
                        {l.copies > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatPrice(v(l))}{' '}
                        <span className="font-normal text-muted-foreground">
                          / {formatPrice(l.paid)}
                        </span>
                      </p>
                      <Gain value={v(l)} paid={l.paid} />
                    </div>
                    <LotDialog
                      releases={releases}
                      today={today}
                      lot={{
                        id: l.id,
                        name: l.name,
                        price: l.paid,
                        purchasedAt: l.purchasedAt.toISOString().slice(0, 10),
                        notes: l.notes,
                        releases: l.releases,
                      }}
                    />
                    <form action={deleteCardLotAction.bind(null, l.id)}>
                      <Button
                        type="submit"
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Supprimer le lot ${l.name}`}
                      >
                        <Trash2 />
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className={cn(fitCard, 'pb-0')}>
          <CardHeader className="shrink-0">
            <CardTitle>
              Cartes achetées à l’unité{' '}
              <span className="font-sans text-sm text-muted-foreground">
                · {inv.singles.length}
              </span>
            </CardTitle>
            <CardDescription>
              Prix payé par exemplaire, saisi sur la fiche de la carte (« Dans ma collection »).
            </CardDescription>
          </CardHeader>
          <CardContent className={cn('px-0', fitScroll)}>
            {inv.singles.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted-foreground">
                Aucune carte avec un prix d’achat : ouvrez la fiche d’une carte achetée à l’unité et
                indiquez son prix.
              </p>
            ) : (
              <ul className="divide-y">
                {inv.singles.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/cartes/${encodeURIComponent(s.cardId)}`}
                      className="flex items-center gap-3 px-6 py-2 transition-colors hover:bg-accent"
                    >
                      <SafeImg
                        src={s.image}
                        alt=""
                        className="h-14 w-10 shrink-0 rounded bg-muted object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {s.name}{' '}
                          <span className="font-normal text-muted-foreground">
                            · {s.localId} · {VARIANT_LABELS[s.variant] ?? s.variant}
                          </span>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.release} · {s.quantity} × {formatPrice(s.unitPrice)}
                          {s.purchasedAt ? ` le ${formatDate(s.purchasedAt)}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatPrice(v(s))}{' '}
                          <span className="font-normal text-muted-foreground">
                            / {formatPrice(s.paid)}
                          </span>
                        </p>
                        <Gain value={v(s)} paid={s.paid} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </FitPage>
  );
}
