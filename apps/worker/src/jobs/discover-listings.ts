import {
  AdapterError,
  extractCatalogLinks,
  RETAILER_DIRECTORY,
  type CatalogLink,
  type RetailerInfo,
} from '@tcgwatch/adapters';
import { prisma } from '@tcgwatch/db';
import { matchProduct, searchQueryFor, type CatalogProduct } from '@tcgwatch/market';
import { todayUtc } from '@tcgwatch/shared';
import type { WorkerContext } from '../context';

/** Recherches Chromium par passage et par site (chacune prend plusieurs secondes). */
const MAX_SEARCHES_PER_RETAILER = 25;
/** Recherches réservées chaque jour aux nouveautés (sorties récentes ou à venir). */
const RECENT_SEARCHES = 10;
const RECENT_WINDOW_MS = 90 * 86_400_000;

type DatedProduct = CatalogProduct & { releaseDate: Date | null };

export interface DiscoverySummary {
  pages: number;
  links: number;
  matched: number;
  created: number;
}

interface Candidate {
  productId: string;
  url: string;
  title: string;
  exact: boolean;
}

/**
 * Découverte automatique des fiches revendeurs des produits du catalogue FR.
 *
 * 1. Parcourt les rayons Pokémon déclarés dans l'annuaire (pages autorisées par robots.txt),
 *    puis la recherche du site quand elle est autorisée (Play-In, rendue via Chromium).
 * 2. Rapproche chaque intitulé d'un produit du catalogue (même type, mêmes mots distinctifs ;
 *    versions étrangères et accessoires écartés, aucun rapprochement en cas d'ambiguïté).
 * 3. Crée le suivi correspondant (une fiche par produit et par site), relevé au prochain tick.
 *
 * Aucun achat, aucun panier : seules des pages publiques sont lues.
 */
export async function discoverListings(
  ctx: Pick<WorkerContext, 'fetcher' | 'logger' | 'env' | 'browser'>,
  /** Slug d'un seul revendeur (test d'un site ajouté) ; tous par défaut. */
  only?: string,
): Promise<DiscoverySummary> {
  // Tout le catalogue, y compris les produits des années passées (prix actuel en boutique).
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      releaseDate: true,
      ean: true,
      listings: { select: { retailerId: true } },
    },
  });
  // EAN du catalogue : rapprochement direct quand l'adresse d'une fiche en contient un.
  const byEan = new Map(products.filter((p) => p.ean).map((p) => [p.ean!, p.id]));
  const catalog: DatedProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    releaseDate: p.releaseDate,
  }));
  const retailers = await prisma.retailer.findMany({
    where: { enabled: true, ...(only ? { slug: only } : {}) },
  });
  const byDomain = new Map(RETAILER_DIRECTORY.map((r) => [r.domain, r]));

  const summary: DiscoverySummary = { pages: 0, links: 0, matched: 0, created: 0 };
  // Un site à la fois par domaine (PoliteFetcher), mais les sites en parallèle.
  await Promise.all(
    retailers.map(async (retailer) => {
      const info = byDomain.get(retailer.domain);
      if (!info?.discovery) return;
      try {
        const followed = new Set(
          products
            .filter((p) => p.listings.some((l) => l.retailerId === retailer.id))
            .map((p) => p.id),
        );
        const candidates = await collectCandidates(ctx, info, catalog, followed, summary, byEan);
        summary.created += await createListings(ctx, retailer.id, candidates, followed);
      } catch (err) {
        ctx.logger.warn({ err, retailer: retailer.slug }, 'Découverte interrompue pour ce site');
      }
    }),
  );
  ctx.logger.info(summary, 'Découverte des fiches revendeurs terminée');
  return summary;
}

