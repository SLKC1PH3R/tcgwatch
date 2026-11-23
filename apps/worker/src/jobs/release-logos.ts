import { prisma } from '@tcgwatch/db';
import {
  matchPokemonTcgSet,
  PokemonTcgClient,
  TCGDEX_BASE_URL,
  TcgdexClient,
  type PokemonTcgSet,
} from '@tcgwatch/market';
import type { WorkerContext } from '../context';

/** Données ouvertes de pokemontcg.io, plus à jour que son API pour les extensions récentes. */
export const POKEMONTCG_SETS_URL =
  'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/sets/en.json';

/** Liste des extensions anglaises : fichier de données GitHub, à défaut l'API pokemontcg.io. */
export async function englishSets(
  fetchImpl: typeof fetch = fetch,
  pokemontcg = new PokemonTcgClient(),
): Promise<PokemonTcgSet[]> {
  try {
    const res = await fetchImpl(POKEMONTCG_SETS_URL, {
      headers: { 'user-agent': 'TCGWatch (self-hosted)' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: unknown = await res.json();
    if (!Array.isArray(data)) throw new Error('format inattendu');
    return data.filter(
      (s): s is PokemonTcgSet =>
        typeof s === 'object' &&
        s !== null &&
        typeof s.id === 'string' &&
        typeof s.name === 'string',
    );
  } catch {
    return pokemontcg.listSets();
  }
}

/**
 * Logos d'extensions absents de TCGdex (extensions toutes récentes, collections spéciales) :
 * logo anglais repris des données pokemontcg.io ; à défaut le site affiche le symbole.
 */
export async function fillReleaseLogos(
  ctx: Pick<WorkerContext, 'logger'>,
  loadSets: () => Promise<PokemonTcgSet[]> = () => englishSets(),
  tcgdex = new TcgdexClient(TCGDEX_BASE_URL.replace(/\/fr$/, '/en')),
): Promise<number> {
  const releases = await prisma.release.findMany({
    where: { tcgdexId: { not: null }, imageUrl: null },
    select: { id: true, tcgdexId: true },
  });
  if (releases.length === 0) return 0;
  let filled = 0;
  const unmatched: string[] = [];
  try {
    const sets = await loadSets();
    for (const r of releases) {
      // Rapprochement sur le nom anglais de l'extension (TCGdex en anglais).
      const set = await tcgdex.getSet(r.tcgdexId!).catch(() => null);
      const theirs = set
        ? matchPokemonTcgSet({ id: set.id, name: set.name, total: set.cardCount?.total }, sets)
        : null;
      const logo = theirs?.images?.logo;
      if (!logo) {
        unmatched.push(set ? `${r.tcgdexId} (${set.name})` : `${r.tcgdexId} (absent en anglais)`);
        continue;
      }
      await prisma.release.update({ where: { id: r.id }, data: { imageUrl: logo } });
      filled++;
    }
  } catch (err) {
    ctx.logger.warn({ err }, 'Logos des extensions : liste pokemontcg.io illisible');
  }
  ctx.logger.info(
    { filled, missing: releases.length, unmatched },
    'Logos des extensions complétés',
  );
  return filled;
}
