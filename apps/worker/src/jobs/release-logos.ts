import { prisma } from '@tcgwatch/db';
import {
  matchPokemonTcgSet,
  PokemonTcgClient,
  TCGDEX_BASE_URL,
  TcgdexClient,
} from '@tcgwatch/market';
import type { WorkerContext } from '../context';

/**
 * Logos d'extensions absents de TCGdex (extensions toutes récentes, collections spéciales) :
 * repris de pokemontcg.io (logo anglais), à défaut le symbole est affiché par le site.
 */
export async function fillReleaseLogos(
  ctx: Pick<WorkerContext, 'logger'>,
  pokemontcg = new PokemonTcgClient(),
  tcgdex = new TcgdexClient(TCGDEX_BASE_URL.replace(/\/fr$/, '/en')),
): Promise<number> {
  const releases = await prisma.release.findMany({
    where: { tcgdexId: { not: null }, imageUrl: null },
    select: { id: true, tcgdexId: true },
  });
  if (releases.length === 0) return 0;
  let filled = 0;
  try {
    const sets = await pokemontcg.listSets();
    for (const r of releases) {
      // pokemontcg.io est en anglais : rapprochement sur le nom anglais de l'extension.
      const set = await tcgdex.getSet(r.tcgdexId!).catch(() => null);
      if (!set) continue;
      const theirs = matchPokemonTcgSet(
        { id: set.id, name: set.name, total: set.cardCount?.total },
        sets,
      );
      const logo = theirs?.images?.logo;
      if (!logo) continue;
      await prisma.release.update({ where: { id: r.id }, data: { imageUrl: logo } });
      filled++;
    }
  } catch (err) {
    ctx.logger.warn({ err }, 'Logos des extensions : pokemontcg.io illisible');
  }
  ctx.logger.info({ filled, missing: releases.length }, 'Logos des extensions complétés');
  return filled;
}
