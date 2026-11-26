import Link from 'next/link';
import { formatDate, formatPrice, PRICE_CATEGORIES, type PriceCategory } from '@tcgwatch/shared';
import { ChangeBadge } from '@/components/change-badge';
import { FitPage } from '@/components/fit-page';
import { MiniLines } from '@/components/mini-lines';
import { PageHeader } from '@/components/page-header';
import { Thumb } from '@/components/thumb';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BEST_SERIES, getPriceHistory, MARKET_SERIES } from '@/lib/data/history';
import { getSealedPrices, groupBySerie, type SealedPrice } from '@/lib/data/prices';
import { fitCard, fitColumn, fitGrid, fitScroll, fitSplit, fitSplit3 } from '@/lib/fit';
import { cn } from '@/lib/utils';

const SORTS = [
  { key: 'recents', label: 'Plus récents' },
  { key: 'anciens', label: 'Plus anciens' },
  { key: 'chers', label: 'Plus chers' },
  { key: 'hausses', label: 'Plus fortes hausses' },
  { key: 'baisses', label: 'Plus fortes baisses' },
] as const;
type SortKey = (typeof SORTS)[number]['key'];

/** Prix affiché d'un produit : cote du marché, sinon meilleure offre, sinon prix public. */
const shown = (p: SealedPrice) => p.market ?? p.bestOffer ?? p.msrp;

const sorters: Record<SortKey, (a: SealedPrice, b: SealedPrice) => number> = {
  recents: (a, b) => (b.releaseDate?.getTime() ?? 0) - (a.releaseDate?.getTime() ?? 0),
  anciens: (a, b) =>
    (a.releaseDate?.getTime() ?? Infinity) - (b.releaseDate?.getTime() ?? Infinity),
  chers: (a, b) => (shown(b) ?? 0) - (shown(a) ?? 0),
  hausses: (a, b) => (b.change30 ?? -Infinity) - (a.change30 ?? -Infinity),
  baisses: (a, b) => (a.change30 ?? Infinity) - (b.change30 ?? Infinity),
};

/**
 * Prix du scellé d'une catégorie (ETB, displays…) ou de tout le catalogue : cote du marché du
 * jour (guide Cardmarket), variation sur 30 jours et meilleure offre chez les revendeurs suivis,
 * regroupés par série.
 */
