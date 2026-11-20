export type Theme = 'dark' | 'light' | 'system';

/** Valeur du cookie « theme » : sombre par défaut. */
export function parseTheme(value: string | undefined): Theme {
  return value === 'light' || value === 'system' ? value : 'dark';
}
