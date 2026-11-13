/** Recherche plein texte tolérante : sans accents, par début de mot. */

/** Minuscules sans accents ni apostrophes : « Évolutions » = « evolutions ». */
export function fold(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, ' ');
}

/** Mots de la requête, chacun devant apparaître dans le texte recherché. */
export function queryWords(q: string): string[] {
  return fold(q)
    .split(/[^a-z0-9.]+/)
    .filter((w) => w.length > 0);
}

/**
 * Score d'un texte pour la requête : 0 si un mot manque ; sinon plus élevé quand les mots
 * commencent des mots du texte (« dracau » → « Dracaufeu ») et quand le texte est court.
 */
export function matchScore(haystack: string, words: string[]): number {
  const text = fold(haystack);
  let score = 0;
  for (const w of words) {
    const i = text.indexOf(w);
    if (i < 0) return 0;
    score += i === 0 || /[^a-z0-9]/.test(text[i - 1]!) ? 3 : 1;
  }
  return score + 1 / (1 + text.length / 40);
}

const words = (text: string) =>
  ` ${fold(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

/**
 * Extension d'un produit d'après son nom : parmi les extensions dont le nom apparaît en mots
 * entiers, celle citée le plus loin dans le nom (« Coffret … Méga-Évolution - Règne Delta »
 * → Règne Delta : la série vient avant l'extension), la plus longue à égalité.
 */
export function extensionOf<T extends { name: string }>(productName: string, sets: T[]): T | null {
  const haystack = words(productName);
  let best: { set: T; at: number; len: number } | null = null;
  for (const set of sets) {
    const needle = words(set.name);
    if (needle.trim().length < 3) continue;
    const at = haystack.lastIndexOf(needle);
    if (at < 0) continue;
    const end = at + needle.length;
    if (!best || end > best.at || (end === best.at && needle.length > best.len)) {
      best = { set, at: end, len: needle.length };
    }
  }
  return best?.set ?? null;
}
