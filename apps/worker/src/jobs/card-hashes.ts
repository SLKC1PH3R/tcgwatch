import { Prisma, prisma } from '@tcgwatch/db';
import { tcgdexAsset } from '@tcgwatch/market';
import { ART_CROP, phash, PHASH_SIZE } from '@tcgwatch/shared';
import sharp from 'sharp';
import type { WorkerContext } from '../context';

/** Cartes traitées par passage (les premières passes rattrapent tout le catalogue). */
export const HASH_BATCH = 1500;
const PAUSE_MS = 150;

/** Adresse de l'image de référence d'une carte (petite image, suffisante pour l'empreinte). */
export function referenceImage(imageUrl: string, appUrl: string): string | null {
  if (imageUrl.startsWith('/')) return `${appUrl}${imageUrl}`;
  return tcgdexAsset(imageUrl, '/low.webp') ?? null;
}

/** Empreinte de l'illustration d'une image de carte (octets PNG / WebP / JPEG). */
export async function cardImageHash(bytes: Buffer): Promise<string> {
  const img = sharp(bytes).removeAlpha();
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new Error('image vide');
  const { data } = await img
    .extract({
      left: Math.round(ART_CROP.left * w),
      top: Math.round(ART_CROP.top * h),
      width: Math.round(ART_CROP.width * w),
      height: Math.round(ART_CROP.height * h),
    })
    .resize(PHASH_SIZE, PHASH_SIZE, { fit: 'fill', kernel: 'cubic' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return phash(data);
}

/**
 * Empreintes des cartes sans empreinte (ou dont l'image a changé), par lots : alimente le
 * scanner. Une image injoignable est simplement retentée au passage suivant.
 */
export async function runCardHashes(ctx: Pick<WorkerContext, 'logger' | 'env'>): Promise<number> {
  const cards = await prisma.$queryRaw<{ id: string; imageUrl: string }[]>`
    SELECT id, "imageUrl" FROM "Card"
    WHERE "imageUrl" IS NOT NULL AND ("imageHashUrl" IS NULL OR "imageHashUrl" <> "imageUrl")
    ORDER BY "updatedAt" DESC
    LIMIT ${Prisma.raw(String(HASH_BATCH))}`;
  let done = 0;
  for (const c of cards) {
    const url = referenceImage(c.imageUrl, ctx.env.APP_URL);
    if (!url) continue;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) continue;
      const hash = await cardImageHash(Buffer.from(await res.arrayBuffer()));
      await prisma.card.update({
        where: { id: c.id },
        data: { imageHash: hash, imageHashUrl: c.imageUrl },
      });
      done++;
    } catch (err) {
      ctx.logger.debug({ err, card: c.id }, 'Empreinte de carte impossible');
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  if (cards.length) ctx.logger.info({ hashed: done, batch: cards.length }, 'Empreintes des cartes');
  return done;
}
