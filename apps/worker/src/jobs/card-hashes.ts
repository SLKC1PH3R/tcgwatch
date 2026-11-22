import { Prisma, prisma } from '@tcgwatch/db';
import { tcgdexAsset } from '@tcgwatch/market';
import { scanSignature, type ScanSignature } from '@tcgwatch/shared';
import sharp from 'sharp';
import type { WorkerContext } from '../context';

/** Cartes par lot (requête et journal). */
export const HASH_BATCH = 1500;
const PAUSE_MS = 150;

/** Adresse de l'image de référence d'une carte (petite image, suffisante pour l'empreinte). */
export function referenceImage(imageUrl: string, appUrl: string): string | null {
  if (imageUrl.startsWith('/')) return `${appUrl}${imageUrl}`;
  return tcgdexAsset(imageUrl, '/low.webp') ?? null;
}

/**
 * Empreinte et couleurs de l'illustration d'une image de carte (octets PNG / WebP / JPEG) : même
 * calcul que le navigateur (pixels bruts puis réduction partagée), pour des distances comparables.
 */
export async function cardImageHash(bytes: Buffer): Promise<ScanSignature> {
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height) throw new Error('image vide');
  return scanSignature(data, info.width, info.height);
}

/** Durée maximale d'un passage : rend la main avant le passage horaire suivant. */
const RUN_BUDGET_MS = 50 * 60_000;
/** Images téléchargées en parallèle. */
const CONCURRENCY = 3;

/**
 * Empreintes des cartes sans empreinte (ou dont l'image a changé, ou sans signature couleur) : enchaîne les lots jusqu'à
 * avoir tout traité, dans la limite de 50 minutes par passage. Une image absente ou illisible
 * est marquée (pas retentée tant que l'image ne change pas) ; une erreur réseau est retentée
 * au passage suivant.
 */
export async function runCardHashes(
  ctx: Pick<WorkerContext, 'logger' | 'env'>,
  budgetMs = RUN_BUDGET_MS,
): Promise<number> {
  const started = Date.now();
  const retryLater: string[] = [];
  let done = 0;
  for (;;) {
    const cards = await prisma.$queryRaw<{ id: string; imageUrl: string }[]>`
      SELECT id, "imageUrl" FROM "Card"
      WHERE "imageUrl" IS NOT NULL
        AND ("imageHashUrl" IS NULL OR "imageHashUrl" <> "imageUrl"
             OR ("imageHash" IS NOT NULL AND "imageColor" IS NULL))
        AND NOT (id = ANY(${retryLater}::text[]))
      ORDER BY "updatedAt" DESC
      LIMIT ${Prisma.raw(String(HASH_BATCH))}`;
    if (cards.length === 0) break;

    let batchDone = 0;
    for (let i = 0; i < cards.length; i += CONCURRENCY) {
      await Promise.all(
        cards.slice(i, i + CONCURRENCY).map(async (c) => {
          const url = referenceImage(c.imageUrl, ctx.env.APP_URL);
          if (!url) {
            await markUnusable(c);
            return;
          }
          let res: Response;
          try {
            res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
          } catch {
            retryLater.push(c.id);
            return;
          }
          if (res.status >= 500 || res.status === 429) {
            retryLater.push(c.id);
            return;
          }
          if (!res.ok) {
            await markUnusable(c);
            return;
          }
          try {
            const sig = await cardImageHash(Buffer.from(await res.arrayBuffer()));
            await prisma.card.update({
              where: { id: c.id },
              data: { imageHash: sig.hash, imageColor: sig.color, imageHashUrl: c.imageUrl },
            });
            batchDone++;
          } catch (err) {
            ctx.logger.debug({ err, card: c.id }, 'Image de carte illisible');
            await markUnusable(c);
          }
        }),
      );
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
    done += batchDone;
    ctx.logger.info(
      { hashed: batchDone, batch: cards.length, total: done },
      'Empreintes des cartes',
    );
    if (Date.now() - started > budgetMs) break;
  }
  return done;
}

/** Image absente ou illisible : pas d'empreinte, pas de nouvel essai tant qu'elle ne change pas. */
async function markUnusable(c: { id: string; imageUrl: string }) {
  await prisma.card.update({
    where: { id: c.id },
    data: { imageHash: null, imageColor: null, imageHashUrl: c.imageUrl },
  });
}
