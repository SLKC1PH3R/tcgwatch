import {
  findPokecardexSeries,
  mayHaveReverse,
  type MergedCard,
  POKECARDEX_BASE,
  parsePokecardexCardVersions,
  parsePokecardexSeriesCards,
  parsePokecardexSeriesIndex,
  pokecardexNumberKey,
  type PokecardexSeries,
  withReverse,
} from '@tcgwatch/market';
import type { WorkerContext } from '../context';

/** Part minimale des fiches lues pour se fier à Pokécardex plutôt qu'à la règle par rareté. */
const MIN_COVERAGE = 0.8;

/**
 * Reverses d'une extension d'après les fiches Pokécardex (section « Versions »), quand TCGdex ne
 * les publie pas encore. Seules les cartes susceptibles d'en avoir une (communes, peu communes,
 * rares) sont lues. `null` si la série est introuvable ou trop de fiches illisibles : la règle
 * par rareté prend alors le relais.
 */
export async function pokecardexReverses(
  ctx: Pick<WorkerContext, 'fetcher' | 'logger'>,
  releaseName: string,
  cards: MergedCard[],
  index: () => Promise<PokecardexSeries[]>,
): Promise<MergedCard[] | null> {
  try {
    const series = findPokecardexSeries(releaseName, await index());
    if (!series) {
      ctx.logger.info({ release: releaseName }, 'Pokécardex : série introuvable');
      return null;
    }
    const links = parsePokecardexSeriesCards(
      await ctx.fetcher.fetchHtml(`${POKECARDEX_BASE}/series/${series.code}`),
    );
    const byNumber = new Map(links.map((l) => [pokecardexNumberKey(l.number), l]));
    const candidates = cards.filter(mayHaveReverse);
    const reverse = new Set<string>();
    let read = 0;
    for (const c of candidates) {
      const link = byNumber.get(pokecardexNumberKey(c.localId));
      if (!link) continue;
      try {
        const versions = parsePokecardexCardVersions(await ctx.fetcher.fetchHtml(link.url));
        if (!versions) continue;
        read++;
        if (versions.includes('reverse')) reverse.add(c.id);
      } catch {
        // Fiche illisible : comptée comme manquante.
      }
    }
    ctx.logger.info(
      {
        release: releaseName,
        series: series.code,
        read,
        candidates: candidates.length,
        reverse: reverse.size,
      },
      'Pokécardex : versions des cartes lues',
    );
    if (candidates.length === 0 || read / candidates.length < MIN_COVERAGE) return null;
    return cards.map((c) => (reverse.has(c.id) ? withReverse(c) : c));
  } catch (err) {
    ctx.logger.warn({ err, release: releaseName }, 'Pokécardex : versions illisibles');
    return null;
  }
}

/** Index des séries Pokécardex, lu une seule fois par passage. */
export function pokecardexIndex(ctx: Pick<WorkerContext, 'fetcher'>) {
  let index: Promise<PokecardexSeries[]> | undefined;
  return () =>
    (index ??= ctx.fetcher.fetchHtml(`${POKECARDEX_BASE}/series`).then(parsePokecardexSeriesIndex));
}
