import { Bell, ChevronLeft, ChevronRight, ExternalLink, Minus, Plus, Trash2 } from 'lucide-react';
import { Fragment } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPercent, formatPrice } from '@tcgwatch/shared';
import { CardChart } from '@/components/card-chart';
import { FormError } from '@/components/form-message';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCardPage } from '@/lib/data/cards';
import type { LocalCard } from '@/lib/data/encyclopedia';
import { PERIODS, periodOf, periodStart } from '@/lib/data/history';
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
  const card = await getCardPage(tcgdexId);
  if (!card) notFound();
  const owned = card.local
    ? await prisma.ownedCard.findMany({
        where: { cardId: tcgdexId },
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
  const stats = [
    { label: 'Tendance', value: card.current?.trend ?? null },
    { label: 'Prix bas', value: card.current?.low ?? null },
    { label: 'Moyenne 7 j', value: card.current?.avg7 ?? null },
    { label: 'Moyenne 30 j', value: card.current?.avg30 ?? null },
  ];

  return (
    <>
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
          card.tracked ? (
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

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-3">
          {card.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              referrerPolicy="no-referrer"
              src={card.image}
              alt={card.name}
              className="aspect-[63/88] w-full rounded-xl border bg-muted object-cover"
            />
          ) : (
            <div className="aspect-[63/88] w-full rounded-xl border bg-muted" />
          )}
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
          {card.local && <CardFacts card={card.local} />}
          <a
            href={`https://www.tcgdex.dev/cards/${encodeURIComponent(card.tcgdexId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Fiche TCGdex <ExternalLink className="size-3" />
          </a>
        </div>

        <Card>
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
            <dl className="grid w-full grid-cols-2 gap-3 pt-2 text-sm sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="text-muted-foreground">{s.label}</dt>
                  <dd className="font-semibold tabular-nums">{formatPrice(s.value)}</dd>
                </div>
              ))}
            </dl>
          </CardHeader>
          <CardContent>
            <CardChart data={history} />
          </CardContent>
        </Card>
      </div>

      {card.tracked && (
        <Card className="mt-6">
          <CardHeader className="flex-col">
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-4" /> Alertes de prix
            </CardTitle>
            <CardDescription>
              Prévenir quand la tendance Cardmarket du relevé quotidien passe sous ou au-dessus d’un
              seuil (une alerte par jour au plus). Laisser vide pour ne pas être prévenu.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}
    </>
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
