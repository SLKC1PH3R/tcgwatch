import 'server-only';
import {
  BLOCKED_DOMAINS,
  RETAILER_DIRECTORY,
  type RetailerAccess,
  type RetailerKind,
} from '@tcgwatch/adapters';
import { prisma } from '@tcgwatch/db';
import { isBuyable } from '@tcgwatch/shared';

export interface RetailerRow {
  /** null : site de l'annuaire pas encore synchronisé en base (worker non démarré). */
  id: string | null;
  name: string;
  domain: string;
  kind: RetailerKind;
  access: RetailerAccess;
  websiteUrl: string;
  pokemonUrl: string | null;
  notes: string | null;
  enabled: boolean;
  listings: number;
  buyable: number;
}

/** Revendeurs en base, complétés par l'annuaire (métadonnées de repli, sites absents). */
export async function getRetailers(): Promise<RetailerRow[]> {
  const rows = await prisma.retailer.findMany({
    include: { listings: { select: { lastAvailability: true, state: true } } },
  });
  const byDomain = new Map(RETAILER_DIRECTORY.map((d) => [d.domain, d]));
  const seen = new Set<string>();

  const out: RetailerRow[] = rows.map((r) => {
    const info = byDomain.get(r.domain);
    seen.add(r.domain);
    return {
      id: r.id,
      name: r.name,
      domain: r.domain,
      kind: r.kind !== 'OTHER' ? r.kind : (info?.kind ?? 'OTHER'),
      access: r.access !== 'UNTESTED' ? r.access : (info?.access ?? 'UNTESTED'),
      websiteUrl: r.websiteUrl ?? info?.websiteUrl ?? `https://${r.domain}/`,
      pokemonUrl: r.pokemonUrl ?? info?.pokemonUrl ?? null,
      notes: r.notes ?? info?.notes ?? null,
      enabled: r.enabled,
      listings: r.listings.length,
      buyable: r.listings.filter((l) => l.state === 'ACTIVE' && isBuyable(l.lastAvailability))
        .length,
    };
  });
  for (const info of RETAILER_DIRECTORY) {
    if (seen.has(info.domain)) continue;
    out.push({
      id: null,
      name: info.name,
      domain: info.domain,
      kind: info.kind,
      access: info.access,
      websiteUrl: info.websiteUrl,
      pokemonUrl: info.pokemonUrl,
      notes: info.notes ?? null,
      enabled: true,
      listings: 0,
      buyable: 0,
    });
  }
  return out.sort((a, b) => b.listings - a.listings || a.name.localeCompare(b.name, 'fr'));
}

/** Sites exclus (Amazon, Fnac, Cdiscount), un nom par enseigne. */
export const EXCLUDED_SITES = [
  ...new Set(BLOCKED_DOMAINS.map((d) => d.split('.')[0]!.replace(/^\w/, (c) => c.toUpperCase()))),
];