export async function PriceBoard({
  category,
  serie,
  sort: sortParam,
  basePath,
  picked,
}: {
  category: PriceCategory | null;
  serie?: string;
  sort?: string;
  basePath: string;
  /** Produit affiché dans l'aperçu (pages d'une catégorie). */
  picked?: string;
}) {
  const priced = (await getSealedPrices()).filter((p) => p.category && shown(p) !== null);
  const all = category ? priced.filter((p) => p.category?.key === category.key) : priced;
  // Menu des catégories : nombre de produits et valeur cumulée de leur cote.
  const menu = [
    { key: null, label: 'Tous les types', rows: priced },
    ...PRICE_CATEGORIES.map((c) => ({
      key: c.key,
      label: c.label,
      rows: priced.filter((p) => p.category?.key === c.key),
    })),
  ].filter((m) => m.rows.length > 0 || m.key === category?.key);
  const sort: SortKey = SORTS.find((s) => s.key === sortParam)?.key ?? 'recents';
  const series = groupBySerie(all).map((g) => ({ id: g.id, name: g.name }));
  const rows = (serie ? all.filter((p) => (p.serie?.id ?? 'autres') === serie) : all).sort(
    sorters[sort],
  );
  const quoted = all.filter((p) => p.market !== null);
  const top = [...quoted].sort((a, b) => b.market! - a.market!)[0];
  const moved = quoted.filter((p) => p.change30 !== null);
  const riser = [...moved].sort((a, b) => b.change30! - a.change30!)[0];
  const faller = [...moved].sort((a, b) => a.change30! - b.change30!)[0];

  // Aperçu (catégorie seulement) : le produit choisi, sinon le premier de la liste.
  const preview = category ? (rows.find((p) => p.id === picked) ?? rows[0] ?? null) : null;
  const history = preview ? await getPriceHistory(preview.id, 183) : null;

  const href = (params: { serie?: string; tri?: string; p?: string }) => {
    const q = new URLSearchParams();
    const s = 'serie' in params ? params.serie : serie;
    const t = 'tri' in params ? params.tri : sort;
    if (s) q.set('serie', s);
    if (t && t !== 'recents') q.set('tri', t);
    if (params.p) q.set('p', params.p);
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  // Filtre (série) en jaune, tri en blanc : deux réglages différents, deux styles différents.
  const chip = (label: string, to: string, active: boolean, kind: 'filter' | 'sort' = 'filter') => (
    <Link
      key={to + label}
      href={to}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex h-8 items-center rounded-full border px-3.5 text-sm font-medium transition-colors hover:bg-accent',
        active &&
          (kind === 'filter'
            ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
            : 'border-ink bg-ink text-ink-foreground hover:bg-ink/90'),
      )}
    >
      {label}
    </Link>
  );
  const name = category ? category.title : 'Tous les produits scellés';

  const select = preview ? (id: string) => href({ p: id }) : undefined;
  return (
    <FitPage>
      <PageHeader
        title={
          category
            ? `Prix des ${category.label === 'ETB' ? 'ETB' : category.title.toLowerCase()}`
            : 'Prix du scellé'
        }
        description={`${name} : cote du marché du jour (guide des prix Cardmarket), évolution sur 30 jours et meilleure offre chez les revendeurs suivis.`}
      />

      <div className={cn(fitGrid, preview ? fitSplit3 : fitSplit)}>
        {/* Catégories */}
        <Card className={cn(fitCard, 'px-3')}>
          <h2 className="px-2 font-display text-base font-semibold">Catégories</h2>
          <nav aria-label="Catégories" className={cn('space-y-0.5', fitScroll)}>
            {menu.map((m) => {
              const on = (m.key ?? null) === (category?.key ?? null);
              const value = m.rows.reduce((s, p) => s + (p.market ?? 0), 0);
              return (
                <Link
                  key={m.key ?? 'tous'}
                  href={m.key ? `/produits/prix/${m.key}` : '/produits/prix'}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-accent',
                    on && 'bg-accent font-semibold',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{m.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {m.rows.length}
                    {value > 0 && ` · ${formatPrice(Math.round(value)).replace(',00', '')}`}
                  </span>
                </Link>
              );
            })}
          </nav>
          <p className="px-2 text-xs text-muted-foreground">
            <Link href="/produits/prix/cartes" className="text-primary hover:underline">
              Prix des cartes à l’unité →
            </Link>
          </p>
        </Card>

        <div className={fitColumn}>
          <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Produits cotés"
              value={String(quoted.length)}
              hint={`${all.length} avec un prix`}
            />
            <Stat
              label="Le plus cher"
              value={top ? formatPrice(top.market) : '—'}
              hint={top?.name}
              href={top ? `/produits/${top.id}` : undefined}
            />
            <Stat
              label="Plus forte hausse (30 j)"
              value={riser ? <ChangeBadge value={riser.change30} className="text-xl" /> : '—'}
              hint={riser?.name}
              href={riser ? `/produits/${riser.id}` : undefined}
            />
            <Stat
              label="Plus forte baisse (30 j)"
              value={faller ? <ChangeBadge value={faller.change30} className="text-xl" /> : '—'}
              hint={faller?.name}
              href={faller ? `/produits/${faller.id}` : undefined}
            />
          </div>

          <Card className={cn(fitCard, 'fit:flex-1')}>
            <CardContent className="flex flex-col gap-2">
              <nav aria-label="Séries" className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 w-16 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Série
                </span>
                {chip('Toutes', href({ serie: undefined }), !serie)}
                {series.map((s) => chip(s.name, href({ serie: s.id }), serie === s.id))}
              </nav>
              <nav aria-label="Tri" className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 w-16 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Trier
                </span>
                {SORTS.map((s) => chip(s.label, href({ tri: s.key }), s.key === sort, 'sort'))}
              </nav>
            </CardContent>
            <CardContent className={fitScroll}>
              {rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Aucun produit coté dans cette catégorie pour l’instant.
                </p>
              ) : sort === 'recents' || sort === 'anciens' ? (
                <div className="space-y-6">
                  {groupBySerie(rows).map((g) => {
                    const total = g.rows.reduce((s, p) => s + (p.market ?? 0), 0);
                    const years = g.rows
                      .map((p) => p.releaseDate?.getUTCFullYear())
                      .filter((y): y is number => !!y);
                    return (
                      <section key={g.id} className="space-y-3">
                        <h2 className="flex flex-wrap items-baseline gap-x-2 font-display text-sm font-semibold">
                          {g.name}
                          <span className="font-sans text-xs font-normal text-muted-foreground">
                            {years.length > 0 &&
                              `${Math.min(...years)}${Math.max(...years) !== Math.min(...years) ? ` à ${Math.max(...years)}` : ''} · `}
                            {g.rows.length} produit{g.rows.length > 1 ? 's' : ''}
                            {total > 0 && ` · valeur totale ${formatPrice(total)}`}
                          </span>
                        </h2>
                        <Grid
                          rows={g.rows}
                          showCategory={!category}
                          select={select}
                          selected={preview?.id}
                        />
                      </section>
                    );
                  })}
                </div>
              ) : (
                <Grid rows={rows} showCategory={!category} select={select} selected={preview?.id} />
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Cote : tendance du guide des prix Cardmarket (toutes langues confondues), sinon prix
                de revente CardNexus. Offres : prix livré quand le port de la boutique est connu.{' '}
                {PRICE_CATEGORIES.length} catégories, bundles et demi-displays séparés de leur type.
              </p>
            </CardContent>
          </Card>
        </div>

        {preview && history && (
          <Card className={cn(fitCard, 'holo-frame hidden px-5 xl:flex')}>
            <div className={cn('space-y-4', fitScroll)}>
              <div className="flex items-center gap-3">
                <Thumb src={preview.image} className="size-14 shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-display leading-tight font-semibold">{preview.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {[
                      preview.releaseDate ? `Sortie le ${formatDate(preview.releaseDate)}` : null,
                      preview.msrp !== null ? `prix public ${formatPrice(preview.msrp)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Mini
                  label="Cote du jour"
                  value={formatPrice(preview.market)}
                  tone="text-primary"
                />
                <Mini
                  label="Sur 30 jours"
                  value={<ChangeBadge value={preview.change30} className="text-base" />}
                />
                <Mini
                  label="Meilleure offre"
                  value={formatPrice(preview.bestOffer)}
                  note={preview.bestRetailer ?? undefined}
                />
                <Mini
                  label="Plus bas historique"
                  value={history.allTimeLow !== null ? formatPrice(history.allTimeLow) : '—'}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Cote et meilleure offre · 6 mois
                </p>
                <MiniLines
                  label="Cote du marché et meilleure offre sur 6 mois"
                  height={150}
                  series={[
                    {
                      values: history.data.map(
                        (d) => (d[MARKET_SERIES] as number | undefined) ?? null,
                      ),
                      color: 'var(--primary)',
                    },
                    {
                      values: history.data.map(
                        (d) => (d[BEST_SERIES] as number | undefined) ?? null,
                      ),
                      color: 'var(--chart-2)',
                      dashed: true,
                    },
                  ]}
                />
                <p className="flex gap-4 text-xs text-muted-foreground">
                  <span className="text-primary">— Cote</span>
                  <span className="text-chart-2">- - Meilleure offre</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {preview.bestUrl && (
                <a
                  href={preview.bestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ size: 'sm' })}
                >
                  Voir l’offre chez {preview.bestRetailer} ↗
                </a>
              )}
              <Link
                href={`/produits/${preview.id}`}
                className={buttonVariants({ size: 'sm', variant: 'outline' })}
              >
                Fiche produit
              </Link>
            </div>
          </Card>
        )}
      </div>
    </FitPage>
  );
}

function Mini({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-popover px-3 py-2.5">
      <p className="truncate text-xs font-semibold text-muted-foreground">{label}</p>
      <p className={cn('mt-1 truncate font-display text-lg font-semibold tabular-nums', tone)}>
        {value}
      </p>
      {note && <p className="truncate text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="line-clamp-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="min-w-0 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent/40"
    >
      {body}
    </Link>
  ) : (
    <div className="min-w-0 rounded-xl border bg-card px-4 py-3">{body}</div>
  );
}

function Grid({
  rows,
  showCategory,
  select,
  selected,
}: {
  rows: SealedPrice[];
  showCategory: boolean;
  /** Lien d'aperçu (grand écran) d'un produit, sur les pages d'une catégorie. */
  select?: (id: string) => string;
  selected?: string;
}) {
  return (
    <ul className={cn('grid gap-3 sm:grid-cols-2', select ? '2xl:grid-cols-3' : 'xl:grid-cols-3')}>
      {rows.map((p) => (
        <li
          key={p.id}
          className={cn(
            'relative flex gap-3 rounded-xl border p-3',
            select && p.id === selected && 'xl:border-chart-2 xl:bg-chart-2/10',
          )}
        >
          {select && (
            // Sur grand écran, toucher la tuile affiche l'aperçu à droite.
            <Link
              href={select(p.id)}
              scroll={false}
              aria-label={`Aperçu : ${p.name}`}
              className="absolute inset-0 z-0 hidden rounded-xl xl:block"
            />
          )}
          <Thumb src={p.image} className="size-16 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1">
            <Link
              href={`/produits/${p.id}`}
              className="relative z-10 line-clamp-2 text-sm font-semibold hover:underline"
            >
              {p.name}
            </Link>
            <p className="text-xs text-muted-foreground">
              {[
                showCategory ? p.category?.label : null,
                p.releaseDate ? `Sortie le ${formatDate(p.releaseDate)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-lg font-bold tabular-nums">
                {formatPrice(p.market ?? p.bestOffer ?? p.msrp)}
              </span>
              {p.market !== null ? (
                <ChangeBadge value={p.change30} suffix="sur 30 j" />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {p.bestOffer !== null ? 'meilleure offre' : 'prix public'}
                </span>
              )}
            </div>
            {p.bestOffer !== null && p.bestUrl && (
              <a
                href={p.bestUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative z-10 block text-xs text-primary hover:underline"
              >
                Offres dès {formatPrice(p.bestOffer)} chez {p.bestRetailer}
                {p.offers > 1 ? ` (+${p.offers - 1})` : ''}
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
