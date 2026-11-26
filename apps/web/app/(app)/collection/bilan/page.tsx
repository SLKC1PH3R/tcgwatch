import { FileDown, Printer } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  formatDate,
  formatPrice,
  MOVABLE_EXEMPTION_PRICE,
  PLATFORM_REPORT_AMOUNT,
  PLATFORM_REPORT_SALES,
} from '@tcgwatch/shared';
import { FitPage } from '@/components/fit-page';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth';
import { getSalesReport } from '@/lib/data/sales-report';
import { fitCard, fitColumn, fitGrid, fitScroll } from '@/lib/fit';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Bilan des reventes' };

const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];
const signed = (n: number) => `${n > 0 ? '+' : ''}${formatPrice(n)}`;
const tone = (n: number) => (n > 0 ? 'text-success' : n < 0 ? 'text-destructive' : '');

type Props = { searchParams: Promise<{ annee?: string }> };

export default async function SalesReportPage({ searchParams }: Props) {
  const { annee } = await searchParams;
  const user = await requireUser();
  const r = await getSalesReport(user.id, Number(annee) || undefined);
  const t = r.totals;
  const maxMonth = Math.max(1, ...r.months.map((m) => Math.abs(m.gain)));

  return (
    <FitPage>
      <PageHeader
        title={`Bilan des reventes ${r.year}`}
        description="Ce que vos reventes de scellé et de cartes ont rapporté sur l’année : prix de vente, frais, prix d’achat et plus-value réalisée."
        actions={
          <>
            <Button asChild variant="outline">
              <a href={`/api/collection/bilan?annee=${r.year}&format=csv`}>
                <FileDown /> CSV
              </a>
            </Button>
            <Button asChild>
              <a href={`/api/collection/bilan?annee=${r.year}`} target="_blank" rel="noopener">
                <Printer /> Version PDF
              </a>
            </Button>
          </>
        }
      />

      <nav aria-label="Année" className="flex shrink-0 flex-wrap gap-2">
        {r.years.map((y) => (
          <Link
            key={y}
            href={`/collection/bilan?annee=${y}`}
            aria-current={y === r.year ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-semibold tabular-nums transition-colors hover:bg-accent',
              y === r.year && 'border-primary bg-primary text-primary-foreground hover:bg-primary',
            )}
          >
            {y}
          </Link>
        ))}
      </nav>

      <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          {
            label: 'Objets vendus',
            value: String(t.count),
            hint: `${t.sales} vente${t.sales > 1 ? 's' : ''}`,
          },
          { label: 'Prix de vente', value: formatPrice(t.gross) },
          { label: 'Frais de vente', value: formatPrice(t.fees), hint: 'commissions et port' },
          { label: 'Encaissé', value: formatPrice(t.proceeds) },
          { label: 'Prix d’achat', value: formatPrice(t.cost), hint: 'port compris' },
          {
            label: 'Plus-value réalisée',
            value: t.sales ? signed(t.gain) : '—',
            hint: t.sales
              ? `${signed(t.gains)} de gains · ${signed(t.losses)} de pertes`
              : undefined,
            className: tone(t.gain),
          },
        ].map((k) => (
          <Card key={k.label} className="gap-1 py-4">
            <CardContent>
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={cn('font-display text-xl font-bold tabular-nums', k.className)}>
                {k.value}
              </p>
              {k.hint && <p className="text-xs text-muted-foreground">{k.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className={cn(fitGrid, 'xl:grid-cols-[minmax(0,1fr)_24rem]')}>
        <Card className={cn(fitCard, 'overflow-hidden py-0')}>
          {r.lines.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucune revente enregistrée en {r.year}. Utilisez le bouton « Vendre » d’une ligne de{' '}
              <Link href="/collection" className="underline">
                Mon scellé
              </Link>{' '}
              ou « Enregistrer une vente » sur la fiche d’une carte.
            </p>
          ) : (
            <div className={cn('relative overflow-x-auto', fitScroll)}>
              <table className="w-full min-w-[820px] text-sm">
                <thead className="text-xs tracking-wide text-muted-foreground uppercase fit:sticky fit:top-0 fit:z-10 fit:bg-card">
                  <tr className="border-b">
                    <th className="px-5 py-3 text-left font-semibold">Vente</th>
                    <th className="px-3 py-3 text-left font-semibold">Objet</th>
                    <th className="px-3 py-3 text-right font-semibold">Coût</th>
                    <th className="px-3 py-3 text-right font-semibold">Vendu</th>
                    <th className="px-3 py-3 text-right font-semibold">Frais</th>
                    <th className="px-3 py-3 text-right font-semibold">Encaissé</th>
                    <th className="px-5 py-3 text-right font-semibold">Plus-value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {r.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums">
                        {formatDate(l.soldAt)}
                        <span className="block text-xs text-muted-foreground">
                          {l.saleChannel ?? 'canal non précisé'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Link href={l.href} className="font-semibold hover:underline">
                          {l.quantity > 1 && `${l.quantity} × `}
                          {l.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{l.detail}</span>
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                        {formatPrice(l.cost)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatPrice(l.salePrice * l.quantity)}
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                        {formatPrice(l.saleFees)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatPrice(l.proceeds)}
                      </td>
                      <td
                        className={cn('px-5 py-3 text-right font-bold tabular-nums', tone(l.gain))}
                      >
                        {signed(l.gain)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className={fitColumn}>
          <Card className="shrink-0 gap-3 py-5">
            <CardHeader>
              <CardTitle>Plus-value par mois</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="flex h-28 items-center gap-1"
                role="img"
                aria-label={r.months
                  .map((m, i) => `${MONTHS[i]} ${m.sales ? signed(m.gain) : 'aucune vente'}`)
                  .join(', ')}
              >
                {r.months.map((m, i) => (
                  <div
                    key={i}
                    className="flex h-full flex-1 flex-col items-center gap-1"
                    title={`${MONTHS[i]} : ${m.sales ? `${m.count} vendu(s), ${signed(m.gain)}` : 'aucune vente'}`}
                  >
                    <div className="flex w-full flex-1 flex-col justify-end">
                      {m.gain > 0 && (
                        <span
                          className="w-full rounded-t-sm bg-success"
                          style={{ height: `${(m.gain / maxMonth) * 100}%` }}
                        />
                      )}
                    </div>
                    <div className="h-px w-full bg-border" />
                    <div className="flex w-full flex-1 flex-col justify-start">
                      {m.gain < 0 && (
                        <span
                          className="w-full rounded-b-sm bg-destructive"
                          style={{ height: `${(-m.gain / maxMonth) * 100}%` }}
                        />
                      )}
                    </div>
                    <span className="text-[9px] leading-none text-muted-foreground">
                      {MONTHS[i]!.slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className={cn(fitCard, 'fit:flex-1')}>
            <CardHeader>
              <CardTitle>Par canal et repères</CardTitle>
              <CardDescription>Indicatif, ce n’est pas un conseil fiscal.</CardDescription>
            </CardHeader>
            <CardContent className={cn(fitScroll, 'space-y-4 text-sm')}>
              {r.channels.length > 0 && (
                <ul className="divide-y">
                  {r.channels.map((c) => (
                    <li
                      key={c.channel}
                      className="flex items-baseline justify-between gap-2 py-1.5"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-semibold">{c.channel}</span>{' '}
                        <span className="text-xs text-muted-foreground">
                          {c.sales} vente{c.sales > 1 ? 's' : ''} · {formatPrice(c.gross)}
                        </span>
                      </span>
                      <span className={cn('shrink-0 font-semibold tabular-nums', tone(c.gain))}>
                        {signed(c.gain)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="space-y-1">
                <p className="font-semibold">Ventes en ligne</p>
                <p className="text-muted-foreground">
                  {r.platform.sales} vente{r.platform.sales > 1 ? 's' : ''} pour{' '}
                  {formatPrice(r.platform.gross)}. Les plateformes transmettent au fisc les vendeurs
                  qui dépassent {PLATFORM_REPORT_SALES} ventes ou{' '}
                  {formatPrice(PLATFORM_REPORT_AMOUNT)} dans l’année (chaque plateforme compte à
                  part).
                </p>
                {r.platform.reportable && (
                  <p className="font-semibold text-warning">Seuil atteint, tous canaux cumulés.</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="font-semibold">
                  Ventes au-dessus de {formatPrice(MOVABLE_EXEMPTION_PRICE)}
                </p>
                <p className="text-muted-foreground">
                  {r.aboveExemption.length === 0
                    ? 'Aucune. '
                    : `${r.aboveExemption.map((l) => l.name).join(', ')}. `}
                  Sous ce prix de cession par objet, la plus-value sur un bien meuble est en
                  principe exonérée.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </FitPage>
  );
}
