import Link from 'next/link';
import { formatDate, formatPrice, PRICE_CATEGORIES, type PriceCategory } from '@tcgwatch/shared';
import { ChangeBadge } from '@/components/change-badge';
import { PageHeader } from '@/components/page-header';
import { Thumb } from '@/components/thumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSealedPrices, groupBySerie, type SealedPrice } from '@/lib/data/prices';
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
}: {
  category: PriceCategory | null;
  serie?: string;
  sort?: string;
  basePath: string;
}) {
  const all = (await getSealedPrices()).filter(
    (p) => (category ? p.category?.key === category.key : p.category) && shown(p) !== null,
  );
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

  const href = (params: { serie?: string; tri?: string }) => {
    const q = new URLSearchParams();
    const s = 'serie' in params ? params.serie : serie;
    const t = 'tri' in params ? params.tri : sort;
    if (s) q.set('serie', s);
    if (t && t !== 'recents') q.set('tri', t);
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const chip = (label: string, to: string, active: boolean) => (
    <Link
      key={to + label}
      href={to}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent',
        active && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
      )}
    >
      {label}
    </Link>
  );
  const name = category ? category.title : 'Tous les produits scellés';

  return (
    <>
      <PageHeader
        title={
          category
            ? `Prix des ${category.label === 'ETB' ? 'ETB' : category.title.toLowerCase()}`
            : 'Prix du scellé'
        }
        description={`${name} : cote du marché du jour (guide des prix Cardmarket), évolution sur 30 jours et meilleure offre chez les revendeurs suivis. Idéal pour savoir s’il vaut mieux garder, vendre ou acheter.`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <nav aria-label="Séries" className="flex flex-wrap gap-1.5">
          {chip('Toutes les séries', href({ serie: undefined }), !serie)}
          {series.map((s) => chip(s.name, href({ serie: s.id }), serie === s.id))}
        </nav>
        <nav aria-label="Tri" className="flex flex-wrap gap-1.5">
          {SORTS.map((s) => chip(s.label, href({ tri: s.key }), s.key === sort))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucun produit coté dans cette catégorie pour l’instant.
          </CardContent>
        </Card>
      ) : sort === 'recents' || sort === 'anciens' ? (
        <div className="space-y-6">
          {groupBySerie(rows).map((g) => {
            const total = g.rows.reduce((s, p) => s + (p.market ?? 0), 0);
            const years = g.rows
              .map((p) => p.releaseDate?.getUTCFullYear())
              .filter((y): y is number => !!y);
            return (
              <Card key={g.id}>
                <CardHeader>
                  <div className="space-y-1">
                    <CardTitle>
                      {category ? `Prix des ${category.label}` : 'Prix'} {g.name}
                    </CardTitle>
                    <CardDescription>
                      {years.length > 0 &&
                        `${Math.min(...years)}${Math.max(...years) !== Math.min(...years) ? ` à ${Math.max(...years)}` : ''} · `}
                      {g.rows.length} produit{g.rows.length > 1 ? 's' : ''}
                      {total > 0 && ` · valeur totale ${formatPrice(total)}`}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Grid rows={g.rows} showCategory={!category} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Grid rows={rows} showCategory={!category} />
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Cote : tendance du guide des prix Cardmarket (toutes langues confondues), sinon prix de
        revente CardNexus. Offres : prix livré quand le port de la boutique est connu.{' '}
        {PRICE_CATEGORIES.length} catégories, bundles et demi-displays séparés de leur type.
      </p>
    </>
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
      <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="line-clamp-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40"
    >
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border bg-card p-4">{body}</div>
  );
}

function Grid({ rows, showCategory }: { rows: SealedPrice[]; showCategory: boolean }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((p) => (
        <li key={p.id} className="flex gap-3 rounded-xl border p-3">
          <Thumb src={p.image} className="size-16 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1">
            <Link
              href={`/produits/${p.id}`}
              className="line-clamp-2 text-sm font-semibold hover:underline"
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
                className="block text-xs text-primary hover:underline"
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
