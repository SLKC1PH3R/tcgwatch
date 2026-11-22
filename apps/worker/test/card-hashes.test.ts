import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  cardCrops,
  colorDistance,
  hammingHex,
  scanScore,
  scanSignature,
  type ScanSignature,
} from '@tcgwatch/shared';
import { cardImageHash, referenceImage } from '../src/jobs/card-hashes';

const read = (v: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../web/public/cards/30e-anniversaire-${v}.webp`, import.meta.url)),
  );
const card = read('g');

const score = (a: ScanSignature, b: ScanSignature) =>
  scanScore(hammingHex(a.hash, b.hash), colorDistance(a.color, b.color));

/** Comme le navigateur : meilleur score parmi les cadrages possibles de l'image. */
async function bestScore(photo: Buffer, ref: ScanSignature) {
  const { data, info } = await sharp(photo)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Math.min(
    ...cardCrops(info.width, info.height).map((c) =>
      score(scanSignature(data, info.width, info.height, c), ref),
    ),
  );
}

describe('empreintes des cartes', () => {
  it('reconnaît la même carte malgré la taille, la compression et la luminosité', async () => {
    const ref = await cardImageHash(card);
    const photo = await sharp(card)
      .resize(300)
      .modulate({ brightness: 1.15 })
      .jpeg({ quality: 55 })
      .toBuffer();
    const sig = await cardImageHash(photo);
    expect(hammingHex(ref.hash, sig.hash)).toBeLessThanOrEqual(8);
    expect(colorDistance(ref.color, sig.color)).toBeLessThan(4);
  });

  it('distingue des illustrations différentes', async () => {
    // Illustration retournée : mêmes couleurs, composition différente.
    const flipped = await sharp(card).flop().toBuffer();
    const a = await cardImageHash(card);
    expect(hammingHex(a.hash, (await cardImageHash(flipped)).hash)).toBeGreaterThan(14);
  });

  it('départage les variantes recolorées d’une même illustration', async () => {
    const [b, r, g] = await Promise.all(['b', 'r', 'g'].map((v) => cardImageHash(read(v))));
    // Formes presque identiques entre verte et rouge : seule la couleur les sépare.
    for (const [x, y] of [
      [b, r],
      [b, g],
      [r, g],
    ] as const) {
      expect(score(x!, y!)).toBeGreaterThan(15);
    }
  });

  it('retrouve la carte dans une photo importée entière ou cadrée au centre', async () => {
    const ref = await cardImageHash(card);
    const other = await cardImageHash(read('r'));
    // Image déjà recadrée sur la carte (capture d'écran, scan).
    const whole = await sharp(card).resize(500).png().toBuffer();
    expect(await bestScore(whole, ref)).toBeLessThan(4);
    // Photo paysage, carte au centre sur un fond, légère dominante chaude.
    const meta = await sharp(card).metadata();
    const h = Math.round(meta.height! / 0.78);
    const w = Math.round(h * 1.6);
    const scene = await sharp({
      create: { width: w, height: h, channels: 3, background: { r: 60, g: 55, b: 50 } },
    })
      .composite([{ input: card, gravity: 'center' }])
      .modulate({ brightness: 0.9 })
      .linear([1.06, 1, 0.94], [0, 0, 0])
      .jpeg({ quality: 70 })
      .toBuffer();
    const own = await bestScore(scene, ref);
    expect(own).toBeLessThan(10);
    expect(await bestScore(scene, other)).toBeGreaterThan(own + 8);
  });

  it('adresse de l’image de référence', () => {
    expect(referenceImage('/cards/x.webp', 'https://tcg.example')).toBe(
      'https://tcg.example/cards/x.webp',
    );
    expect(referenceImage('https://assets.tcgdex.net/fr/me/me05/1', 'x')).toBe(
      'https://assets.tcgdex.net/fr/me/me05/1/low.webp',
    );
  });
});
