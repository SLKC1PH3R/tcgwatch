import { prisma } from '@tcgwatch/db';
import {
  LOCAL_CARD_IMAGES,
  matchPokemonTcgImages,
  matchPokemonTcgSet,
  PokemonTcgClient,
  TCGDEX_BASE_URL,
  TcgdexClient,
} from '@tcgwatch/market';
import type { WorkerContext } from '../context';
import { pokecardexImages, pokecardexIndex } from './pokecardex-variants';

const PROBE_CONCURRENCY = 6;

/** L'image TCGdex existe-t-elle vraiment ? (l'API en déclare parfois une absente du CDN). */
async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/low.webp`, {
      method: 'HEAD',
      headers: { 'user-agent': 'TCGWatch (self-hosted)' },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return true; // réseau capricieux : on garde l'image plutôt que de l'effacer à tort
  }
}

/**
 * Images manquantes des cartes d'extensions TCGdex, prises sur pokemontcg.io (images
 * anglaises), à défaut sur les fiches Pokécardex (scans français : promos…). `probe` : vérifie aussi que les images TCGdex déclarées existent (extensions
 * récentes, où TCGdex annonce des images pas encore publiées).
 */
export async function fillCardImages(
  ctx: Pick<WorkerContext, 'logger' | 'fetcher'>,
  releaseIds: string[],
  { probe = false, tcgdex = new TcgdexClient(TCGDEX_BASE_URL.replace(/\/fr$/, '/en')) } = {},
  pokemontcg = new PokemonTcgClient(),
): Promise<number> {
  let filled = 0;
  const index = pokecardexIndex(ctx);
  for (const releaseId of releaseIds) {
    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      select: {
        tcgdexId: true,
        nameFr: true,
        cards: { select: { id: true, localId: true, imageUrl: true } },
      },
    });
    if (!release?.tcgdexId) continue;
    const missing = new Set(release.cards.filter((c) => !c.imageUrl).map((c) => c.id));
    if (probe) {
      const tcgdexImages = release.cards.filter((c) =>
        c.imageUrl?.startsWith('https://assets.tcgdex.net/'),
      );
      for (let i = 0; i < tcgdexImages.length; i += PROBE_CONCURRENCY) {
        const batch = tcgdexImages.slice(i, i + PROBE_CONCURRENCY);
        const ok = await Promise.all(batch.map((c) => exists(c.imageUrl!)));
        batch.forEach((c, j) => !ok[j] && missing.add(c.id));
      }
    }
    if (missing.size === 0) continue;

    const images = new Map<string, string>();
    for (const id of missing) if (LOCAL_CARD_IMAGES[id]) images.set(id, LOCAL_CARD_IMAGES[id]);
    let theirSetId: string | undefined;
    try {
      const set = await tcgdex.getSet(release.tcgdexId);
      const theirSet = matchPokemonTcgSet(
        { id: set.id, name: set.name, total: set.cardCount?.total },
        await pokemontcg.listSets(),
      );
      theirSetId = theirSet?.id;
      if (theirSet) {
        const english = (set.cards ?? []).filter((c) => missing.has(c.id));
        for (const [id, url] of matchPokemonTcgImages(
          english,
          await pokemontcg.setCards(theirSet.id),
        )) {
          if (!images.has(id)) images.set(id, url);
        }
      }
    } catch (err) {
      ctx.logger.debug(
        { err, set: release.tcgdexId },
        'Images des cartes : pokemontcg.io illisible',
      );
    }
    // Encore sans image : fiches Pokécardex.
    const still = release.cards.filter((c) => missing.has(c.id) && !images.has(c.id));
    if (still.length && ctx.fetcher) {
      for (const [id, url] of await pokecardexImages(ctx, release, still, index)) {
        images.set(id, url);
      }
    }
    for (const id of missing) {
      await prisma.card.update({ where: { id }, data: { imageUrl: images.get(id) ?? null } });
    }
    filled += images.size;
    ctx.logger.debug(
      { set: release.tcgdexId, pokemontcg: theirSetId, missing: missing.size, filled: images.size },
      'Images des cartes complétées',
    );
  }
  return filled;
}
