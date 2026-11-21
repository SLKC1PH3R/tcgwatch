import { Bell, ChevronLeft, ChevronRight, ExternalLink, Minus, Plus, Trash2 } from 'lucide-react';
import { Fragment } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPercent, formatPrice } from '@tcgwatch/shared';
import { CardChart } from '@/components/card-chart';
import { FitPage } from '@/components/fit-page';
import { FormError } from '@/components/form-message';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCardPage } from '@/lib/data/cards';
import { searchCards, type LocalCard } from '@/lib/data/encyclopedia';
import { fitCard, fitColumn, fitGrid, fitScroll } from '@/lib/fit';
import { PERIODS, periodOf, periodStart } from '@/lib/data/history';
import { ReportButton } from '@/components/report-button';
import { requireUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { prisma } from '@tcgwatch/db';
import { adjustOwnedCardAction } from '../../collection/cartes/actions';
import { followCardAction, setCardAlertAction, unfollowCardAction } from '../actions';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string; periode?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Carte ${decodeURIComponent(id)}` };
}

export default async function CardPage({ params, searchParams }: Props) {
  const [{ id }, { erreur, periode }] = await Promise.all([params, searchParams]);
  const tcgdexId = decodeURIComponent(id);
  const user = await requireUser();
  const card = await getCardPage(tcgdexId);
  if (!card) notFound();
  const owned = card.local
    ? await prisma.ownedCard.findMany({
        where: { cardId: tcgdexId, userId: user.id },
        select: { variant: true, quantity: true },
      })
    : [];
  const ownedBy = Object.fromEntries(owned.map((o) => [o.variant, o.quantity]));
  const variants = [
    ...new Set([
      ...(card.local?.variants.length ? card.local.variants : ['normal']),
      ...owned.map((o) => o.variant),
    ]),
  ].filter((v) => VARIANT_LABELS[v]);
  const period = periodOf(periode);
  const since = periodStart(period.days);
  const history = card.history.filter((h) => h.day >= since);
  const fmt = (v: number | null | undefined) => (v != null ? String(v).replace('.', ',') : '');

  const first = history.find((h) => h.trend !== null)?.trend ?? null;
  const change = first && card.current?.trend ? card.current.trend / first - 1 : null;
  // Autres cartes du même Pokémon (premier mot du nom : « Noctali ex » → « Noctali »).
  const pokemon = card.name.split(/\s+/)[0] ?? card.name;
  const siblings = (await searchCards(pokemon)).cards
    .filter((c) => c.id !== card.tcgdexId)
    .slice(0, 12);
  const stats = [
    { label: 'Tendance', value: card.current?.trend ?? null },
    { label: 'Prix bas', value: card.current?.low ?? null },
    { label: 'Moyenne 7 j', value: card.current?.avg7 ?? null },
    { label: 'Moyenne 30 j', value: card.current?.avg30 ?? null },
  ];

  return (
    <FitPage>
      <PageHeader
        title={card.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {card.setName &&
              (card.setId ? (
                <Link
                  href={`/extensions/${encodeURIComponent(card.setId)}?onglet=cartes`}
                  className="font-medium text-primary hover:underline"
                >
                  {card.setName}
                </Link>
              ) : (
                <span>{card.setName}</span>
              ))}
            <span className="text-muted-foreground">
              ·{' '}
              {card.local
                ? `n° ${card.local.localId}${card.local.release.cardCountOfficial ? `/${card.local.release.cardCountOfficial}` : ''}`
                : card.tcgdexId}
            </span>
            {card.rarity && <Badge variant="outline">{card.rarity}</Badge>}
            {card.tracked && (
              <Badge variant="info">
                {card.tracked.manual ? 'Suivie' : 'Carte phare (sélection automatique)'}
              </Badge>
            )}
          </span>
        }
        actions={
          user.role !== 'ADMIN' ? undefined : card.tracked ? (
            <form action={unfollowCardAction.bind(null, card.tcgdexId)}>
              <Button type="submit" variant="outline">
                <Trash2 /> Ne plus suivre
              </Button>
            </form>
          ) : (
            <form action={followCardAction.bind(null, card.tcgdexId)}>
              <Button type="submit">
                <Plus /> Suivre cette carte
              </Button>
            </form>
          )
        }
      />
      <FormError message={erreur} />

      <div
        className={cn(
          fitGrid,
          'lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_20rem]',
        )}
      >
        {/* La carte en grand : sur une page plein écran, elle suit la hauteur disponible. */}
        <div className="holo-frame flex items-start justify-center overflow-hidden rounded-[1.375rem] border bg-card p-3 fit:min-h-0 fit:items-center">
          {card.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              referrerPolicy="no-referrer"
              src={card.image}
              alt={card.name}
              className="aspect-[63/88] w-full rounded-xl border bg-muted object-contain fit:h-full fit:max-h-full fit:w-auto fit:max-w-full"
            />
          ) : (
            <div className="aspect-[63/88] w-full max-w-72 rounded-xl border bg-muted" />
          )}
        </div>

        <div className={fitColumn}>
          <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s, i) => (
              <div key={s.label} className="min-w-0 rounded-xl border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p
                  className={cn(
                    'font-display text-xl font-bold tabular-nums',
                    i === 0 && 'text-primary',
                  )}
                >
                  {formatPrice(s.value)}
                </p>
              </div>
            ))}
          </div>
          <Card className={cn(fitCard, 'fit:flex-1')}>
            <CardHeader className="flex-col">
              <CardTitle>Cotes Cardmarket</CardTitle>
              <CardDescription>
                Agrégées par TCGdex
                {card.tracked
                  ? ', relevées chaque jour.'
                  : ' — suivez la carte pour garder son historique.'}
                {change !== null &&
                  ` ${period.days ? `Sur ${period.label}` : 'Depuis le premier relevé'} : ${formatPercent(change)}.`}
              </CardDescription>
              <nav aria-label="Période" className="flex flex-wrap gap-1">
                {PERIODS.map((p) => (
                  <Link
                    key={p.key}
                    href={`/cartes/${encodeURIComponent(card.tcgdexId)}?periode=${p.key}`}
                    scroll={false}
                    aria-current={p.key === period.key ? 'true' : undefined}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent',
                      p.key === period.key &&
                        'border-foreground bg-foreground text-background hover:bg-foreground',
                    )}
                  >
                    {p.label}
                  </Link>
                ))}
              </nav>
            </CardHeader>
            <CardContent className="fit:min-h-0 fit:flex-1">
              <CardChart data={history} />
            </CardContent>
          </Card>
          {siblings.length > 0 && (
            <Card className={cn(fitCard, 'shrink-0')}>
              <CardHeader className="items-center">
                <CardTitle>Autres cartes {pokemon}</CardTitle>
                <Link
                  href={`/cartes?q=${encodeURIComponent(pokemon)}`}
                  className="text-sm text-primary hover:underline"
                >
                  Toutes ›
                </Link>
              </CardHeader>
              <CardContent>
                <ul className="flex [scrollbar-width:thin] gap-2 overflow-x-auto pb-1">
                  {siblings.map((c) => (
                    <li key={c.id} className="w-20 shrink-0 fit:w-[4.5rem]">
                      <Link
                        href={`/cartes/${encodeURIComponent(c.id)}`}
                        title={`${c.name} · ${c.setName}`}
                        className="block"
                      >
                        {c.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            referrerPolicy="no-referrer"
                            src={c.image}
                            alt={c.name}
                            loading="lazy"
                            className="aspect-[63/88] w-full rounded-md border bg-muted object-cover transition-transform hover:scale-[1.04]"
                          />
                        ) : (
                          <span className="block aspect-[63/88] w-full rounded-md border bg-muted" />
                        )}
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {c.setName}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className={cn(fitCard, 'lg:col-span-2 xl:col-span-1')}>
          <CardHeader>
            <CardTitle>Détails</CardTitle>
          </CardHeader>
          <CardContent className={cn('space-y-4', fitScroll)}>
            {card.local && <CardFacts card={card.local} />}
            {card.local && (
              <div className="space-y-2 rounded-xl border bg-card p-3">
                <p className="text-sm font-semibold">Dans ma collection</p>
                <ul className="space-y-1.5">
                  {variants.map((v) => (
                    <li key={v} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">{VARIANT_LABELS[v]}</span>
                      <span className="flex items-center gap-1">
                        <form action={adjustOwnedCardAction.bind(null, tcgdexId, -1, v)}>
                          <Button
                            type="submit"
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            disabled={!ownedBy[v]}
                            aria-label={`Retirer une ${VARIANT_LABELS[v]}`}
                          >
                            <Minus />
                          </Button>
                        </form>
                        <span className="w-6 text-center font-bold tabular-nums">
                          {ownedBy[v] ?? 0}
                        </span>
                        <form action={adjustOwnedCardAction.bind(null, tcgdexId, 1, v)}>
                          <Button
                            type="submit"
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            aria-label={`Ajouter une ${VARIANT_LABELS[v]}`}
                          >
                            <Plus />
                          </Button>
                        </form>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {card.tracked && user.role === 'ADMIN' && (
              <div className="space-y-3 rounded-xl border bg-popover/40 p-3">
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Bell className="size-4" /> Alertes de prix
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Prévenir quand la tendance Cardmarket du relevé quotidien passe sous ou
                    au-dessus d’un seuil (une alerte par jour au plus). Laisser vide pour ne pas
                    être prévenu.
                  </p>
                </div>
                <div>
                  <form
                    action={setCardAlertAction.bind(null, card.tcgdexId)}
                    className="flex flex-wrap items-end gap-3"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="alertBelow">Sous (€)</Label>
                      <Input
                        id="alertBelow"
                        name="alertBelow"
                        inputMode="decimal"
                        placeholder="ex. 80"
                        defaultValue={fmt(card.tracked.alertBelow)}
                        className="w-32"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="alertAbove">Au-dessus de (€)</Label>
                      <Input
                        id="alertAbove"
                        name="alertAbove"
                        inputMode="decimal"
                        placeholder="ex. 150"
                        defaultValue={fmt(card.tracked.alertAbove)}
                        className="w-32"
                      />
                    </div>
                    <Button type="submit">Enregistrer</Button>
                  </form>
                </div>
              </div>
            )}
            <a
              href={`https://www.tcgdex.dev/cards/${encodeURIComponent(card.tcgdexId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Fiche TCGdex <ExternalLink className="size-3" />
            </a>
            <ReportButton
              cardId={card.tcgdexId}
              subject={`Carte ${card.tcgdexId}`}
              className="ml-4"
            />
          </CardContent>
        </Card>
      </div>
    </FitPage>
  );
}

