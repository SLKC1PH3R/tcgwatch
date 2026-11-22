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

/** Grille de la signature couleur (cases par côté). */
export const COLOR_GRID = 4;

/**
 * Signature couleur d'une zone : chromaticité moyenne (r / (r+g+b), g / (r+g+b)) de chaque case
 * d'une grille 4 × 4. Indépendante de la luminosité, elle sépare les variantes qui ne diffèrent
 * que par la teinte (même illustration recolorée). Renvoie 64 caractères hexadécimaux.
 */
export function colorSignature(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  crop = { left: 0, top: 0, width: 1, height: 1 },
): string {
  const G = COLOR_GRID;
  const x0 = crop.left * width;
  const y0 = crop.top * height;
  const cw = crop.width * width;
  const ch = crop.height * height;
  let out = '';
  for (let gy = 0; gy < G; gy++) {
    for (let gx = 0; gx < G; gx++) {
      const xs = Math.floor(x0 + (gx * cw) / G);
      const xe = Math.max(xs + 1, Math.floor(x0 + ((gx + 1) * cw) / G));
      const ys = Math.floor(y0 + (gy * ch) / G);
      const ye = Math.max(ys + 1, Math.floor(y0 + ((gy + 1) * ch) / G));
      // Échantillonnage d'un pixel sur deux : largement suffisant pour une moyenne.
      let r = 0;
      let g = 0;
      let b = 0;
      for (let y = ys; y < ye && y < height; y += 2) {
        for (let x = xs; x < xe && x < width; x += 2) {
          const i = (y * width + x) * 4;
          r += rgba[i]!;
          g += rgba[i + 1]!;
          b += rgba[i + 2]!;
        }
      }
      const sum = r + g + b || 1;
      const byte = (v: number) =>
        Math.max(0, Math.min(255, Math.round((v / sum) * 255)))
          .toString(16)
          .padStart(2, '0');
      out += byte(r) + byte(g);
    }
  }
  return out;
}

/**
 * Écart de couleur entre deux signatures : moyenne des écarts de chromaticité, ramenée à
 * l'échelle 0-64 d'une distance de Hamming (0 = mêmes teintes).
 */
export function colorDistance(a: string, b: string): number {
  const n = Math.min(a.length, b.length) / 2;
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.abs(
      parseInt(a.slice(i * 2, i * 2 + 2), 16) - parseInt(b.slice(i * 2, i * 2 + 2), 16),
    );
  }
  return (sum / n) * (64 / 85);
}

export interface Crop {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Zone `inner` (fractions de la zone `outer`) exprimée en fractions de l'image entière. */
export const composeCrop = (outer: Crop, inner: Crop): Crop => ({
  left: outer.left + inner.left * outer.width,
  top: outer.top + inner.top * outer.height,
  width: inner.width * outer.width,
  height: inner.height * outer.height,
});

/** Proportions d'une carte (63 × 88 mm). */
export const CARD_RATIO = 63 / 88;
/** Cadre de visée de la caméra : carte haute de 78 % de l'image, centrée. */
export const GUIDE_HEIGHT = 0.78;

/** Carte centrée de hauteur `h` (fraction de la hauteur de l'image), décalée de (dx, dy). */
function centeredCard(width: number, height: number, h: number, dx = 0, dy = 0): Crop | null {
  const ch = h * height;
  const cw = ch * CARD_RATIO;
  if (cw > width || ch > height) return null;
  const left = (width - cw) / 2 / width + dx;
  const top = (height - ch) / 2 / height + dy;
  if (left < 0 || top < 0 || left + cw / width > 1 || top + ch / height > 1) return null;
  return { left, top, width: cw / width, height: ch / height };
}

/**
 * Cadrages possibles de la carte dans une image : le cadre de visée (et de légères variations
 * de taille et de position, la carte n'étant jamais parfaitement placée) et, pour une photo
 * importée, l'image entière quand elle a déjà les proportions d'une carte (image recadrée,
 * capture d'écran). Le serveur garde, pour chaque carte connue, le cadrage le plus proche.
 */
export function cardCrops(width: number, height: number): Crop[] {
  const crops: Crop[] = [];
  const ratio = width / height;
  // Image déjà recadrée sur la carte (à ± 12 % près).
  if (Math.abs(ratio - CARD_RATIO) / CARD_RATIO < 0.12) {
    crops.push({ left: 0, top: 0, width: 1, height: 1 });
    const inset = 0.02;
    crops.push({ left: inset, top: inset, width: 1 - 2 * inset, height: 1 - 2 * inset });
  }
  // La plus grande carte centrée qui tient dans l'image (photo en hauteur, carte remplissant le cadre).
  const fit = Math.min(1, width / (height * CARD_RATIO));
  for (const h of [GUIDE_HEIGHT, 0.72, 0.84, 0.9, 0.96]) {
    const c = centeredCard(width, height, Math.min(h, fit));
    if (c) crops.push(c);
  }
  for (const [dx, dy] of [
    [0, -0.02],
    [0, 0.02],
    [-0.015, 0],
    [0.015, 0],
  ] as const) {
    const c = centeredCard(width, height, Math.min(GUIDE_HEIGHT, fit), dx, dy);
    if (c) crops.push(c);
  }
  // Doublons (image carrée, etc.) retirés.
  const seen = new Set<string>();
  return crops.filter((c) => {
    const k = [c.left, c.top, c.width, c.height].map((v) => v.toFixed(3)).join();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface ScanSignature {
  /** pHash de l'illustration (16 hex). */
  hash: string;
  /** Signature couleur de l'illustration (64 hex). */
  color: string;
}

/** Empreinte et couleurs de l'illustration d'une carte située dans `card` (fractions de l'image). */
export function scanSignature(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  card: Crop = { left: 0, top: 0, width: 1, height: 1 },
): ScanSignature {
  const art = composeCrop(card, ART_CROP);
  return {
    hash: phash(downscaleGray(rgba, width, height, art)),
    color: colorSignature(rgba, width, height, art),
  };
}

/** Poids de l'écart de couleur dans le score de ressemblance. */
export const COLOR_WEIGHT = 0.5;

/** Score de ressemblance (plus bas = plus proche) : forme de l'illustration + teintes. */
export const scanScore = (hamming: number, color: number | null) =>
  hamming + (color === null ? 0 : COLOR_WEIGHT * color);