async function collectCandidates(
  ctx: Pick<WorkerContext, 'fetcher' | 'logger' | 'browser'>,
  info: RetailerInfo,
  catalog: DatedProduct[],
  followed: Set<string>,
  summary: DiscoverySummary,
  byEan: Map<string, string> = new Map(),
): Promise<Map<string, Candidate>> {
  const discovery = info.discovery!;
  const seen = new Set<string>();
  const best = new Map<string, Candidate>();

  const consider = (links: CatalogLink[]) => {
    let fresh = 0;
    for (const link of links) {
      if (seen.has(link.url)) continue;
      seen.add(link.url);
      fresh++;
      summary.links++;
      const eanProduct = link.ean ? byEan.get(link.ean) : undefined;
      const match = eanProduct
        ? { productId: eanProduct, quality: 'exact' as const }
        : matchProduct(link.title, catalog);
      if (!match) continue;
      summary.matched++;
      const current = best.get(match.productId);
      const exact = match.quality === 'exact';
      if (!current || (exact && !current.exact)) {
        best.set(match.productId, {
          productId: match.productId,
          url: link.url,
          title: link.title,
          exact,
        });
      }
    }
    return fresh;
  };

  const fetchLinks = async (url: string, browser = false) => {
    const html = await ctx.fetcher.fetchHtml(url, {
      browser: browser || info.access === 'BROWSER',
      minDelayMs: info.minDelayMs,
    });
    summary.pages++;
    return extractCatalogLinks(html, url, discovery.productUrl);
  };

  // 1. Rayons (pagination jusqu'à une page sans nouveauté).
  for (const template of discovery.pages ?? []) {
    const maxPages = template.includes('{page}') ? (discovery.maxPages ?? 5) : 1;
    for (let page = 1; page <= maxPages; page++) {
      try {
        if (consider(await fetchLinks(template.replace('{page}', String(page)))) === 0) break;
      } catch (err) {
        if (err instanceof AdapterError && err.code === 'ROBOTS') break;
        ctx.logger.debug({ err, template, page }, 'Page de rayon illisible');
        break;
      }
    }
  }

  // 2. Recherche du site pour les produits encore introuvables (si autorisée et possible).
  if (discovery.search && (!discovery.searchNeedsBrowser || ctx.browser)) {
    const missing = catalog.filter((p) => !followed.has(p.id) && !best.has(p.id));
    const queryOf = (p: DatedProduct) => searchQueryFor(p.name);
    // Nouveautés d'abord (sorties des 90 derniers jours et à venir, les plus récentes en tête) :
    // un produit qui vient de sortir est cherché dès le lendemain, sans attendre la rotation.
    const now = Date.now();
    const recent = [
      ...new Set(
        missing
          .filter((p) => p.releaseDate && p.releaseDate.getTime() > now - RECENT_WINDOW_MS)
          .sort((a, b) => b.releaseDate!.getTime() - a.releaseDate!.getTime())
          .map(queryOf)
          .filter((q) => q.length >= 4),
      ),
    ].slice(0, RECENT_SEARCHES);
    const pending = [
      ...new Set(missing.map(queryOf).filter((q) => q.length >= 4 && !recent.includes(q))),
    ].sort();
    // Rotation quotidienne : chaque jour une autre tranche du catalogue est recherchée.
    const slots = MAX_SEARCHES_PER_RETAILER - recent.length;
    const day = Math.floor(todayUtc().getTime() / 86_400_000);
    const start = pending.length ? (day * slots) % pending.length : 0;
    const queries = [
      ...recent,
      ...[...pending.slice(start), ...pending.slice(0, start)].slice(0, slots),
    ];
    for (const q of queries) {
      try {
        const url = discovery.search.replace('{q}', encodeURIComponent(q));
        consider(await fetchLinks(url, discovery.searchNeedsBrowser));
      } catch (err) {
        if (err instanceof AdapterError && err.code === 'ROBOTS') break;
        ctx.logger.debug({ err, q }, 'Recherche illisible');
      }
    }
  }
  return best;
}

async function createListings(
  ctx: Pick<WorkerContext, 'env' | 'logger'>,
  retailerId: string,
  candidates: Map<string, Candidate>,
  followed: Set<string>,
): Promise<number> {
  let created = 0;
  for (const c of candidates.values()) {
    if (followed.has(c.productId)) continue;
    const exists = await prisma.listing.findUnique({ where: { url: c.url }, select: { id: true } });
    if (exists) continue;
    await prisma.listing.create({
      data: {
        productId: c.productId,
        retailerId,
        url: c.url,
        lastTitle: c.title,
        discovered: true,
        checkIntervalMin: ctx.env.DEFAULT_CHECK_INTERVAL_MIN,
        nextCheckAt: new Date(),
      },
    });
    created++;
  }
  return created;
}
