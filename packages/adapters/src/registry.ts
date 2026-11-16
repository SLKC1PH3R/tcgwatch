import { culturaAdapter } from './adapters/cultura';
import { fantasySphereAdapter } from './adapters/fantasysphere';
import { leTempleDuJeuAdapter } from './adapters/letempledujeu';
import { genericAdapter } from './adapters/generic';
import { philibertAdapter } from './adapters/philibert';
import { playInAdapter } from './adapters/playin';
import { smythsAdapter } from './adapters/smyths';
import { AdapterError, type RetailerAdapter } from './types';

/** Adaptateurs spécifiques. Pour en ajouter un : créer le fichier dans ./adapters et l'inscrire ici. */
export const ADAPTERS: RetailerAdapter[] = [
  playInAdapter,
  philibertAdapter,
  culturaAdapter,
  smythsAdapter,
  fantasySphereAdapter,
  leTempleDuJeuAdapter,
];

/** Sites exclus en V1 (protections anti-bot agressives / CGU). */
export const BLOCKED_DOMAINS = ['amazon.fr', 'amazon.com', 'fnac.com', 'cdiscount.com'] as const;

/** "https://www.play-in.com/fr/produit/…" → "play-in.com" */
export function normalizeDomain(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    throw new AdapterError(`URL invalide : ${url}`, 'UNSUPPORTED');
  }
  return host.replace(/^www\./, '');
}

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function isBlockedDomain(url: string): boolean {
  const host = normalizeDomain(url);
  return BLOCKED_DOMAINS.some((d) => matchesDomain(host, d));
}

export function getAdapterByKey(key: string): RetailerAdapter {
  if (key === genericAdapter.key) return genericAdapter;
  return ADAPTERS.find((a) => a.key === key) ?? genericAdapter;
}

/** Retourne l'adaptateur spécifique du domaine, sinon l'adaptateur générique JSON-LD. */
export function getAdapterForUrl(url: string): RetailerAdapter {
  const host = normalizeDomain(url);
  if (BLOCKED_DOMAINS.some((d) => matchesDomain(host, d))) {
    throw new AdapterError(
      `${host} n'est pas pris en charge en V1 (protection anti-bot / CGU).`,
      'UNSUPPORTED',
    );
  }
  return ADAPTERS.find((a) => a.domains.some((d) => matchesDomain(host, d))) ?? genericAdapter;
}

export interface DetectedRetailer {
  domain: string;
  adapter: RetailerAdapter;
  /** Nom suggéré pour la création du revendeur s'il n'existe pas encore. */
  suggestedName: string;
}

export function detectRetailer(url: string): DetectedRetailer {
  const adapter = getAdapterForUrl(url);
  const domain = normalizeDomain(url);
  const suggestedName =
    adapter.key === genericAdapter.key
      ? domain
          .split('.')
          .slice(0, -1)
          .join('.')
          .replace(/^\w/, (c) => c.toUpperCase())
      : adapter.name;
  return { domain, adapter, suggestedName };
}
