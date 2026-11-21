import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { hammingHex } from '@tcgwatch/shared';
import { cardImageHash, referenceImage } from '../src/jobs/card-hashes';

const card = readFileSync(
  fileURLToPath(new URL('../../web/public/cards/30e-anniversaire-g.webp', import.meta.url)),
);

describe('empreintes des cartes', () => {
  it('reconnaît la même carte malgré la taille, la compression et la luminosité', async () => {
    const ref = await cardImageHash(card);
    const photo = await sharp(card)
      .resize(300)
      .modulate({ brightness: 1.15 })
      .jpeg({ quality: 55 })
      .toBuffer();
    expect(hammingHex(ref, await cardImageHash(photo))).toBeLessThanOrEqual(8);
  });

  it('distingue des illustrations différentes', async () => {
    // Illustration retournée : mêmes couleurs, composition différente.
    const flipped = await sharp(card).flop().toBuffer();
    expect(hammingHex(await cardImageHash(card), await cardImageHash(flipped))).toBeGreaterThan(14);
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
