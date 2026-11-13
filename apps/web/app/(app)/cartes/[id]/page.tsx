import { Bell, ExternalLink, Plus, Trash2 } from 'lucide-react';
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
import { PERIODS, periodOf, periodStart } from '@/lib/data/history';
import { cn } from '@/lib/utils';
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
            {card.setName && <span>{card.setName}</span>}
            <span className="text-muted-foreground">· {card.tcgdexId}</span>
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
              src={card.image}
              alt={card.name}
              className="aspect-[63/88] w-full rounded-xl border bg-muted object-cover"
            />
          ) : (
            <div className="aspect-[63/88] w-full rounded-xl border bg-muted" />
          )}
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
