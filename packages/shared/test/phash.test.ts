import { describe, expect, it } from 'vitest';
import { downscaleGray, hammingHex, phash } from '../src/phash';

/** Image RGBA synthétique : motif à partir d'une fonction de luminosité. */
function image(w: number, h: number, f: (x: number, y: number) => number) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(255, f(x / w, y / h)));
      px.set([v, v, v, 255], (y * w + x) * 4);
    }
  }
  return px;
}

const pattern = (x: number, y: number) =>
  128 + 100 * Math.sin(x * 9) * Math.cos(y * 7) + 40 * (x > 0.5 ? 1 : -1);
const other = (x: number, y: number) => 128 + 110 * Math.cos(x * 4 + y * 11);

describe('pHash', () => {
  it('donne la même empreinte quelle que soit la taille ou la luminosité', () => {
    const a = phash(downscaleGray(image(240, 330, pattern), 240, 330));
    const b = phash(
      downscaleGray(
        image(600, 825, (x, y) => pattern(x, y) * 0.8 + 20),
        600,
        825,
      ),
    );
    expect(a).toHaveLength(16);
    expect(hammingHex(a, b)).toBeLessThanOrEqual(6);
  });

  it('distingue deux images différentes', () => {
    const a = phash(downscaleGray(image(240, 330, pattern), 240, 330));
    const c = phash(downscaleGray(image(240, 330, other), 240, 330));
    expect(hammingHex(a, c)).toBeGreaterThan(16);
  });

  it('vérifie la taille et compte les bits', () => {
    expect(() => phash(new Float64Array(10))).toThrow();
    expect(hammingHex('ffffffffffffffff', '0000000000000000')).toBe(64);
    expect(hammingHex('0f', '0e')).toBe(1);
  });
});
