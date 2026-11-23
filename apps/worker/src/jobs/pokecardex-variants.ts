import {
  mayHaveReverse,
  type MergedCard,
  POKECARDEX_BASE,
  parsePokecardexCardImage,
  parsePokecardexCardVersions,
  parsePokecardexSeriesCards,
  parsePokecardexSeriesIndex,
  pokecardexNumberKey,
  pokecardexSeriesFor,
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
  release: { nameFr: string; tcgdexId: string | null },
  cards: MergedCard[],
  index: () => Promise<PokecardexSeries[]>,
): Promise<MergedCard[] | null> {
  const releaseName = release.nameFr;
  try {
    const series = pokecardexSeriesFor(release, await index());
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
    for (const [i, c] of candidates.entries()) {
      if (i > 0 && i % 20 === 0) {
        ctx.logger.info(
          { release: releaseName, done: i, total: candidates.length },
          'Pokécardex : versions en cours',
        );
      }
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

/**
 * Images des cartes d'après les fiches Pokécardex (scans français), pour les cartes que ni TCGdex
 * ni pokemontcg.io n'illustrent (promos notamment). Renvoie identifiant de carte → URL.
 */
export async function pokecardexImages(
  ctx: Pick<WorkerContext, 'fetcher' | 'logger'>,
  release: { nameFr: string; tcgdexId: string | null },
  cards: { id: string; localId: string }[],
  index: () => Promise<PokecardexSeries[]>,
): Promise<Map<string, string>> {
  const images = new Map<string, string>();
  if (cards.length === 0) return images;
  try {
    const series = pokecardexSeriesFor(release, await index());
    if (!series) {
      ctx.logger.info({ release: release.nameFr }, 'Pokécardex : série introuvable (images)');
      return images;
    }
    const links = parsePokecardexSeriesCards(
      await ctx.fetcher.fetchHtml(`${POKECARDEX_BASE}/series/${series.code}`),
    );
    const byNumber = new Map(links.map((l) => [pokecardexNumberKey(l.number), l]));
    for (const [i, c] of cards.entries()) {
      // Lecture lente (pause de 2 à 6 s entre deux fiches) : avancement affiché au fil de l'eau.
      if (i > 0 && i % 20 === 0) {
        ctx.logger.info(
          { release: release.nameFr, done: i, total: cards.length, found: images.size },
          'Pokécardex : images en cours',
        );
      }
      const link = byNumber.get(pokecardexNumberKey(c.localId));
      if (!link) continue;
      try {
        const url = parsePokecardexCardImage(await ctx.fetcher.fetchHtml(link.url));
        if (url) images.set(c.id, url);
      } catch {
        // Fiche illisible : carte laissée sans image.
      }
    }
    ctx.logger.info(
      { release: release.nameFr, series: series.code, missing: cards.length, found: images.size },
      'Pokécardex : images des cartes',
    );
  } catch (err) {
    ctx.logger.warn({ err, release: release.nameFr }, 'Pokécardex : images illisibles');
  }
  return images;
}
