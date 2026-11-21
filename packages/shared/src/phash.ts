/**
 * Empreinte perceptuelle (pHash 64 bits) d'une image en niveaux de gris : sert à reconnaître une
 * carte photographiée parmi les images connues. Même calcul côté worker (images de référence)
 * et côté navigateur (photo de l'appareil).
 */

export const PHASH_SIZE = 32;
const LOW = 8;

/**
 * Zone de l'illustration dans une carte (fractions de largeur / hauteur) : stable d'une carte à
 * l'autre et peu sensible aux reflets du cadre et du texte.
 */
export const ART_CROP = { left: 0.08, top: 0.1, width: 0.84, height: 0.45 } as const;

let COS: Float64Array | null = null;
const cosTable = () => {
  if (COS) return COS;
  COS = new Float64Array(PHASH_SIZE * PHASH_SIZE);
  for (let u = 0; u < PHASH_SIZE; u++) {
    for (let x = 0; x < PHASH_SIZE; x++) {
      COS[u * PHASH_SIZE + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * PHASH_SIZE));
    }
  }
  return COS;
};

/** Luminance (0-255) d'un pixel RGB. */
export const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * pHash de pixels déjà ramenés à 32 × 32 en niveaux de gris (ligne par ligne). Renvoie 16
 * caractères hexadécimaux.
 */
export function phash(gray: ArrayLike<number>): string {
  if (gray.length !== PHASH_SIZE * PHASH_SIZE) {
    throw new Error(`pHash : ${PHASH_SIZE * PHASH_SIZE} pixels attendus`);
  }
  const c = cosTable();
  const N = PHASH_SIZE;
  // DCT 2D, seulement les 8 × 8 basses fréquences utiles.
  const rows = new Float64Array(LOW * N);
  for (let u = 0; u < LOW; u++) {
    for (let y = 0; y < N; y++) {
      let sum = 0;
      for (let x = 0; x < N; x++) sum += gray[y * N + x]! * c[u * N + x]!;
      rows[u * N + y] = sum;
    }
  }
  const coeffs: number[] = [];
  for (let v = 0; v < LOW; v++) {
    for (let u = 0; u < LOW; u++) {
      let sum = 0;
      for (let y = 0; y < N; y++) sum += rows[u * N + y]! * c[v * N + y]!;
      coeffs.push(sum);
    }
  }
  // Sans la composante continue (luminosité moyenne) : médiane des 63 autres.
  const ac = coeffs.slice(1);
  const median = [...ac].sort((a, b) => a - b)[Math.floor(ac.length / 2)]!;
  let bits = 0n;
  for (let i = 0; i < 64; i++) {
    const value = i === 0 ? coeffs[0]! : coeffs[i]!;
    bits = (bits << 1n) | (i > 0 && value > median ? 1n : 0n);
  }
  return bits.toString(16).padStart(16, '0');
}

/** Nombre de bits différents entre deux empreintes (0 = identiques, 64 = opposées). */
export function hammingHex(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) {
    x &= x - 1n;
    n++;
  }
  return n;
}

/**
 * Réduction 32 × 32 (moyenne par bloc) d'une zone d'une image RGBA : sert au navigateur, qui
 * dispose des pixels bruts d'un canvas.
 */
export function downscaleGray(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  crop = { left: 0, top: 0, width: 1, height: 1 },
): Float64Array {
  const N = PHASH_SIZE;
  const out = new Float64Array(N * N);
  const x0 = crop.left * width;
  const y0 = crop.top * height;
  const cw = crop.width * width;
  const ch = crop.height * height;
  for (let by = 0; by < N; by++) {
    for (let bx = 0; bx < N; bx++) {
      const xs = Math.floor(x0 + (bx * cw) / N);
      const xe = Math.max(xs + 1, Math.floor(x0 + ((bx + 1) * cw) / N));
      const ys = Math.floor(y0 + (by * ch) / N);
      const ye = Math.max(ys + 1, Math.floor(y0 + ((by + 1) * ch) / N));
      let sum = 0;
      let count = 0;
      for (let y = ys; y < ye && y < height; y++) {
        for (let x = xs; x < xe && x < width; x++) {
          const i = (y * width + x) * 4;
          sum += luma(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
          count++;
        }
      }
      out[by * N + bx] = count ? sum / count : 0;
    }
  }
  return out;
}
