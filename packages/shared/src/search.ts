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
