import { ExternalLink, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  RETAILER_ACCESS_LABELS,
  RETAILER_KIND_LABELS,
  type RetailerAccess,
  type RetailerKind,
} from '@tcgwatch/adapters';
import { PageHeader } from '@/components/page-header';
import { SiteIcon } from '@/components/site-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EXCLUDED_SITES, getRetailers, type RetailerRow } from '@/lib/data/retailers';
import { toggleRetailerAction } from './actions';

export const metadata: Metadata = { title: 'Revendeurs' };

const KIND_ORDER: RetailerKind[] = ['SPECIALIST', 'CULTURE', 'TOYS', 'SUPERMARKET', 'OTHER'];

const ACCESS_VARIANT: Record<RetailerAccess, 'success' | 'info' | 'destructive' | 'secondary'> = {
  OK: 'success',
  BROWSER: 'info',
  LIMITED: 'destructive',
  UNTESTED: 'secondary',
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
  const reliable = retailers.filter((r) => r.access === 'OK').length;

  return (
    <>
      <PageHeader
        title="Revendeurs"
        description={`${retailers.length} sites français vendant du Pokémon TCG, dont ${reliable} relevés de façon fiable.`}
        actions={
          <Button asChild>
            <Link href="/produits/ajouter">
              <Plus /> Ajouter une URL
            </Link>
          </Button>
        }
      />

      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.kind} className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {RETAILER_KIND_LABELS[g.kind]}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((r) => (
                <RetailerCard key={r.domain} retailer={r} />
              ))}
            </div>
          </section>
        ))}

        <Card>
          <CardHeader className="flex-col">
            <CardTitle>Non pris en charge</CardTitle>
            <CardDescription>
              {EXCLUDED_SITES.join(', ')} : protections anti-bot agressives et CGU interdisant les
              relevés automatisés. TCGWatch n’y fait aucune requête et n’achète jamais rien à votre
              place.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  );
}

function RetailerCard({ retailer: r }: { retailer: RetailerRow }) {
  return (
    <Card className={r.enabled ? 'gap-3' : 'gap-3 opacity-60'}>
      <CardHeader className="items-start gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <SiteIcon websiteUrl={r.websiteUrl} name={r.name} />
          <div className="min-w-0">
            <CardTitle className="truncate">{r.name}</CardTitle>
            <p className="truncate text-xs text-muted-foreground">{r.domain}</p>
          </div>
        </div>
        <Badge variant={ACCESS_VARIANT[r.access]} title={ACCESS_HELP[r.access]}>
          {RETAILER_ACCESS_LABELS[r.access]}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {r.notes && <p className="text-sm text-muted-foreground">{r.notes}</p>}
        <p className="text-sm">
          {r.listings === 0 ? (
            <span className="text-muted-foreground">Aucune fiche suivie</span>
          ) : (
            <>
              <span className="font-medium tabular-nums">{r.listings}</span>{' '}
              {r.listings > 1 ? 'fiches suivies' : 'fiche suivie'} ·{' '}
              <span className="font-medium tabular-nums">{r.buyable}</span>{' '}
              {r.buyable > 1 ? 'achetables' : 'achetable'}
            </>
          )}
          {!r.enabled && <span className="text-muted-foreground"> · relevés désactivés</span>}
        </p>
        <div className="mt-auto flex flex-wrap gap-2">
          {r.pokemonUrl && (
            <Button asChild size="sm" variant="secondary">
              <a href={r.pokemonUrl} target="_blank" rel="noopener noreferrer">
                Rayon Pokémon <ExternalLink />
              </a>
            </Button>
          )}
          <Button asChild size="sm" variant="ghost">
            <a href={r.websiteUrl} target="_blank" rel="noopener noreferrer">
              Site <ExternalLink />
            </a>
          </Button>
          {r.id && (
            <form action={toggleRetailerAction.bind(null, r.id)} className="ml-auto">
              <Button type="submit" size="sm" variant="ghost">
                {r.enabled ? 'Désactiver' : 'Activer'}
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
