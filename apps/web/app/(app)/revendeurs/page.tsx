import type { Metadata } from 'next';
import Link from 'next/link';
import type { RetailerAccess, RetailerKind } from '@tcgwatch/adapters';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { EXCLUDED_SITES, getRetailers, type RetailerRow } from '@/lib/data/retailers';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Revendeurs' };

const KIND_ORDER: RetailerKind[] = ['SPECIALIST', 'CULTURE', 'TOYS', 'SUPERMARKET', 'OTHER'];
const ACCESS_ORDER: RetailerAccess[] = ['OK', 'BROWSER', 'LIMITED', 'UNTESTED'];
const KIND_TITLE: Record<RetailerKind, string> = {
  SPECIALIST: 'Boutiques spécialisées',
  CULTURE: 'Enseignes culturelles',
  TOYS: 'Jouets',
  SUPERMARKET: 'Grandes surfaces',
  OTHER: 'Autres sites',
};
const ACCESS_LABEL: Record<RetailerAccess, string> = {
  OK: 'Fiable',
  BROWSER: 'Via Chromium',
  LIMITED: 'Bloqué',
  UNTESTED: 'Non testé',
};

/** Statut de relevé : pastille et badge (Fiable, Via Chromium, Bloqué, Non testé). */
const ACCESS_STYLE: Record<RetailerAccess, { dot: string; badge: string }> = {
  OK: { dot: 'bg-success', badge: 'bg-success/15 text-success' },
  BROWSER: { dot: 'bg-info', badge: 'bg-info/15 text-info' },
  LIMITED: { dot: 'bg-chart-5', badge: 'bg-chart-5/15 text-chart-5' },
  UNTESTED: { dot: 'bg-muted-foreground', badge: 'bg-secondary text-muted-foreground' },
};

const ACCESS_HELP: Record<RetailerAccess, string> = {
  OK: 'Relevé HTTP simple vérifié sur une vraie fiche produit.',
  BROWSER: 'Site rendu en JavaScript ou protégé : relevé via Chromium, sans garantie.',
  LIMITED: 'Le site bloque les requêtes automatisées : suivez-le via ses liens et alertes.',
  UNTESTED: 'Adaptateur générique (JSON-LD / PrestaShop), non vérifié sur ce site.',
};

export default async function RetailersPage() {
  const retailers = await getRetailers();
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: retailers.filter((r) => r.kind === kind),
  })).filter((g) => g.items.length > 0);
  const byAccess = Object.fromEntries(
    ACCESS_ORDER.map((a) => [a, retailers.filter((r) => r.access === a).length]),
  ) as Record<RetailerAccess, number>;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <PageHeader
          title="Revendeurs"
          description={`${retailers.length} sites français vendant du Pokémon TCG, dont ${byAccess.OK} relevés de façon fiable. ${EXCLUDED_SITES.join(', ').replace(/, ([^,]*)$/, ' et $1')} sont volontairement exclus.`}
        />
        <p className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {ACCESS_ORDER.map((a) => (
            <span key={a} className="flex items-center gap-1.5" title={ACCESS_HELP[a]}>
              <span aria-hidden className={cn('size-1.5 rounded-full', ACCESS_STYLE[a].dot)} />
              {ACCESS_LABEL[a]} · {byAccess[a]}
            </span>
          ))}
        </p>
      </div>

      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.kind} className="space-y-3">
            <h2 className="font-display text-lg font-bold">
              {KIND_TITLE[g.kind]}{' '}
              <span className="text-sm font-normal text-muted-foreground">· {g.items.length}</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {g.items.map((r) => (
                <RetailerCard key={r.domain} retailer={r} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

/** « Play-In » → « P », « BCD Jeux » → « BJ », « Le Coin des Barons » → « LC ». */
function initials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 1) return words[0]![0]!.toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

function RetailerCard({ retailer: r }: { retailer: RetailerRow }) {
  const style = ACCESS_STYLE[r.access];
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border bg-card p-4',
        !r.enabled && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold"
        >
          {initials(r.name)}
        </span>
        <div className="min-w-0 flex-1">
          <a
            href={r.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={r.notes ?? r.domain}
            className="line-clamp-2 font-semibold hover:underline"
          >
            {r.name}
          </a>
          <p className="text-xs text-muted-foreground">
            {r.listings === 0
              ? 'Aucune fiche suivie'
              : `${r.listings} fiche${r.listings > 1 ? 's' : ''} suivie${r.listings > 1 ? 's' : ''} · ${r.buyable} achetable${r.buyable > 1 ? 's' : ''}`}
            {!r.enabled && ' · relevés désactivés'}
          </p>
        </div>
        <span
          title={ACCESS_HELP[r.access]}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            style.badge,
          )}
        >
          <span aria-hidden className={cn('size-1.5 rounded-full', style.dot)} />
          {ACCESS_LABEL[r.access]}
        </span>
      </div>
      <div className="mt-auto flex items-center gap-x-3">
        {r.pokemonUrl && (
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <a href={r.pokemonUrl} target="_blank" rel="noopener noreferrer">
              Rayon Pokémon
            </a>
          </Button>
        )}
        {r.listings > 0 && (
          <Link
            href={`/produits?site=${encodeURIComponent(r.slug)}`}
            className="shrink-0 text-sm font-semibold whitespace-nowrap text-primary hover:underline"
          >
            Voir les fiches
          </Link>
        )}
      </div>
    </div>
  );
}