const VARIANT_LABELS: Record<string, string> = {
  normal: 'Normale',
  reverse: 'Reverse',
  holo: 'Holo',
  firstEdition: '1re édition',
};

/** Fiche de l'encyclopédie : illustrateur, types, variantes, cartes voisines. */
function CardFacts({ card }: { card: LocalCard }) {
  const rows = [
    { label: 'Série', value: card.release.serieRef?.name ?? null },
    { label: 'Catégorie', value: card.category },
    { label: 'Types', value: card.types.join(', ') || null },
    { label: 'Illustrateur', value: card.illustrator },
    {
      label: 'Variantes',
      value: card.variants.map((v) => VARIANT_LABELS[v] ?? v).join(', ') || null,
    },
  ].filter((r) => r.value);
  return (
    <div className="space-y-3 text-sm">
      {card.nameMissing && (
        <p className="text-xs text-muted-foreground">
          Nom FR manquant dans TCGdex : nom anglais affiché.
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map((r) => (
          <Fragment key={r.label}>
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd>{r.value}</dd>
          </Fragment>
        ))}
      </dl>
      <nav aria-label="Cartes voisines" className="flex justify-between gap-2 text-xs">
        {card.prev ? (
          <Link
            href={`/cartes/${encodeURIComponent(card.prev.id)}`}
            className="flex min-w-0 items-center gap-1 hover:underline"
          >
            <ChevronLeft className="size-3 shrink-0" />
            <span className="truncate">
              {card.prev.localId} · {card.prev.name}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {card.next && (
          <Link
            href={`/cartes/${encodeURIComponent(card.next.id)}`}
            className="flex min-w-0 items-center gap-1 text-right hover:underline"
          >
            <span className="truncate">
              {card.next.localId} · {card.next.name}
            </span>
            <ChevronRight className="size-3 shrink-0" />
          </Link>
        )}
      </nav>
    </div>
  );
}
